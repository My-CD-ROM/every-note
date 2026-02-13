export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

let nextId = 0;
function uid(): string {
  return `cli-${++nextId}-${Date.now()}`;
}

export function parseChecklist(content: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^- \[([ xX])\] (.*)$/);
    if (m) {
      items.push({ id: uid(), text: m[2], checked: m[1] !== ' ' });
    }
  }
  return items;
}

export function serializeChecklist(items: ChecklistItem[]): string {
  return items.map((i) => `- [${i.checked ? 'x' : ' '}] ${i.text}`).join('\n');
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  const total = items.length;
  const done = items.filter((i) => i.checked).length;
  return { done, total };
}

export function checklistProgressFromContent(content: string): { done: number; total: number } {
  const open = (content.match(/- \[ \]/g) || []).length;
  const checked = (content.match(/- \[[xX]\]/g) || []).length;
  return { done: checked, total: open + checked };
}
