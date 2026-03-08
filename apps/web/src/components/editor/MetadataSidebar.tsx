import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarClock, Check, CheckCircle2, Clock, FolderIcon, Plus, Repeat, Star, Tag, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useTagsStore } from '@/stores/tags-store';
import { useFoldersStore } from '@/stores/folders-store';
import { notesApi, remindersApi } from '@/lib/api';
import type { FolderTree, RecurrenceRule, ReminderResponse } from '@/lib/api';
import { STATUSES } from '@/lib/statuses';
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

function flattenFolders(tree: FolderTree[], depth = 0): Array<FolderTree & { depth: number }> {
  const result: Array<FolderTree & { depth: number }> = [];
  for (const f of tree) {
    result.push({ ...f, depth });
    result.push(...flattenFolders(f.children, depth + 1));
  }
  return result;
}

const LABEL = 'text-xs font-medium text-muted-foreground uppercase tracking-wide';

const REMINDER_OPTIONS = [
  { label: 'In 15 minutes', minutes: 15 },
  { label: 'In 1 hour', minutes: 60 },
  { label: 'In 3 hours', minutes: 180 },
  { label: 'Tomorrow 9 AM', minutes: -1 },
] as const;

interface Props {
  hook: ReturnType<typeof useNoteEditor>;
}

