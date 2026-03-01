import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CalendarClock, Check, CheckCircle2, ChevronRight, Circle, Download, FileText, History, ListChecks, Loader2, MoreHorizontal, Paperclip, Repeat, Star, Tag, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor';
import { ChecklistEditor } from './ChecklistEditor';
import { FormatToolbar } from './FormatToolbar';
import { VersionHistory } from './VersionHistory';
import { Backlinks } from './Backlinks';
import { SubtaskList } from './SubtaskList';
import { AttachmentPanel } from './AttachmentPanel';
import { useNotesStore } from '@/stores/notes-store';
import { useTagsStore } from '@/stores/tags-store';
import { notesApi, exportApi, attachmentsApi, remindersApi } from '@/lib/api';
import type { RecurrenceRule } from '@/lib/api';
import { STATUSES, STATUS_MAP } from '@/lib/statuses';

const FREQ_OPTIONS: { value: RecurrenceRule['freq']; label: string }[] = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'yearly', label: 'Year' },
];

function formatRecurrence(rule: RecurrenceRule): string {
  const freq = FREQ_OPTIONS.find((f) => f.value === rule.freq);
  if (rule.interval === 1) return `Every ${freq?.label.toLowerCase() || rule.freq}`;
  return `Every ${rule.interval} ${freq?.label.toLowerCase() || rule.freq}s`;
}

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

  // Breadcrumb: track parent when drilling into a subtask
  const [parentStack, setParentStack] = useState<{ id: string; title: string }[]>([]);

  const handleOpenSubtask = useCallback(async (subtaskId: string) => {
    if (!note) return;
    // Push current note to breadcrumb stack
    setParentStack((prev) => [...prev, { id: note.id, title: note.title || 'Untitled' }]);
    // Load subtask into the notes list if not already there, then set active
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
      // If loading fails, just try setting active
      setActiveNote(subtaskId);
    }
  }, [note, setActiveNote]);

  const handleBreadcrumbNav = useCallback((targetId: string) => {
    // Pop back to the target in the stack
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
        {/* Breadcrumb navigation for subtasks */}
        {parentStack.length > 0 && (
          <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-muted/30 text-xs">
            {parentStack.map((parent) => (
              <span key={parent.id} className="flex items-center gap-1">
                <button
                  onClick={() => handleBreadcrumbNav(parent.id)}
                  className="text-muted-foreground hover:text-foreground hover:underline transition-colors truncate max-w-[150px]"
                >
                  {parent.title}
                </button>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              </span>
            ))}
            <span className="text-foreground font-medium truncate">{title || 'Untitled'}</span>
          </div>
        )}

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
          {/* Due date */}
          <Popover open={duePopoverOpen} onOpenChange={setDuePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 shrink-0 ${note.due_at ? (isPastDue ? 'text-destructive' : 'text-primary') : ''}`}
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
                className={`h-8 w-8 shrink-0 ${note.tags.length > 0 ? 'text-primary' : ''}`}
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
                    {hasTag && <Check className="h-3 w-3 ml-auto text-primary" />}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* Status */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title={note.status ? `Status: ${STATUS_MAP[note.status]?.label || note.status}` : 'Set status'}
              >
                <Circle
                  className="h-4 w-4"
                  style={note.status ? { color: STATUS_MAP[note.status]?.color, fill: STATUS_MAP[note.status]?.color } : undefined}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="end">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1">Status</div>
              {STATUSES.map((s) => (
                <button
                  key={s.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                  onClick={async () => {
                    await notesApi.setStatus(note.id, s.id);
                    fetchNotes();
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span>{s.label}</span>
                  {note.status === s.id && <Check className="h-3 w-3 ml-auto text-primary" />}
                </button>
              ))}
              {note.status && (
                <>
                  <div className="border-t my-1" />
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors text-muted-foreground"
                    onClick={async () => {
                      await notesApi.setStatus(note.id, null);
                      fetchNotes();
                    }}
                  >
                    <X className="h-3 w-3" />
                    Remove status
                  </button>
                </>
              )}
            </PopoverContent>
          </Popover>

          {/* Attach file */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleUploadFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach file"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>

          {/* Remind me */}
          <Popover open={reminderPopoverOpen} onOpenChange={setReminderPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Set reminder"
              >
                <Bell className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="end">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1">Remind me</div>
              {[
                { label: 'In 15 minutes', minutes: 15 },
                { label: 'In 1 hour', minutes: 60 },
                { label: 'In 3 hours', minutes: 180 },
                { label: 'Tomorrow 9 AM', minutes: -1 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                  onClick={async () => {
                    if (!activeNoteId) return;
                    let remindAt: Date;
                    if (opt.minutes === -1) {
                      remindAt = new Date();
                      remindAt.setDate(remindAt.getDate() + 1);
                      remindAt.setHours(9, 0, 0, 0);
                    } else {
                      remindAt = new Date(Date.now() + opt.minutes * 60_000);
                    }
                    await remindersApi.create(activeNoteId, remindAt.toISOString());
                    setReminderPopoverOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Recurrence */}
          <Popover open={recurrencePopoverOpen} onOpenChange={setRecurrencePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 shrink-0 ${note.recurrence_rule ? 'text-primary' : ''}`}
                title={note.recurrence_rule ? formatRecurrence(note.recurrence_rule) : 'Set recurrence'}
              >
                <Repeat className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="end">
              <div className="text-xs font-medium text-muted-foreground mb-2">Repeat</div>
              <div className="flex items-center gap-2">
                <span className="text-sm shrink-0">Every</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={recInterval}
                  onChange={(e) => setRecInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex h-8 w-16 rounded-md border bg-transparent px-2 py-1 text-sm text-center"
                />
                <select
                  value={recFreq}
                  onChange={(e) => setRecFreq(e.target.value as RecurrenceRule['freq'])}
                  className="flex h-8 flex-1 rounded-md border bg-transparent px-1 py-1 text-sm"
                >
                  {FREQ_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {recInterval > 1 ? `${f.label}s` : f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={async () => {
                    await updateNote(note.id, { recurrence_rule: { freq: recFreq, interval: recInterval } });
                    setRecurrencePopoverOpen(false);
                    fetchNotes();
                  }}
                >
                  {note.recurrence_rule ? 'Update' : 'Set'}
                </Button>
                {note.recurrence_rule && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await notesApi.removeRecurrence(note.id);
                      setRecurrencePopoverOpen(false);
                      fetchNotes();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowHistory(!showHistory)}>
                <History className="h-4 w-4 mr-2" />
                Version history
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const newType = note.note_type === 'checklist' ? 'note' : 'checklist';
                updateNote(note.id, { note_type: newType });
              }}>
                {note.note_type === 'checklist' ? <FileText className="h-4 w-4 mr-2" /> : <ListChecks className="h-4 w-4 mr-2" />}
                {note.note_type === 'checklist' ? 'Convert to note' : 'Convert to checklist'}
              </DropdownMenuItem>
              {!note.is_completed && (
                <DropdownMenuItem onClick={() => completeNote(note.id)}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark complete
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <a href={exportApi.noteUrl(note.id)} download>
                  <Download className="h-4 w-4 mr-2" />
                  Export as .md
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => deleteNote(note.id)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Move to trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            isPastDue ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400' : 'bg-primary/10 text-primary'
          }`}>
            <CalendarClock className="h-3 w-3" />
            <span>Due {formatDueAt(note.due_at)}</span>
            {isPastDue && <span className="font-medium">(overdue)</span>}
          </div>
        )}

        {/* Recurrence indicator bar */}
        {note.recurrence_rule && (
          <div className="flex items-center gap-2 px-4 py-1 text-xs border-b bg-primary/5 text-primary">
            <Repeat className="h-3 w-3" />
            <span>{formatRecurrence(note.recurrence_rule)}</span>
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

        {/* Floating format toolbar (appears on text selection) */}
        {note.note_type !== 'checklist' && selectionCoords && (
          <FormatToolbar editorRef={editorRef} coords={selectionCoords} />
        )}

        {/* Editor / Preview with drag-and-drop */}
        <div
          className={`flex flex-1 overflow-hidden relative ${isDragOver ? 'ring-2 ring-primary ring-inset' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files.length) handleUploadFiles(e.dataTransfer.files);
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.items)
              .filter((item) => item.kind === 'file')
              .map((item) => item.getAsFile())
              .filter((f): f is File => f !== null);
            if (files.length > 0) {
              e.preventDefault();
              handleUploadFiles(files);
            }
          }}
        >
          {isDragOver && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-md pointer-events-none">
              <span className="text-sm font-medium text-primary">Drop to attach</span>
            </div>
          )}
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
                onSelectionChange={setSelectionCoords}
                className="h-full"
              />
            </div>
          )}
        </div>

        {/* Subtasks (only for top-level notes) */}
        {!note.parent_id && (
          <SubtaskList noteId={note.id} onOpenSubtask={handleOpenSubtask} />
        )}

        {/* Attachments */}
        <AttachmentPanel
          key={`attach-${note.id}-${attachKey}`}
          noteId={note.id}
          onInsert={(md) => editorRef.current?.insertAtCursor(md)}
        />

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
