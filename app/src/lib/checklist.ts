import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const CHECKLIST_PATH = path.join(DATA_DIR, "master-checklist.md");

export function readMasterChecklist(): string {
  if (!existsSync(CHECKLIST_PATH)) return "";
  return readFileSync(CHECKLIST_PATH, "utf-8").trim();
}

export function writeMasterChecklist(content: string): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CHECKLIST_PATH, content, "utf-8");
}
