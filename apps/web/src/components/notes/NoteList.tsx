import { useCallback, useMemo, useState } from 'react';
import { CalendarClock, ChevronRight, FileText, FolderIcon, GripVertical, ListChecks, Plus, Repeat, Search, Star } from 'lucide-react';
import { checklistProgressFromContent } from '@/lib/checklist';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/notes-store';
import { useFoldersStore } from '@/stores/folders-store';
import { NoteActions } from './NoteActions';
import { notesApi } from '@/lib/api';
import { useUIStore } from '@/stores/ui-store';
import type { NoteResponse } from '@/lib/api';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isThisYear) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function MetadataBadges({ note, showFolder }: { note: NoteResponse; showFolder: boolean }) {
  const folderMap = useFoldersStore((s) => s.folderMap);
  const isPastDue = note.due_at ? new Date(note.due_at) < new Date() : false;
  const folderName = note.folder_id ? folderMap[note.folder_id] : null;

  return (
    <>
      <span className="text-[10px] text-muted-foreground">{formatDate(note.updated_at)}</span>

      {showFolder && folderName && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <FolderIcon className="h-2.5 w-2.5" />
          <span className="truncate max-w-[80px]">{folderName}</span>
        </span>
      )}

      {note.due_at && (
        <span className={cn(
          'inline-flex items-center gap-0.5 text-[10px] font-medium rounded px-1 py-px',
          isPastDue
            ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
            : 'bg-primary/10 text-primary'
        )}>
          <CalendarClock className="h-2.5 w-2.5" />
          {formatDue(note.due_at)}
        </span>
      )}

      {note.recurrence_rule && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary rounded px-1 py-px bg-primary/10">
          <Repeat className="h-2.5 w-2.5" />
        </span>
      )}

      {note.note_type === 'checklist' && note.subtask_count === 0 && (() => {
        const { done, total } = checklistProgressFromContent(note.content);
        if (total === 0) return null;
        return (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium rounded px-1 py-px bg-primary/10 text-primary">
            <ListChecks className="h-2.5 w-2.5" />
            {done}/{total}
          </span>
        );
      })()}

      {note.tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-0.5 text-[10px] font-medium"
          style={{ color: tag.color }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: tag.color }}
          />
          {tag.name}
        </span>
      ))}
    </>
  );
}

function GridNoteCard({ note, showFolder }: { note: NoteResponse; showFolder: boolean }) {
  const { activeNoteId, setActiveNote, updateNote } = useNotesStore();
  const isActive = activeNoteId === note.id;

  return (
    <div
      className={cn(
        'group rounded-lg border border-border bg-card p-3 transition-colors cursor-pointer hover:border-primary/30 hover:bg-muted/50',
        isActive && 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
      )}
      onClick={() => setActiveNote(isActive ? null : note.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onClick={(e) => { e.stopPropagation(); updateNote(note.id, { is_pinned: !note.is_pinned }); }}
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-colors',
              note.is_pinned
                ? 'text-amber-400'
                : 'text-transparent group-hover:text-muted-foreground/30 hover:!text-amber-400'
            )}
          >
            <Star className={cn('h-3 w-3', note.is_pinned && 'fill-amber-400')} />
          </button>
          {note.note_type === 'checklist' && <ListChecks className="h-3 w-3 shrink-0 text-primary" />}
          <span className="text-sm font-medium text-foreground truncate">
            {note.title || 'Untitled'}
          </span>
        </div>
        <div className="shrink-0">
          <NoteActions note={note} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <MetadataBadges note={note} showFolder={showFolder} />
      </div>
    </div>
  );
}

function SortableNoteCard({ note, showFolder }: { note: NoteResponse; showFolder: boolean }) {
  const { activeNoteId, setActiveNote, updateNote } = useNotesStore();
  const isActive = activeNoteId === note.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-1.5 rounded-md px-2 py-1 transition-colors cursor-pointer',
        'hover:bg-muted',
        isActive && 'bg-primary/10 ring-1 ring-primary/30'
      )}
      onClick={() => setActiveNote(isActive ? null : note.id)}
    >
      {/* Drag handle */}
      <button
        className="mt-1 cursor-grab opacity-0 group-hover:opacity-100 touch-none shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground/40" />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); updateNote(note.id, { is_pinned: !note.is_pinned }); }}
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-colors',
              note.is_pinned
                ? 'text-amber-400'
                : 'text-transparent group-hover:text-muted-foreground/30 hover:!text-amber-400'
            )}
          >
            <Star className={cn('h-3 w-3', note.is_pinned && 'fill-amber-400')} />
          </button>
          {note.note_type === 'checklist' && <ListChecks className="h-3 w-3 shrink-0 text-primary" />}
          <span className="text-sm font-medium text-foreground truncate">
            {note.title || 'Untitled'}
          </span>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <MetadataBadges note={note} showFolder={showFolder} />
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 mt-0.5">
        <NoteActions note={note} />
      </div>
    </div>
  );
}

