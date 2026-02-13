const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Types ---

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
  created_at: string;
  updated_at: string;
  tags: TagBrief[];
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

// --- Notes ---

export const notesApi = {
  list(params?: { folder_id?: string; tag_id?: string; trashed?: boolean; pinned?: boolean; completed?: boolean }) {
    const qs = new URLSearchParams();
    if (params?.folder_id) qs.set('folder_id', params.folder_id);
    if (params?.tag_id) qs.set('tag_id', params.tag_id);
    if (params?.trashed) qs.set('trashed', 'true');
    if (params?.pinned) qs.set('pinned', 'true');
    if (params?.completed) qs.set('completed', 'true');
    const query = qs.toString();
    return request<NoteResponse[]>(`/notes${query ? `?${query}` : ''}`);
  },
  get(id: string) {
    return request<NoteResponse>(`/notes/${id}`);
  },
  create(data: { title?: string; content?: string; folder_id?: string | null; note_type?: string }) {
    return request<NoteResponse>('/notes', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: string, data: { title?: string; content?: string; folder_id?: string | null; position?: number; is_pinned?: boolean; due_at?: string | null; note_type?: string }) {
    return request<NoteResponse>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  delete(id: string, permanent = false) {
    return request<{ ok: boolean }>(`/notes/${id}?permanent=${permanent}`, { method: 'DELETE' });
  },
  restore(id: string) {
    return request<NoteResponse>(`/notes/${id}/restore`, { method: 'POST' });
  },
  complete(id: string) {
    return request<NoteResponse>(`/notes/${id}/complete`, { method: 'POST' });
  },
  uncomplete(id: string) {
    return request<NoteResponse>(`/notes/${id}/uncomplete`, { method: 'POST' });
  },
  addTag(noteId: string, tagId: string) {
    return request<{ ok: boolean }>(`/notes/${noteId}/tags/${tagId}`, { method: 'POST' });
  },
  removeTag(noteId: string, tagId: string) {
    return request<{ ok: boolean }>(`/notes/${noteId}/tags/${tagId}`, { method: 'DELETE' });
  },
  listVersions(noteId: string) {
    return request<NoteVersionBrief[]>(`/notes/${noteId}/versions`);
  },
  getVersion(noteId: string, versionId: string) {
    return request<NoteVersionResponse>(`/notes/${noteId}/versions/${versionId}`);
  },
  restoreVersion(noteId: string, versionId: string) {
    return request<NoteResponse>(`/notes/${noteId}/versions/${versionId}/restore`, { method: 'POST' });
  },
  backlinks(noteId: string) {
    return request<BacklinkResponse[]>(`/notes/${noteId}/backlinks`);
  },
  reorder(items: { id: string; position: number }[]) {
    return request<{ ok: boolean }>('/notes/reorder', { method: 'POST', body: JSON.stringify({ items }) });
  },
};

// --- Folders ---

export const foldersApi = {
  list(parentId?: string | null) {
    const qs = parentId ? `?parent_id=${parentId}` : '';
    return request<FolderResponse[]>(`/folders${qs}`);
  },
  tree() {
    return request<FolderTree[]>('/folders/tree');
  },
  get(id: string) {
    return request<FolderResponse>(`/folders/${id}`);
  },
  create(data: { name: string; icon?: string | null; parent_id?: string | null }) {
    return request<FolderResponse>('/folders', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: string, data: { name?: string; icon?: string | null; parent_id?: string | null; position?: number }) {
    return request<FolderResponse>(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/folders/${id}`, { method: 'DELETE' });
  },
  reorder(items: { id: string; position: number }[]) {
    return request<{ ok: boolean }>('/folders/reorder', { method: 'POST', body: JSON.stringify({ items }) });
  },
};

// --- Tags ---

export const tagsApi = {
  list() {
    return request<TagResponse[]>('/tags');
  },
  create(data: { name: string; color?: string }) {
    return request<TagResponse>('/tags', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: string, data: { name?: string; color?: string }) {
    return request<TagResponse>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/tags/${id}`, { method: 'DELETE' });
  },
};

// --- Search ---

export const searchApi = {
  search(q: string, limit = 20) {
    return request<SearchResult[]>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  },
};

// --- Daily ---

export const dailyApi = {
  getOrCreate(date?: string) {
    const path = date ? `/daily/${date}` : '/daily';
    return request<NoteResponse>(path);
  },
  range(start: string, end: string) {
    return request<NoteResponse[]>(`/daily/range?start=${start}&end=${end}`);
  },
};

// --- Export ---

export const exportApi = {
  noteUrl(noteId: string) {
    return `${BASE}/export/notes/${noteId}`;
  },
  folderUrl(folderId: string) {
    return `${BASE}/export/folders/${folderId}`;
  },
};

// --- Graph ---

export const graphApi = {
  get() {
    return request<GraphData>('/graph');
  },
};
