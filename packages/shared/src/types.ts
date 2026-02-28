export interface TagBrief {
  id: string;
  name: string;
  color: string;
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

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
