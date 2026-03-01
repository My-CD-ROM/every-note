import type {
  NoteResponse,
  RecurrenceRule,
  AttachmentResponse,
  ReminderResponse,
  ReminderWithNote,
  FolderResponse,
  FolderTree,
  TagResponse,
  ProjectResponse,
  SearchResult,
  NoteVersionBrief,
  NoteVersionResponse,
  BacklinkResponse,
  GraphData,
} from '@every-note/shared';

// Re-export all shared types so existing imports from '@/lib/api' keep working
export type {
  TagBrief,
  RecurrenceRule,
  AttachmentResponse,
  ReminderResponse,
  ReminderWithNote,
  NoteResponse,
  FolderResponse,
  FolderTree,
  TagResponse,
  ProjectResponse,
  SearchResult,
  NoteVersionBrief,
  NoteVersionResponse,
  BacklinkResponse,
  GraphNode,
  GraphEdge,
  GraphData,
} from '@every-note/shared';

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

// --- Notes ---

export const notesApi = {
  list(params?: { folder_id?: string; tag_id?: string; trashed?: boolean; pinned?: boolean; completed?: boolean; project_id?: string }) {
    const qs = new URLSearchParams();
    if (params?.folder_id) qs.set('folder_id', params.folder_id);
    if (params?.tag_id) qs.set('tag_id', params.tag_id);
    if (params?.trashed) qs.set('trashed', 'true');
    if (params?.pinned) qs.set('pinned', 'true');
    if (params?.completed) qs.set('completed', 'true');
    if (params?.project_id) qs.set('project_id', params.project_id);
    const query = qs.toString();
    return request<NoteResponse[]>(`/notes${query ? `?${query}` : ''}`);
  },
  get(id: string) {
    return request<NoteResponse>(`/notes/${id}`);
  },
  create(data: { title?: string; content?: string; folder_id?: string | null; note_type?: string; parent_id?: string | null; status?: string | null; project_id?: string | null; recurrence_rule?: RecurrenceRule | null }) {
    return request<NoteResponse>('/notes', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: string, data: { title?: string; content?: string; folder_id?: string | null; position?: number; is_pinned?: boolean; due_at?: string | null; note_type?: string; parent_id?: string | null; status?: string | null; project_id?: string | null; recurrence_rule?: RecurrenceRule | null }) {
    return request<NoteResponse>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  setStatus(id: string, status: string | null) {
    return request<NoteResponse>(`/notes/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
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
  listSubtasks(noteId: string) {
    return request<NoteResponse[]>(`/notes/${noteId}/subtasks`);
  },
  backlinks(noteId: string) {
    return request<BacklinkResponse[]>(`/notes/${noteId}/backlinks`);
  },
  removeRecurrence(id: string) {
    return request<NoteResponse>(`/notes/${id}/recurrence`, { method: 'DELETE' });
  },
  reorder(items: { id: string; position: number }[]) {
    return request<{ ok: boolean }>('/notes/reorder', { method: 'POST', body: JSON.stringify({ items }) });
  },
};

// --- Attachments ---

export const attachmentsApi = {
  list(noteId: string) {
    return request<AttachmentResponse[]>(`/notes/${noteId}/attachments`);
  },
  async upload(noteId: string, file: File): Promise<AttachmentResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/notes/${noteId}/attachments`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },
  fileUrl(attachmentId: string) {
    return `${BASE}/attachments/${attachmentId}/file`;
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/attachments/${id}`, { method: 'DELETE' });
  },
};

// --- Reminders ---

export const remindersApi = {
  list(noteId: string) {
    return request<ReminderResponse[]>(`/notes/${noteId}/reminders`);
  },
  create(noteId: string, remind_at: string) {
    return request<ReminderResponse>(`/notes/${noteId}/reminders`, { method: 'POST', body: JSON.stringify({ remind_at }) });
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/reminders/${id}`, { method: 'DELETE' });
  },
  dismiss(id: string) {
    return request<ReminderResponse>(`/reminders/${id}/dismiss`, { method: 'POST' });
  },
  snooze(id: string, minutes: number) {
    return request<ReminderResponse>(`/reminders/${id}/snooze`, { method: 'POST', body: JSON.stringify({ minutes }) });
  },
  pending() {
    return request<ReminderWithNote[]>('/reminders/pending');
  },
  fire(id: string) {
    return request<ReminderResponse>(`/reminders/${id}/fire`, { method: 'POST' });
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

// --- Projects ---

export const projectsApi = {
  list() {
    return request<ProjectResponse[]>('/projects');
  },
  create(data: { name: string; icon?: string | null; description?: string | null }) {
    return request<ProjectResponse>('/projects', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: string, data: { name?: string; icon?: string | null; description?: string | null }) {
    return request<ProjectResponse>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' });
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
