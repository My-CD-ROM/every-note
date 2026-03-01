import { useEffect, useRef } from 'react';
import { decodeRoute, pushRoute, replaceRoute, type RouteState } from '@/lib/router';
import { useUIStore } from '@/stores/ui-store';
import { useNotesStore } from '@/stores/notes-store';
import { useFoldersStore } from '@/stores/folders-store';
import { useTagsStore } from '@/stores/tags-store';
import { useProjectsStore } from '@/stores/projects-store';

// Syncs URL hash ↔ app state
export function useRouter() {
  const setView = useUIStore((s) => s.setView);
  const view = useUIStore((s) => s.view);
  const { activeNoteId, setActiveNote, fetchNotes } = useNotesStore();
  const { activeFolderId, setActiveFolder } = useFoldersStore();
  const { activeTagId, setActiveTag } = useTagsStore();
  const { activeProjectId, setActiveProject } = useProjectsStore();
  const initializedRef = useRef(false);
  const suppressHashUpdate = useRef(false);

  // Restore state from URL on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') return;

    const route = decodeRoute(hash);
    suppressHashUpdate.current = true;

    setView(route.view);
    setActiveFolder(route.folderId);
    setActiveTag(route.tagId);
    setActiveProject(route.projectId);
    setActiveNote(route.noteId);

    // Fetch notes for the restored view
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
    } else if (route.view === 'all' || route.view === 'home') {
      fetchNotes();
    }

    // Allow hash updates after a tick
    requestAnimationFrame(() => { suppressHashUpdate.current = false; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Push hash on state changes
  useEffect(() => {
    if (suppressHashUpdate.current) return;

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
      const route = decodeRoute(window.location.hash);
      suppressHashUpdate.current = true;

      setView(route.view);
      setActiveFolder(route.folderId);
      setActiveTag(route.tagId);
      setActiveProject(route.projectId);
      setActiveNote(route.noteId);

      // Fetch notes for the view
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

      requestAnimationFrame(() => { suppressHashUpdate.current = false; });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
