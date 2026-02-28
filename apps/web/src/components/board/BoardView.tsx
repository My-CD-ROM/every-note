import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CalendarClock, Check, CheckCircle2, GripVertical, ListChecks, Star } from 'lucide-react';
import { checklistProgressFromContent } from '@/lib/checklist';
import { STATUSES } from '@/lib/statuses';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/notes-store';
import { notesApi } from '@/lib/api';
import type { NoteResponse } from '@/lib/api';

interface StatusColumn {
  id: string;
  label: string;
  color: string;
  notes: NoteResponse[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function BoardInlineSubtasks({ noteId }: { noteId: string }) {
  const [subtasks, setSubtasks] = useState<NoteResponse[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    notesApi.listSubtasks(noteId).then((data) => {
      setSubtasks(data);
      setLoaded(true);
    });
  }, [noteId]);

  if (!loaded || subtasks.length === 0) return null;

  const toggleComplete = async (e: React.MouseEvent, subtask: NoteResponse) => {
    e.stopPropagation();
    if (subtask.is_completed) {
      await notesApi.uncomplete(subtask.id);
    } else {
      await notesApi.complete(subtask.id);
    }
    const data = await notesApi.listSubtasks(noteId);
    setSubtasks(data);
  };

  const completedCount = subtasks.filter((s) => s.is_completed).length;

  return (
    <div className="mt-1.5 ml-[18px] space-y-0.5">
      {subtasks.slice(0, 4).map((sub) => (
        <div key={sub.id} className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => toggleComplete(e, sub)}
            className={cn(
              'h-3 w-3 rounded border shrink-0 flex items-center justify-center transition-colors',
              sub.is_completed
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'border-muted-foreground/30 hover:border-muted-foreground/60'
            )}
          >
            {sub.is_completed && <Check className="h-2 w-2" />}
          </button>
          <span className={cn(
            'text-[11px] truncate',
            sub.is_completed ? 'line-through text-muted-foreground/50' : 'text-muted-foreground'
          )}>
            {sub.title || 'Untitled'}
          </span>
        </div>
      ))}
      {subtasks.length > 4 && (
        <span className="text-[10px] text-muted-foreground/50 pl-[18px]">+{subtasks.length - 4} more</span>
      )}
      <div className="flex items-center gap-1.5 pt-0.5">
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${(completedCount / subtasks.length) * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground/50 shrink-0">{completedCount}/{subtasks.length}</span>
      </div>
    </div>
  );
}

function NoteCardContent({ note, isDragging }: { note: NoteResponse; isDragging?: boolean }) {
  const { activeNoteId, completeNote } = useNotesStore();
  const isActive = activeNoteId === note.id;
  const preview = note.content.slice(0, 80).replace(/[#*`>\-\[\]]/g, '').trim();
  const isPastDue = note.due_at ? new Date(note.due_at) < new Date() : false;
  const { done: doneCount, total: totalCount } = checklistProgressFromContent(note.content);
  const isDone = note.status === 'done';

  return (
    <div
      className={cn(
        'group/card rounded-lg border px-3 py-2.5 transition-all',
        'bg-card border-border/60',
        'hover:border-border hover:shadow-md',
        isActive && 'ring-2 ring-primary/40 border-primary/30',
        isDragging && 'shadow-lg rotate-2 scale-105 opacity-90',
        isDone && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-1.5">
        <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0 cursor-grab" />
        {note.is_pinned && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
        <span className={cn(
          'text-sm font-medium text-foreground truncate',
          isDone && 'line-through text-muted-foreground',
        )}>
          {note.title || 'Untitled'}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); completeNote(note.id); }}
          className="ml-auto opacity-0 group-hover/card:opacity-100 shrink-0 p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-all"
          title="Mark complete"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-emerald-500" />
        </button>
      </div>
      {note.subtask_count > 0 ? (
        <BoardInlineSubtasks noteId={note.id} />
      ) : preview ? (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 ml-[18px]">{preview}</p>
      ) : null}
      <div className="flex items-center gap-1.5 mt-1.5 ml-[18px] flex-wrap">
        <span className="text-[10px] text-muted-foreground/70">{formatDate(note.updated_at)}</span>
        {note.due_at && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-px',
            isPastDue
              ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
              : 'bg-primary/10 text-primary'
          )}>
            <CalendarClock className="h-2.5 w-2.5" />
            {formatDate(note.due_at)}
          </span>
        )}
        {totalCount > 0 && note.subtask_count === 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
            <ListChecks className="h-2.5 w-2.5" />
            {doneCount}/{totalCount}
          </span>
        )}
        {note.tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-px"
            style={{ color: tag.color, backgroundColor: `${tag.color}18` }}
          >
            {tag.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function DraggableNoteCard({ note }: { note: NoteResponse }) {
  const { setActiveNote } = useNotesStore();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: note.id,
    data: { note },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 50 : undefined,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn('cursor-pointer', isDragging && 'opacity-30')}
      onClick={() => setActiveNote(note.id)}
    >
      <NoteCardContent note={note} />
    </div>
  );
}

function QuickAddInput({ status }: { status: string }) {
  const [title, setTitle] = useState('');
  const { createNote } = useNotesStore();

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await createNote({ title: title.trim(), status });
    setTitle('');
  };

