import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import type { ChatConversation } from "./types";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const CHATS_PATH = path.join(DATA_DIR, "chats.json");

// ── Pure helpers (unit-tested) ──────────────────────────────────────────────

// Upsert a conversation into a list by id, keeping the list sorted by updatedAt
// (most recently updated first). Pure so it can be tested without the filesystem.
export function upsertConversation(
  list: ChatConversation[],
  conv: ChatConversation
): ChatConversation[] {
  const without = list.filter((c) => c.id !== conv.id);
  return [conv, ...without].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// Derive a short conversation title from the first user message.
export function deriveTitle(firstMessage: string): string {
  const trimmed = firstMessage.replace(/\s+/g, " ").trim();
  if (!trimmed) return "New chat";
  return trimmed.length > 48 ? trimmed.slice(0, 48).trimEnd() + "…" : trimmed;
}

// ── Filesystem store ────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function readConversations(): ChatConversation[] {
  if (!existsSync(CHATS_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(CHATS_PATH, "utf-8"));
    if (!Array.isArray(raw)) return [];
    return (raw as ChatConversation[]).sort((a, b) =>
      (b.updatedAt || "").localeCompare(a.updatedAt || "")
    );
  } catch {
    return [];
  }
}

export function readConversation(id: string): ChatConversation | null {
  return readConversations().find((c) => c.id === id) || null;
}

export function writeConversation(conv: ChatConversation): void {
  ensureDataDir();
  const updated = upsertConversation(readConversations(), conv);
  writeFileSync(CHATS_PATH, JSON.stringify(updated, null, 2), "utf-8");
}

export function deleteConversation(id: string): void {
  ensureDataDir();
  const remaining = readConversations().filter((c) => c.id !== id);
  writeFileSync(CHATS_PATH, JSON.stringify(remaining, null, 2), "utf-8");
}