type NoteGroup = { label: string; notes: NoteResponse[] };

function groupNotes(notes: NoteResponse[]): NoteGroup[] {
  const pinned: NoteResponse[] = [];
  const general: NoteResponse[] = [];

  for (const note of notes) {
    if (note.is_pinned) pinned.push(note);
    else general.push(note);
  }

  const groups: NoteGroup[] = [];
  if (pinned.length > 0) groups.push({ label: 'Pinned', notes: pinned });
  if (general.length > 0) groups.push({ label: 'General', notes: general });
  return groups;
}

function GroupHeader({ label, count, open, onToggle }: { label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1 px-2 py-1 w-full text-left group/header"
    >
      <ChevronRight className={cn('h-3 w-3 text-muted-foreground/60 transition-transform', open && 'rotate-90')} />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</span>
      <span className="text-[10px] text-muted-foreground/40">{count}</span>
    </button>
  );
}

export function NoteList({ expanded = false }: { expanded?: boolean }) {
  const { notes, loading, createNote } = useNotesStore();
  const view = useUIStore((s) => s.view);
  const activeFolderId = useFoldersStore((s) => s.activeFolderId);
  const showFolder = view === 'all' || view === 'favorites';
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = notes.findIndex((n) => n.id === active.id);
      const newIndex = notes.findIndex((n) => n.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const before = newIndex > 0 ? notes[newIndex - 1].position : 0;
      const after = newIndex < notes.length - 1 ? notes[newIndex + 1].position : before + 2;
      const newPosition = (before + after) / 2;

      notesApi.reorder([{ id: active.id as string, position: newPosition }]);
    },
    [notes]
  );

  const filtered = useMemo(() => {
    if (!filter.trim()) return notes;
    const q = filter.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, filter]);

  const groups = useMemo(() => groupNotes(filtered), [filtered]);
  const allNoteIds = useMemo(() => filtered.map((n) => n.id), [filtered]);

  const toggleGroup = useCallback((label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  if (notes.length === 0) {
    const emptyLabel = view === 'trash' ? 'Trash is empty'
      : view === 'completed' ? 'No completed notes'
      : view === 'favorites' ? 'No favorites yet'
      : 'No notes yet';

    const canCreate = !['trash', 'completed'].includes(view);

    return (
      <div className={cn(
        'flex flex-col items-center justify-center text-muted-foreground gap-2 px-4',
        expanded ? 'py-24' : 'py-12'
      )}>
        <FileText className="h-8 w-8 stroke-1" />
        <p className="text-sm">{emptyLabel}</p>
        {canCreate && (
          <button
            onClick={() => createNote({ folder_id: view === 'folder' ? activeFolderId : null })}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Create your first note
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Filter input */}
      <div className="px-2 py-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Filter notes..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full h-7 pl-7 pr-2 rounded-md bg-muted/50 border border-border/50 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
          />
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-1 px-4">
          <Search className="h-5 w-5 stroke-1" />
          <p className="text-xs">No matching notes</p>
        </div>
      )}

      {expanded ? (
        /* Grid layout for expanded view */
        <div className="flex flex-col">
          {groups.map((group) => (
            <div key={group.label}>
              <GroupHeader
                label={group.label}
                count={group.notes.length}
                open={!collapsed[group.label]}
                onToggle={() => toggleGroup(group.label)}
              />
              {!collapsed[group.label] && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 px-2 pb-2">
                  {group.notes.map((note) => (
                    <GridNoteCard key={note.id} note={note} showFolder={showFolder} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Compact list layout with drag-and-drop */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={allNoteIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col">
              {groups.map((group) => (
                <div key={group.label}>
                  <GroupHeader
                    label={group.label}
                    count={group.notes.length}
                    open={!collapsed[group.label]}
                    onToggle={() => toggleGroup(group.label)}
                  />
                  {!collapsed[group.label] && (
                    <div className="flex flex-col px-1">
                      {group.notes.map((note) => (
                        <SortableNoteCard key={note.id} note={note} showFolder={showFolder} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
