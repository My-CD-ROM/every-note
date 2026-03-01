export interface TagBrief {
  id: string;
  name: string;
  color: string;
}

export interface RecurrenceRule {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
}

export interface NoteResponse {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  position: number;
  is_pinned: boolean;
  is_trashed: boolean;
  trashed_at: string | null;
  is_completed: boolean;
  completed_at: string | null;
  note_type: 'note' | 'checklist';
  is_daily: boolean;
  daily_date: string | null;
  due_at: string | null;
  parent_id: string | null;
  status: string | null;
  project_id: string | null;
  recurrence_rule: RecurrenceRule | null;
  recurrence_source_id: string | null;
  created_at: string;
  updated_at: string;
  tags: TagBrief[];
  subtask_count: number;
  subtask_completed: number;
}

export interface FolderResponse {
  id: string;
  name: string;
  icon: string | null;
  parent_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  note_count: number;
}

export interface FolderTree extends FolderResponse {
  children: FolderTree[];
}

export interface TagResponse {
  id: string;
  name: string;
  color: string;
  created_at: string;
  note_count: number;
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  folder_id: string | null;
  folder_name: string | null;
  parent_id: string | null;
  parent_title: string | null;
  rank: number;
}

export interface NoteVersionBrief {
  id: string;
  title: string;
  created_at: string;
}

export interface NoteVersionResponse {
  id: string;
  note_id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface BacklinkResponse {
  id: string;
  title: string;
  updated_at: string;
}

export interface GraphNode {
  id: string;
  title: string;
  folder_id: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'link' | 'tag' | 'folder';
}

export interface ProjectResponse {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  note_count: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ReminderResponse {
  id: string;
  note_id: string;
  remind_at: string;
  is_fired: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface ReminderWithNote {
  id: string;
  note_id: string;
  note_title: string;
  remind_at: string;
  is_fired: boolean;
  is_dismissed: boolean;
}

export interface AttachmentResponse {
  id: string;
  note_id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  url: string;
}
