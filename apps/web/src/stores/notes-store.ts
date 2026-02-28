import { create } from 'zustand';
import type { NoteResponse } from '@/lib/api';
import { notesApi } from '@/lib/api';

interface NotesState {
  notes: NoteResponse[];
  activeNoteId: string | null;
  loading: boolean;

  fetchNotes: (params?: { folder_id?: string; tag_id?: string; trashed?: boolean; pinned?: boolean; completed?: boolean }) => Promise<void>;
  setActiveNote: (id: string | null) => void;
  createNote: (data: { title?: string; content?: string; folder_id?: string | null; note_type?: string; parent_id?: string | null }) => Promise<NoteResponse>;
  updateNote: (id: string, data: { title?: string; content?: string; folder_id?: string | null; is_pinned?: boolean; due_at?: string | null; note_type?: string }) => Promise<void>;
  deleteNote: (id: string, permanent?: boolean) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  completeNote: (id: string) => Promise<void>;
  uncompleteNote: (id: string) => Promise<void>;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  loading: false,

  fetchNotes: async (params) => {
    set({ loading: true });
    try {
      const notes = await notesApi.list(params);
      set({ notes });
    } finally {
      set({ loading: false });
    }
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  createNote: async (data) => {
    const note = await notesApi.create(data);
    set((s) => ({ notes: [note, ...s.notes], activeNoteId: note.id }));
    return note;
  },

  updateNote: async (id, data) => {
    // Optimistic update for instant UI feedback
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...data } : n)),
    }));
    try {
      const updated = await notesApi.update(id, data);
      set((s) => ({
        notes: s.notes.map((n) => (n.id === id ? updated : n)),
      }));
    } catch {
      // Revert on error
      const notes = await notesApi.list();
      set({ notes });
    }
  },

  deleteNote: async (id, permanent) => {
    await notesApi.delete(id, permanent);
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
    }));
  },

  restoreNote: async (id) => {
    await notesApi.restore(id);
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
    }));
  },

  completeNote: async (id) => {
    await notesApi.complete(id);
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
    }));
  },

  uncompleteNote: async (id) => {
    await notesApi.uncomplete(id);
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
    }));
  },

  get activeNote() {
    const { notes, activeNoteId } = get();
    return notes.find((n) => n.id === activeNoteId) ?? null;
  },
}));
