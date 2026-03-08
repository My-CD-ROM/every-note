import { useCallback, useEffect, useState } from 'react';
import { Bell, Bold, CalendarClock, Check, CheckCircle2, ChevronRight, Code, FileText, Heading2, History, Italic, Link as LinkIcon, List, ListChecks, Loader2, MoreHorizontal, Paperclip, Repeat, Star, Tag, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownEditor } from './MarkdownEditor';
import { ChecklistEditor } from './ChecklistEditor';
import { FormatToolbar } from './FormatToolbar';
import { VersionHistory } from './VersionHistory';
import { Backlinks } from './Backlinks';
import { AttachmentPanel } from './AttachmentPanel';
import { notesApi, remindersApi } from '@/lib/api';
import type { RecurrenceRule, ReminderResponse } from '@/lib/api';
import type { useNoteEditor } from '@/hooks/useNoteEditor';

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

interface Props {
  hook: ReturnType<typeof useNoteEditor>;
  onClose: () => void;
}

export function NoteEditorContent({ hook, onClose }: Props) {
  const {
    note,
    activeNoteId,
    tags,
    fetchNotes,
    updateNote,
    deleteNote,
    completeNote,
    uncompleteNote,
    parentStack,
    handleOpenSubtask,
    handleBreadcrumbNav,
    title,
    content,
    dirty,
    saving,
    justSaved,
    showHistory,
    setShowHistory,
    selectionCoords,
    setSelectionCoords,
    dueDate,
    setDueDate,
    dueTime,
    setDueTime,
    duePopoverOpen,
    setDuePopoverOpen,
    tagPopoverOpen,
    setTagPopoverOpen,
    recurrencePopoverOpen,
    setRecurrencePopoverOpen,
    recFreq,
    setRecFreq,
    recInterval,
    setRecInterval,
    reminderPopoverOpen,
    setReminderPopoverOpen,
    isDragOver,
    setIsDragOver,
    uploading,
    attachKey,
    fileInputRef,
    editorRef,
    wrapperRef,
    flushSave,
    handleTitleChange,
    handleContentChange,
    handleTitleKeyDown,
    handleSetDue,
    handleClearDue,
    handleVersionRestore,
    handleUploadFiles,
  } = hook;

  const [noteReminders, setNoteReminders] = useState<ReminderResponse[]>([]);

  const fetchNoteReminders = useCallback(async (noteId: string) => {
    try {
      const data = await remindersApi.list(noteId);
      setNoteReminders(data.filter((r: ReminderResponse) => !r.is_fired && !r.is_dismissed));
    } catch {
      setNoteReminders([]);
    }
  }, []);

  useEffect(() => {
    if (note?.id) fetchNoteReminders(note.id);
  }, [note?.id, fetchNoteReminders]);

  if (!note) {
    return null;
  }

  const isPastDue = note.due_at && new Date(note.due_at) < new Date();

  return (
    <div ref={wrapperRef} className="flex max-h-[85vh] animate-fade-in-up">
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

        {/* Top toolbar: close + title + save status + action buttons */}
        <div className="flex items-center gap-1 border-b px-4 py-2 bg-background/50">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => { flushSave(); onClose(); }}
            title="Close note (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
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
              <span className="flex items-center gap-1 text-[10px] text-primary">
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
                className="h-8 w-8 shrink-0 relative"
                title="Set reminder"
              >
                <Bell className="h-4 w-4" />
                {noteReminders.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px] rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center px-0.5">
                    {noteReminders.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="end">
              {noteReminders.length > 0 && (
                <div className="border-b mb-1 pb-1">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">Active</div>
                  {noteReminders.map((r) => (
                    <div key={r.id} className="flex items-center gap-1.5 px-2 py-1 text-xs group">
                      <span className={new Date(r.remind_at) < new Date() ? 'text-destructive' : 'text-foreground'}>
                        {new Date(r.remind_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {' '}
                        {new Date(r.remind_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        className="ml-auto text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={async () => {
                          await remindersApi.delete(r.id);
                          if (activeNoteId) fetchNoteReminders(activeNoteId);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                    fetchNoteReminders(activeNoteId);
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
          <div className="flex items-center gap-2 px-4 py-1.5 text-xs border-b bg-primary/5 dark:bg-primary/10 text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Completed {note.completed_at ? new Date(note.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
            <button
              onClick={() => uncompleteNote(note.id)}
              className="ml-auto flex items-center gap-1 hover:opacity-80 transition-colors"
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

        {/* Floating format toolbar (appears on text selection, notes only) */}
        {note.note_type !== 'checklist' && selectionCoords && (
          <FormatToolbar editorRef={editorRef} coords={selectionCoords} />
        )}

        {/* Fixed formatting bar — notes only */}
        {note.note_type !== 'checklist' && (
          <div className="flex items-center gap-0.5 border-b px-2 py-1 bg-muted/30 shrink-0 overflow-x-auto">
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Checkbox" onClick={() => editorRef.current?.insertAtCursor('\n- [ ] ')}>
              <ListChecks className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Bold" onClick={() => editorRef.current?.wrapSelection('**', '**')}>
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Italic" onClick={() => editorRef.current?.wrapSelection('*', '*')}>
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Heading" onClick={() => editorRef.current?.insertAtCursor('\n## ')}>
              <Heading2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Bullet list" onClick={() => editorRef.current?.insertAtCursor('\n- ')}>
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Code" onClick={() => editorRef.current?.wrapSelection('`', '`')}>
              <Code className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Link" onClick={() => editorRef.current?.wrapSelection('[', '](url)')}>
              <LinkIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Editor area with drag-and-drop */}
        <div
          className={`flex flex-1 min-h-[200px] overflow-hidden relative ${isDragOver ? 'ring-2 ring-primary ring-inset' : ''}`}
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
          <ScrollArea className="w-full">
            {note.note_type === 'checklist' ? (
              <ChecklistEditor value={content} onChange={handleContentChange} />
            ) : (
              <MarkdownEditor
                ref={editorRef}
                value={content}
                onChange={handleContentChange}
                onSelectionChange={setSelectionCoords}
                className="h-full"
              />
            )}
          </ScrollArea>
        </div>

        <AttachmentPanel
          key={`attach-${note.id}-${attachKey}`}
          noteId={note.id}
          onInsert={(md) => editorRef.current?.insertAtCursor(md)}
        />

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
