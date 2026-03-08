import { useEffect, useRef } from 'react';
import { decodeRoute, pushRoute, type RouteState } from '@/lib/router';
import { useUIStore } from '@/stores/ui-store';
import { useNotesStore } from '@/stores/notes-store';
import { useFoldersStore } from '@/stores/folders-store';
import { useTagsStore } from '@/stores/tags-store';
import { useProjectsStore } from '@/stores/projects-store';

function fetchForRoute(route: RouteState, fetchNotes: (params?: any) => Promise<void>) {
  if (route.view === 'folder' && route.folderId) {
    fetchNotes({ folder_id: route.folderId });
  } else if (route.view === 'tag' && route.tagId) {
    fetchNotes({ tag_id: route.tagId });
  } else if (route.view === 'board' && route.projectId) {
    fetchNotes({ project_id: route.projectId });
  } else if (route.view === 'trash') {
    fetchNotes({ trashed: true });
  } else if (route.view === 'favorites') {
    fetchNotes({ pinned: true });
  } else if (route.view === 'completed') {
    fetchNotes({ completed: true });
  } else {
    fetchNotes();
  }
}

// Syncs URL pathname ↔ app state
export function useRouter() {
  const setView = useUIStore((s) => s.setView);
  const view = useUIStore((s) => s.view);
  const { activeNoteId, setActiveNote, fetchNotes } = useNotesStore();
  const { activeFolderId, setActiveFolder } = useFoldersStore();
  const { activeTagId, setActiveTag } = useTagsStore();
  const { activeProjectId, setActiveProject } = useProjectsStore();
  const initializedRef = useRef(false);
  const suppressPathUpdate = useRef(false);

  // Restore state from URL on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const route = decodeRoute(window.location.pathname);
    suppressPathUpdate.current = true;

    setView(route.view);
    setActiveFolder(route.folderId);
    setActiveTag(route.tagId);
    setActiveProject(route.projectId);
    setActiveNote(route.noteId);

    fetchForRoute(route, fetchNotes);

    requestAnimationFrame(() => { suppressPathUpdate.current = false; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Push path on state changes
  useEffect(() => {
    if (suppressPathUpdate.current) return;

    const state: RouteState = {
      view,
      folderId: view === 'folder' ? activeFolderId : null,
      tagId: view === 'tag' ? activeTagId : null,
      projectId: view === 'board' ? activeProjectId : null,
      noteId: activeNoteId,
    };

    pushRoute(state);
  }, [view, activeFolderId, activeTagId, activeProjectId, activeNoteId]);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const route = decodeRoute(window.location.pathname);
      suppressPathUpdate.current = true;

      setView(route.view);
      setActiveFolder(route.folderId);
      setActiveTag(route.tagId);
      setActiveProject(route.projectId);
      setActiveNote(route.noteId);

      fetchForRoute(route, fetchNotes);

      requestAnimationFrame(() => { suppressPathUpdate.current = false; });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
