import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarkdownEditorHandle } from '@/components/editor/MarkdownEditor';
import { useNotesStore } from '@/stores/notes-store';
import { useTagsStore } from '@/stores/tags-store';
import { notesApi, attachmentsApi } from '@/lib/api';
import type { RecurrenceRule } from '@/lib/api';

export function useNoteEditor() {
  const { notes, activeNoteId, updateNote, deleteNote, setActiveNote, fetchNotes, completeNote, uncompleteNote } = useNotesStore();
  const { tags, fetchTags } = useTagsStore();
  const note = notes.find((n) => n.id === activeNoteId);

  // Breadcrumb: track parent when drilling into a subtask
  const [parentStack, setParentStack] = useState<{ id: string; title: string }[]>([]);

  const handleOpenSubtask = useCallback(async (subtaskId: string) => {
    if (!note) return;
    setParentStack((prev) => [...prev, { id: note.id, title: note.title || 'Untitled' }]);
    try {
      const subtask = await notesApi.get(subtaskId);
      useNotesStore.setState((s) => {
        const exists = s.notes.some((n) => n.id === subtaskId);
        return {
          notes: exists ? s.notes.map((n) => (n.id === subtaskId ? subtask : n)) : [subtask, ...s.notes],
          activeNoteId: subtaskId,
        };
      });
    } catch {
      setActiveNote(subtaskId);
    }
  }, [note, setActiveNote]);

  const handleBreadcrumbNav = useCallback((targetId: string) => {
    setParentStack((prev) => {
      const idx = prev.findIndex((p) => p.id === targetId);
      return idx >= 0 ? prev.slice(0, idx) : [];
    });
    setActiveNote(targetId);
  }, [setActiveNote]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectionCoords, setSelectionCoords] = useState<{ top: number; left: number; bottom: number; right: number } | null>(null);
  const editorRef = useRef<MarkdownEditorHandle>(null);

  // Due date state
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [dueTime, setDueTime] = useState('12:00');
  const [duePopoverOpen, setDuePopoverOpen] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [recurrencePopoverOpen, setRecurrencePopoverOpen] = useState(false);
  const [recFreq, setRecFreq] = useState<RecurrenceRule['freq']>('daily');
  const [recInterval, setRecInterval] = useState(1);
  const [reminderPopoverOpen, setReminderPopoverOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachKey, setAttachKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save refs
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingEditRef = useRef<{ noteId: string; title: string; content: string } | null>(null);
  const justSavedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSave = useCallback(async (noteId: string, t: string, c: string) => {
    setSaving(true);
    await updateNote(noteId, { title: t, content: c });
    pendingEditRef.current = null;
    setDirty(false);
    setSaving(false);
    setJustSaved(true);
    clearTimeout(justSavedTimerRef.current);
    justSavedTimerRef.current = setTimeout(() => setJustSaved(false), 1500);
  }, [updateNote]);

  const scheduleSave = useCallback((noteId: string, t: string, c: string) => {
    pendingEditRef.current = { noteId, title: t, content: c };
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingEditRef.current;
      if (pending) doSave(pending.noteId, pending.title, pending.content);
    }, 1000);
  }, [doSave]);

  const flushSave = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    const pending = pendingEditRef.current;
    if (pending) {
      doSave(pending.noteId, pending.title, pending.content);
    }
  }, [doSave]);

  // Sync local state when active note changes + flush previous note save
  useEffect(() => {
    flushSave();
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setDirty(false);
      setShowHistory(false);
      setJustSaved(false);
      if (note.due_at) {
        const d = new Date(note.due_at);
        setDueDate(d);
        setDueTime(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      } else {
        setDueDate(undefined);
        setDueTime('12:00');
      }
      if (note.recurrence_rule) {
        setRecFreq(note.recurrence_rule.freq);
        setRecInterval(note.recurrence_rule.interval);
      } else {
        setRecFreq('daily');
        setRecInterval(1);
      }
      // Clear breadcrumb if navigating to a top-level note from the list
      if (!note.parent_id && parentStack.length > 0) {
        const isInStack = parentStack.some((p) => p.id === note.id);
        if (!isInStack) setParentStack([]);
      }
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+S for immediate save, Escape to close editor
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        flushSave();
      }
      if (e.key === 'Escape' && !duePopoverOpen && !tagPopoverOpen) {
        flushSave();
        setActiveNote(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flushSave, duePopoverOpen, tagPopoverOpen, setActiveNote]);

  // Fetch tags when tag popover opens (scoped to note's project)
  useEffect(() => {
    if (tagPopoverOpen) fetchTags(note?.project_id ?? undefined);
  }, [tagPopoverOpen, fetchTags, note?.project_id]);

  // Warn on navigation if unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current);
      clearTimeout(justSavedTimerRef.current);
      const pending = pendingEditRef.current;
      if (pending) {
        useNotesStore.getState().updateNote(pending.noteId, { title: pending.title, content: pending.content });
      }
    };
  }, []);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setDirty(true);
    setJustSaved(false);
    if (activeNoteId) scheduleSave(activeNoteId, value, content);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setDirty(true);
    setJustSaved(false);
    if (activeNoteId) scheduleSave(activeNoteId, title, value);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      editorRef.current?.focus();
    }
  };

  const handleSetDue = () => {
    if (!dueDate || !activeNoteId) return;
    const [hours, minutes] = dueTime.split(':').map(Number);
    const d = new Date(dueDate);
    d.setHours(hours, minutes, 0, 0);
    updateNote(activeNoteId, { due_at: d.toISOString() });
    setDuePopoverOpen(false);
  };

  const handleClearDue = () => {
    if (!activeNoteId) return;
    updateNote(activeNoteId, { due_at: null });
    setDueDate(undefined);
    setDueTime('12:00');
  };

  const handleVersionRestore = useCallback(async () => {
    if (!activeNoteId) return;
    const { fetchNotes } = useNotesStore.getState();
    await fetchNotes();
    const restored = useNotesStore.getState().notes.find((n) => n.id === activeNoteId);
    if (restored) {
      setTitle(restored.title);
      setContent(restored.content);
      setDirty(false);
    }
    setShowHistory(false);
  }, [activeNoteId]);

  const handleUploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!activeNoteId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const att = await attachmentsApi.upload(activeNoteId, file);
        const isImage = att.mime_type.startsWith('image/');
        const md = isImage
          ? `![${att.original_filename}](${att.url})\n`
          : `[${att.original_filename}](${att.url})\n`;
        editorRef.current?.insertAtCursor(md);
      }
      setAttachKey((k) => k + 1);
    } catch (e: any) {
      console.error('Upload failed:', e.message);
    } finally {
      setUploading(false);
    }
  }, [activeNoteId]);

  // Replay fade animation on note switch without remounting
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!note || !el) return;
    el.classList.remove('animate-fade-in-up');
    void el.offsetWidth;
    el.classList.add('animate-fade-in-up');
  }, [activeNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Store data
    note,
    activeNoteId,
    tags,
    fetchNotes,
    updateNote,
    deleteNote,
    setActiveNote,
    completeNote,
    uncompleteNote,

    // Breadcrumb
    parentStack,
    handleOpenSubtask,
    handleBreadcrumbNav,

    // Core editor state
    title,
    content,
    dirty,
    saving,
    justSaved,
    showHistory,
    setShowHistory,
    selectionCoords,
    setSelectionCoords,

    // Due date form
    dueDate,
    setDueDate,
    dueTime,
    setDueTime,
    duePopoverOpen,
    setDuePopoverOpen,

    // Tag popover
    tagPopoverOpen,
    setTagPopoverOpen,

    // Recurrence form
    recurrencePopoverOpen,
    setRecurrencePopoverOpen,
    recFreq,
    setRecFreq,
    recInterval,
    setRecInterval,

    // Reminder popover
    reminderPopoverOpen,
    setReminderPopoverOpen,

    // Attachments / drag-drop
    isDragOver,
    setIsDragOver,
    uploading,
    attachKey,
    fileInputRef,

    // Refs
    editorRef,
    wrapperRef,

    // Handlers
    flushSave,
    handleTitleChange,
    handleContentChange,
    handleTitleKeyDown,
    handleSetDue,
    handleClearDue,
    handleVersionRestore,
    handleUploadFiles,
  };
}
