import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const FRAMEWORK_PATH = path.join(DATA_DIR, "nexus-framework.md");

export function readNexusFramework(): string {
  if (!existsSync(FRAMEWORK_PATH)) return "";
  return readFileSync(FRAMEWORK_PATH, "utf-8").trim();
}

export function writeNexusFramework(content: string): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FRAMEWORK_PATH, content, "utf-8");
}
