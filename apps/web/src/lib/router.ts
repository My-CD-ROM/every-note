// Hash-based routing: encodes view + context IDs into URL hash
// Format: #/view/contextId/noteId

type View = 'home' | 'all' | 'folder' | 'tag' | 'trash' | 'favorites' | 'daily' | 'completed' | 'board' | 'finance';

export interface RouteState {
  view: View;
  folderId: string | null;
  tagId: string | null;
  projectId: string | null;
  noteId: string | null;
}

const VIEW_ALIASES: Record<string, View> = {
  home: 'home',
  notes: 'all',
  folder: 'folder',
  tag: 'tag',
  trash: 'trash',
  favorites: 'favorites',
  calendar: 'daily',
  completed: 'completed',
  board: 'board',
  finance: 'finance',
};

const VIEW_TO_ALIAS: Record<View, string> = {
  home: 'home',
  all: 'notes',
  folder: 'folder',
  tag: 'tag',
  trash: 'trash',
  favorites: 'favorites',
  daily: 'calendar',
  completed: 'completed',
  board: 'board',
  finance: 'finance',
};

export function encodeRoute(state: RouteState): string {
  const alias = VIEW_TO_ALIAS[state.view] || state.view;
  const parts = [alias];

  if (state.view === 'folder' && state.folderId) parts.push(state.folderId);
  else if (state.view === 'tag' && state.tagId) parts.push(state.tagId);
  else if (state.view === 'board' && state.projectId) parts.push(state.projectId);

  if (state.noteId) parts.push(state.noteId);

  return '#/' + parts.join('/');
}

export function decodeRoute(hash: string): RouteState {
  const raw = hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);

  const alias = parts[0] || 'home';
  const view = VIEW_ALIASES[alias] || 'home';

  const state: RouteState = { view, folderId: null, tagId: null, projectId: null, noteId: null };

  if (view === 'folder' && parts.length >= 2) {
    state.folderId = parts[1];
    if (parts.length >= 3) state.noteId = parts[2];
  } else if (view === 'tag' && parts.length >= 2) {
    state.tagId = parts[1];
    if (parts.length >= 3) state.noteId = parts[2];
  } else if (view === 'board' && parts.length >= 2) {
    state.projectId = parts[1];
    if (parts.length >= 3) state.noteId = parts[2];
  } else if (parts.length >= 2) {
    state.noteId = parts[1];
  }

  return state;
}

export function pushRoute(state: RouteState) {
  const hash = encodeRoute(state);
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash);
  }
}

export function replaceRoute(state: RouteState) {
  const hash = encodeRoute(state);
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', hash);
  }
}
