export interface ChecklistItem {
  id: string;
  label: string;
  criterion: string;
}

const ITEM_LINE = /^-\s*\[([a-z0-9-]+)\]\s*([^:]+):\s*(.+)$/;

export function parseChecklistItems(markdown: string): ChecklistItem[] {
  return markdown
    .split("\n")
    .map((line) => ITEM_LINE.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ id: m[1], label: m[2].trim(), criterion: m[3].trim() }));
}
