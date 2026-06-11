import { describe, it, expect } from "vitest";
import { upsertConversation, deriveTitle } from "../chat-store";
import type { ChatConversation } from "../types";

const conv = (overrides: Partial<ChatConversation> = {}): ChatConversation => ({
  id: "c1",
  title: "First",
  createdAt: "2026-06-12T10:00:00.000Z",
  updatedAt: "2026-06-12T10:00:00.000Z",
  messages: [],
  ...overrides,
});

describe("upsertConversation", () => {
  it("adds a new conversation", () => {
    const out = upsertConversation([], conv());
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("c1");
  });

  it("replaces an existing conversation by id without duplicating", () => {
    const existing = [conv({ id: "c1", title: "Old", updatedAt: "2026-06-12T10:00:00.000Z" })];
    const out = upsertConversation(
      existing,
      conv({ id: "c1", title: "New", updatedAt: "2026-06-12T11:00:00.000Z" })
    );
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("New");
  });

  it("sorts most-recently-updated first", () => {
    const a = conv({ id: "a", updatedAt: "2026-06-12T09:00:00.000Z" });
    const b = conv({ id: "b", updatedAt: "2026-06-12T12:00:00.000Z" });
    const out = upsertConversation([a], b);
    expect(out.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("deriveTitle", () => {
  it("uses the message when short", () => {
    expect(deriveTitle("What should I post next?")).toBe("What should I post next?");
  });

  it("truncates long messages with an ellipsis", () => {
    const long = "a".repeat(100);
    const title = deriveTitle(long);
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(49);
  });

  it("collapses whitespace and falls back for empty input", () => {
    expect(deriveTitle("  hello   world \n")).toBe("hello world");
    expect(deriveTitle("   ")).toBe("New chat");
  });
});
