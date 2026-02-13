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
import { CalendarClock, CheckCircle2, FolderIcon, GripVertical, Inbox, ListChecks, Star } from 'lucide-react';
import { checklistProgressFromContent } from '@/lib/checklist';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/notes-store';
import { useFoldersStore } from '@/stores/folders-store';
import type { NoteResponse, FolderTree } from '@/lib/api';

interface Column {
  id: string | null;
  name: string;
  icon: string | null;
  notes: NoteResponse[];
}

function flattenFolders(tree: FolderTree[]): { id: string; name: string; icon: string | null }[] {
  const result: { id: string; name: string; icon: string | null }[] = [];
  function walk(nodes: FolderTree[]) {
    for (const node of nodes) {
      result.push({ id: node.id, name: node.name, icon: node.icon });
      walk(node.children);
    }
  }
  walk(tree);
  return result;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function NoteCardContent({ note, isDragging }: { note: NoteResponse; isDragging?: boolean }) {
  const { activeNoteId, completeNote } = useNotesStore();
  const isActive = activeNoteId === note.id;
  const preview = note.content.slice(0, 80).replace(/[#*`>\-\[\]]/g, '').trim();
  const isPastDue = note.due_at ? new Date(note.due_at) < new Date() : false;
  const { done: doneCount, total: totalCount } = checklistProgressFromContent(note.content);

  return (
    <div
      className={cn(
        'group/card rounded-lg border px-3 py-2.5 transition-all',
        'bg-card border-border/60',
        'hover:border-border hover:shadow-md',
        isActive && 'ring-2 ring-primary/40 border-primary/30',
        isDragging && 'shadow-lg rotate-2 scale-105 opacity-90',
      )}
    >
      <div className="flex items-center gap-1.5">
        <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0 cursor-grab" />
        {note.is_pinned && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
        <span className="text-sm font-medium text-foreground truncate">
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
      {preview && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 ml-[18px]">{preview}</p>
      )}
      <div className="flex items-center gap-1.5 mt-1.5 ml-[18px] flex-wrap">
        <span className="text-[10px] text-muted-foreground/70">{formatDate(note.updated_at)}</span>
        {note.due_at && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-px',
            isPastDue
              ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
              : 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
          )}>
            <CalendarClock className="h-2.5 w-2.5" />
            {formatDate(note.due_at)}
          </span>
        )}
        {totalCount > 0 && (
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

function QuickAddInput({ folderId }: { folderId: string | null }) {
  const [title, setTitle] = useState('');
  const { createNote } = useNotesStore();

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await createNote({ title: title.trim(), folder_id: folderId });
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

function DroppableColumn({ column, isOver }: { column: Column; isOver: boolean }) {
  const isUnfiled = column.id === null;

  return (
    <div className={cn(
      'flex-shrink-0 w-64 flex flex-col max-h-full rounded-xl p-3 transition-all',
      isOver && 'bg-primary/5 ring-2 ring-primary/20 ring-dashed',
    )}>
      <div className="flex items-center gap-1.5 mb-3 px-0.5">
        {column.icon ? (
          <span className="text-sm shrink-0">{column.icon}</span>
        ) : isUnfiled ? (
          <Inbox className="h-3.5 w-3.5 text-muted-foreground/60" />
        ) : (
          <FolderIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
        )}
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {column.name}
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
      <QuickAddInput folderId={column.id} />
    </div>
  );
}

function DroppableColumnWrapper({ column }: { column: Column }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id ?? '_unfiled'}`,
    data: { folderId: column.id },
  });

  return (
    <div ref={setNodeRef} className="flex-shrink-0">
      <DroppableColumn column={column} isOver={isOver} />
    </div>
  );
}

export function BoardView() {
  const { notes, updateNote } = useNotesStore();
  const { tree, fetchTree } = useFoldersStore();
  const [activeDragNote, setActiveDragNote] = useState<NoteResponse | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const columns = useMemo<Column[]>(() => {
    const folders = flattenFolders(tree);
    const byFolder = new Map<string, NoteResponse[]>();

    for (const note of notes) {
      if (note.folder_id) {
        const existing = byFolder.get(note.folder_id) || [];
        existing.push(note);
        byFolder.set(note.folder_id, existing);
      }
    }

    const cols: Column[] = folders.map((f) => ({
      id: f.id,
      name: f.name,
      icon: f.icon,
      notes: byFolder.get(f.id) || [],
    }));

    const unfiled = notes.filter((n) => !n.folder_id);
    if (unfiled.length > 0 || cols.length === 0) {
      cols.push({ id: null, name: 'Unfiled', icon: null, notes: unfiled });
    }

    return cols;
  }, [notes, tree]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const note = notes.find((n) => n.id === event.active.id);
    setActiveDragNote(note || null);
  }, [notes]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragNote(null);
    const { active, over } = event;
    if (!over) return;

    const noteId = active.id as string;
    const overId = over.id as string;

    let targetFolderId: string | null = null;
    if (overId.startsWith('column-')) {
      const folderId = overId.replace('column-', '');
      targetFolderId = folderId === '_unfiled' ? null : folderId;
    } else {
      return;
    }

    const note = notes.find((n) => n.id === noteId);
    if (!note || note.folder_id === targetFolderId) return;

    updateNote(noteId, { folder_id: targetFolderId });
  }, [notes, updateNote]);

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
          <DroppableColumnWrapper key={col.id ?? '_unfiled'} column={col} />
        ))}
      </div>
      <DragOverlay>
        {activeDragNote && (
          <div className="w-64">
            <NoteCardContent note={activeDragNote} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