  return (
    <input
      placeholder="+ Add note..."
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') { setTitle(''); (e.target as HTMLInputElement).blur(); } }}
      className="w-full text-xs px-3 py-2 mt-2 rounded-lg border border-dashed border-border/50 bg-transparent text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:bg-card transition-all"
    />
  );
}

function DroppableColumn({ column, isOver }: { column: StatusColumn; isOver: boolean }) {
  return (
    <div className={cn(
      'flex-shrink-0 w-72 flex flex-col max-h-full rounded-xl p-3 transition-all',
      isOver && 'bg-primary/5 ring-2 ring-primary/20 ring-dashed',
    )}>
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: column.color }}
        />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {column.label}
        </h3>
        <span className="text-[10px] text-muted-foreground/50 tabular-nums ml-auto bg-muted rounded-full px-1.5 py-px">
          {column.notes.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
        {column.notes.map((note) => (
          <DraggableNoteCard key={note.id} note={note} />
        ))}
      </div>
      <QuickAddInput status={column.id} />
    </div>
  );
}

function DroppableColumnWrapper({ column }: { column: StatusColumn }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `status-${column.id}`,
    data: { status: column.id },
  });

  return (
    <div ref={setNodeRef} className="flex-shrink-0">
      <DroppableColumn column={column} isOver={isOver} />
    </div>
  );
}

export function BoardView() {
  const { notes, fetchNotes } = useNotesStore();
  const [activeDragNote, setActiveDragNote] = useState<NoteResponse | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Board shows all notes — assign status 'backlog' to notes without one
  const columns = useMemo<StatusColumn[]>(() => {
    const byStatus = new Map<string, NoteResponse[]>();
    for (const s of STATUSES) {
      byStatus.set(s.id, []);
    }

    for (const note of notes) {
      if (note.parent_id) continue; // subtasks don't appear as cards
      const st = note.status || 'backlog';
      const arr = byStatus.get(st);
      if (arr) arr.push(note);
      else byStatus.get('backlog')!.push(note);
    }

    return STATUSES.map((s) => ({
      id: s.id,
      label: s.label,
      color: s.color,
      notes: byStatus.get(s.id) || [],
    }));
  }, [notes]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const note = notes.find((n) => n.id === event.active.id);
    setActiveDragNote(note || null);
  }, [notes]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragNote(null);
    const { active, over } = event;
    if (!over) return;

    const noteId = active.id as string;
    const overId = over.id as string;

    if (!overId.startsWith('status-')) return;
    const targetStatus = overId.replace('status-', '');

    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const currentStatus = note.status || 'backlog';
    if (currentStatus === targetStatus) return;

    // Optimistic update
    useNotesStore.setState((s) => ({
      notes: s.notes.map((n) => (n.id === noteId ? { ...n, status: targetStatus } : n)),
    }));

    try {
      await notesApi.setStatus(noteId, targetStatus);
    } catch {
      fetchNotes(); // Revert on error
    }
  }, [notes, fetchNotes]);

  if (notes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        No notes yet. Create one with the + input below each column.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-4 overflow-x-auto h-full items-start">
        {columns.map((col) => (
          <DroppableColumnWrapper key={col.id} column={col} />
        ))}
      </div>
      <DragOverlay>
        {activeDragNote && (
          <div className="w-72">
            <NoteCardContent note={activeDragNote} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