export function MetadataSidebar({ hook }: Props) {
  const {
    note,
    activeNoteId,
    fetchNotes,
    updateNote,
    deleteNote,
    completeNote,
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
    handleSetDue,
    handleClearDue,
  } = hook;

  const { tags: allTags, fetchTags, createTag } = useTagsStore();
  const { tree, fetchTree } = useFoldersStore();
  const [newTagName, setNewTagName] = useState('');
  const [noteReminders, setNoteReminders] = useState<ReminderResponse[]>([]);

  const refetchNotes = () => fetchNotes(note?.project_id ? { project_id: note.project_id } : undefined);

  const fetchNoteReminders = useCallback(async (noteId: string) => {
    try {
      const data = await remindersApi.list(noteId);
      setNoteReminders(data.filter((r) => !r.is_fired && !r.is_dismissed));
    } catch {
      setNoteReminders([]);
    }
  }, []);

  useEffect(() => {
    fetchTags(note?.project_id ?? undefined);
    fetchTree();
    if (note?.id) fetchNoteReminders(note.id);
  }, [fetchTags, fetchTree, note?.project_id, note?.id, fetchNoteReminders]);

  if (!note) return null;

  const folders = flattenFolders(tree);

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {/* 1. Status (project tasks only) */}
      {note.project_id && (
        <section>
          <div className={LABEL}>Status</div>
          <div className="mt-1.5 space-y-0.5">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors ${
                  note.status === s.id ? 'bg-muted font-medium' : 'hover:bg-muted/50'
                }`}
                onClick={async () => {
                  await notesApi.setStatus(note.id, note.status === s.id ? null : s.id);
                  refetchNotes();
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
                {note.status === s.id && <Check className="h-3 w-3 ml-auto text-primary" />}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 2. Due date */}
      <section>
        <div className={LABEL}>Due date</div>
        <div className="mt-1.5">
          {note.due_at && (
            <div className="flex items-center gap-1.5 text-sm mb-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className={new Date(note.due_at) < new Date() ? 'text-destructive' : ''}>
                {new Date(note.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {' '}
                {new Date(note.due_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                className="ml-auto text-muted-foreground hover:text-foreground"
                onClick={handleClearDue}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <Popover open={duePopoverOpen} onOpenChange={setDuePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                <CalendarClock className="h-3.5 w-3.5 mr-1.5" />
                {note.due_at ? 'Change' : 'Set due date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 space-y-3">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} />
                <div className="flex items-center gap-2 px-1">
                  <label className="text-xs text-muted-foreground shrink-0">Time:</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="flex h-8 w-full rounded-md border bg-transparent px-2 py-1 text-sm"
                  />
                </div>
                <Button size="sm" className="w-full" onClick={handleSetDue} disabled={!dueDate}>
                  Set due date
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </section>

      {/* 3. Tags */}
      <section>
        <div className={LABEL}>Tags</div>
        <div className="mt-1.5">
          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {note.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5"
                  style={{ color: tag.color, backgroundColor: `${tag.color}18` }}
                >
                  {tag.name}
                  <button
                    className="hover:opacity-70"
                    onClick={async () => {
                      await notesApi.removeTag(note.id, tag.id);
                      refetchNotes();
                    }}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                <Tag className="h-3.5 w-3.5 mr-1.5" />
                Add tag
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              {allTags.length === 0 && (
                <div className="text-xs text-muted-foreground/60 px-2 py-2">No tags yet.</div>
              )}
              {allTags.map((tag) => {
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
                      refetchNotes();
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
              <div className="border-t mt-1 pt-1">
                <form
                  className="flex items-center gap-1 px-1"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newTagName.trim()) return;
                    const tag = await createTag({
                      name: newTagName.trim(),
                      project_id: note.project_id ?? undefined,
                    });
                    await notesApi.addTag(note.id, tag.id);
                    setNewTagName('');
                    refetchNotes();
                  }}
                >
                  <input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="New tag..."
                    className="flex h-7 flex-1 rounded-md border bg-transparent px-2 text-xs"
                  />
                  <Button type="submit" size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </section>

      {/* 4-8: Notes-only sections (hidden for project tasks) */}
      {!note.project_id && (
        <>
          {/* 4. Recurrence */}
          <section>
            <div className={LABEL}>Recurrence</div>
            <div className="mt-1.5">
              {note.recurrence_rule && (
                <div className="flex items-center gap-1.5 text-sm mb-1.5">
                  <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{formatRecurrence(note.recurrence_rule)}</span>
                  <button
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    onClick={async () => {
                      await notesApi.removeRecurrence(note.id);
                      refetchNotes();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <Popover open={recurrencePopoverOpen} onOpenChange={setRecurrencePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                    <Repeat className="h-3.5 w-3.5 mr-1.5" />
                    {note.recurrence_rule ? 'Edit' : 'Set recurrence'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-3" align="start">
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
                  <Button
                    size="sm"
                    className="w-full mt-3"
                    onClick={async () => {
                      await updateNote(note.id, { recurrence_rule: { freq: recFreq, interval: recInterval } });
                      setRecurrencePopoverOpen(false);
                      refetchNotes();
                    }}
                  >
                    {note.recurrence_rule ? 'Update' : 'Set'}
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          </section>

          {/* 5. Folder */}
          <section>
            <div className={LABEL}>Folder</div>
            <div className="mt-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                    <FolderIcon className="h-3.5 w-3.5 mr-1.5" />
                    {note.folder_id
                      ? folders.find((f) => f.id === note.folder_id)?.name || 'Unknown'
                      : 'No folder'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  <button
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors ${
                      !note.folder_id ? 'font-medium' : ''
                    }`}
                    onClick={() => updateNote(note.id, { folder_id: null })}
                  >
                    No folder
                    {!note.folder_id && <Check className="h-3 w-3 ml-auto text-primary" />}
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors ${
                        note.folder_id === f.id ? 'font-medium' : ''
                      }`}
                      style={{ paddingLeft: `${f.depth * 12 + 8}px` }}
                      onClick={() => updateNote(note.id, { folder_id: f.id })}
                    >
                      {f.name}
                      {note.folder_id === f.id && <Check className="h-3 w-3 ml-auto text-primary" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          </section>

          {/* 6. Reminder */}
          <section>
            <div className={LABEL}>Reminder</div>
            <div className="mt-1.5">
              {noteReminders.length > 0 && (
                <div className="space-y-1 mb-1.5">
                  {noteReminders.map((r) => (
                    <div key={r.id} className="flex items-center gap-1.5 text-sm">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className={new Date(r.remind_at) < new Date() ? 'text-destructive' : ''}>
                        {new Date(r.remind_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {' '}
                        {new Date(r.remind_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        className="ml-auto text-muted-foreground hover:text-foreground"
                        onClick={async () => {
                          await remindersApi.delete(r.id);
                          fetchNoteReminders(note.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Popover open={reminderPopoverOpen} onOpenChange={setReminderPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                    <Bell className="h-3.5 w-3.5 mr-1.5" />
                    {noteReminders.length > 0 ? 'Add another' : 'Set reminder'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1" align="start">
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1">Remind me</div>
                  {REMINDER_OPTIONS.map((opt) => (
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
                        fetchNoteReminders(activeNoteId);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          </section>

          {/* 7. Separator */}
          <Separator />

          {/* 8. Actions */}
          <section className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => updateNote(note.id, { is_pinned: !note.is_pinned })}
            >
              <Star className={`h-3.5 w-3.5 mr-1.5 ${note.is_pinned ? 'fill-amber-400 text-amber-400' : ''}`} />
              {note.is_pinned ? 'Unfavorite' : 'Favorite'}
            </Button>
            {!note.is_completed && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => completeNote(note.id)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Mark complete
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-destructive hover:text-destructive"
              onClick={() => deleteNote(note.id)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Move to trash
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
