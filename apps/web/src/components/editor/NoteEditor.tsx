import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, Check, CheckCircle2, Download, FileText, History, ListChecks, Loader2, Star, Tag, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor';
import { ChecklistEditor } from './ChecklistEditor';
import { FormatToolbar } from './FormatToolbar';
import { VersionHistory } from './VersionHistory';
import { Backlinks } from './Backlinks';
import { useNotesStore } from '@/stores/notes-store';
import { useTagsStore } from '@/stores/tags-store';
import { notesApi, exportApi } from '@/lib/api';

function formatDueAt(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} at ${time}`;
}

export function NoteEditor() {
  const { notes, activeNoteId, updateNote, deleteNote, setActiveNote, fetchNotes, completeNote, uncompleteNote } = useNotesStore();
  const { tags, fetchTags } = useTagsStore();
  const note = notes.find((n) => n.id === activeNoteId);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const editorRef = useRef<MarkdownEditorHandle>(null);

  // Due date state
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [dueTime, setDueTime] = useState('12:00');
  const [duePopoverOpen, setDuePopoverOpen] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  // Auto-save refs
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingEditRef = useRef<{ noteId: string; title: string; content: string } | null>(null);
  const justSavedTimerRef = useRef<ReturnType<typeof setTimeout>>();

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

  // Fetch tags when tag popover opens
  useEffect(() => {
    if (tagPopoverOpen) fetchTags();
  }, [tagPopoverOpen, fetchTags]);

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
        // Fire-and-forget save
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

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Select a note or create one with the + button
      </div>
    );
  }

  const isPastDue = note.due_at && new Date(note.due_at) < new Date();

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top toolbar: title + action buttons */}
        <div className="flex items-center gap-1 border-b px-4 py-2 bg-background/50">
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled"
            className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          />

          {/* Auto-save status */}
          <div className="flex items-center gap-1 shrink-0 min-w-[60px] justify-end">
            {saving && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving
              </span>
            )}
            {!saving && justSaved && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
            {dirty && !saving && (
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" title="Unsaved changes" />
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => updateNote(note.id, { is_pinned: !note.is_pinned })}
            title={note.is_pinned ? 'Unfavorite' : 'Favorite'}
          >
            <Star className={`h-4 w-4 ${note.is_pinned ? 'fill-amber-400 text-amber-400' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setShowHistory(!showHistory)}
            title="Version history"
          >
            <History className="h-4 w-4" />
          </Button>

          {/* Due date */}
          <Popover open={duePopoverOpen} onOpenChange={setDuePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 shrink-0 ${note.due_at ? (isPastDue ? 'text-red-500' : 'text-blue-500') : ''}`}
                title={note.due_at ? `Due: ${formatDueAt(note.due_at)}` : 'Set due date'}
              >
                <CalendarClock className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 space-y-3">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                />
                <div className="flex items-center gap-2 px-1">
                  <label className="text-xs text-muted-foreground shrink-0">Time:</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="flex h-8 w-full rounded-md border bg-transparent px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 px-1">
                  <Button size="sm" className="flex-1" onClick={handleSetDue} disabled={!dueDate}>
                    Set due date
                  </Button>
                  {note.due_at && (
                    <Button size="sm" variant="outline" onClick={handleClearDue}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Tags */}
          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 shrink-0 ${note.tags.length > 0 ? 'text-indigo-500' : ''}`}
                title="Tags"
              >
                <Tag className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1">Tags</div>
              {tags.length === 0 && (
                <div className="text-xs text-muted-foreground/60 px-2 py-2">No tags yet. Create one in the sidebar.</div>
              )}
              {tags.map((tag) => {
                const hasTag = note.tags.some((t) => t.id === tag.id);
                return (
                  <button
                    key={tag.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                    onClick={async () => {
                      if (hasTag) {
                        await notesApi.removeTag(note.id, tag.id);
                      } else {
                        await notesApi.addTag(note.id, tag.id);
                      }
                      fetchNotes();
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate">{tag.name}</span>
                    {hasTag && <Check className="h-3 w-3 ml-auto text-indigo-500" />}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              const newType = note.note_type === 'checklist' ? 'note' : 'checklist';
              updateNote(note.id, { note_type: newType });
            }}
            title={note.note_type === 'checklist' ? 'Convert to note' : 'Convert to checklist'}
          >
            {note.note_type === 'checklist' ? <FileText className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
          </Button>
          {!note.is_completed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => completeNote(note.id)}
              title="Mark complete"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
          <a href={exportApi.noteUrl(note.id)} download>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Export as .md">
              <Download className="h-4 w-4" />
            </Button>
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-red-500 hover:text-red-600"
            onClick={() => deleteNote(note.id)}
            title="Move to trash"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Completed indicator bar */}
        {note.is_completed && (
          <div className="flex items-center gap-2 px-4 py-1.5 text-xs border-b bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Completed {note.completed_at ? new Date(note.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
            <button
              onClick={() => uncompleteNote(note.id)}
              className="ml-auto flex items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              <Undo2 className="h-3 w-3" />
              Uncomplete
            </button>
          </div>
        )}

        {/* Due date indicator bar */}
        {note.due_at && (
          <div className={`flex items-center gap-2 px-4 py-1 text-xs border-b ${
            isPastDue ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400'
          }`}>
            <CalendarClock className="h-3 w-3" />
            <span>Due {formatDueAt(note.due_at)}</span>
            {isPastDue && <span className="font-medium">(overdue)</span>}
          </div>
        )}

        {/* Tags bar */}
        {note.tags.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-1 border-b flex-wrap">
            {note.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 cursor-pointer hover:opacity-70 transition-opacity"
                style={{ color: tag.color, backgroundColor: `${tag.color}18` }}
                title={`Remove tag: ${tag.name}`}
                onClick={async () => {
                  await notesApi.removeTag(note.id, tag.id);
                  fetchNotes();
                }}
              >
                {tag.name}
                <X className="h-2.5 w-2.5" />
              </span>
            ))}
          </div>
        )}

        {/* Formatting toolbar (hidden for checklists) */}
        {note.note_type !== 'checklist' && <FormatToolbar editorRef={editorRef} />}

        {/* Editor / Preview */}
        <div className="flex flex-1 overflow-hidden">
          {note.note_type === 'checklist' ? (
            <div className="w-full">
              <ChecklistEditor value={content} onChange={handleContentChange} />
            </div>
          ) : (
            <div className="w-full">
              <MarkdownEditor
                ref={editorRef}
                value={content}
                onChange={handleContentChange}
                className="h-full"
              />
            </div>
          )}
        </div>

        {/* Backlinks */}
        <Backlinks noteId={note.id} />
      </div>

      {/* Version History Panel */}
      {showHistory && (
        <VersionHistory
          noteId={note.id}
          onRestore={handleVersionRestore}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
