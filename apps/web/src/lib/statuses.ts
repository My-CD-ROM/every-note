export interface StatusDef {
  id: string;
  label: string;
  color: string;
}

export const STATUSES: StatusDef[] = [
  { id: 'backlog', label: 'Backlog', color: '#6b7280' },
  { id: 'todo', label: 'To Do', color: '#3b82f6' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'done', label: 'Done', color: '#10b981' },
];

export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.id, s]));
