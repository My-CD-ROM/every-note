import { useCallback } from 'react';
import { CalendarClock, FileText, FolderIcon, GripVertical, ListChecks, Star } from 'lucide-react';
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

function SortableNoteCard({ note, showFolder }: { note: NoteResponse; showFolder: boolean }) {
  const { activeNoteId, setActiveNote } = useNotesStore();
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

  const preview = note.content.slice(0, 80).replace(/[#*`>\-\[\]]/g, '').trim();
  const isPastDue = note.due_at ? new Date(note.due_at) < new Date() : false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-1.5 rounded-md px-2 py-1.5 transition-colors cursor-pointer',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800/70',
        isActive && 'bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-200 dark:ring-indigo-800'
      )}
      onClick={() => setActiveNote(note.id)}
    >
      {/* Drag handle */}
      <button
        className="mt-1 cursor-grab opacity-0 group-hover:opacity-100 touch-none shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-zinc-300 dark:text-zinc-600" />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-1.5">
          {note.is_pinned && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
          {note.note_type === 'checklist' && <ListChecks className="h-3 w-3 shrink-0 text-indigo-500" />}
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {note.title || 'Untitled'}
          </span>
        </div>

        {/* Preview */}
        {preview && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500 line-clamp-1 mt-0.5">
            {preview}
          </p>
        )}

        {/* Metadata row: date, folder, due, tags */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="text-[10px] text-zinc-400">{formatDate(note.updated_at)}</span>

          {showFolder && note.folder_id && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-400">
              <FolderIcon className="h-2.5 w-2.5" />
              <span className="truncate max-w-[60px]">folder</span>
            </span>
          )}

          {note.due_at && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[10px] font-medium rounded px-1 py-px',
              isPastDue
                ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                : 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
            )}>
              <CalendarClock className="h-2.5 w-2.5" />
              {formatDue(note.due_at)}
            </span>
          )}

          {note.note_type === 'checklist' && (() => {
            const { done, total } = checklistProgressFromContent(note.content);
            if (total === 0) return null;
            const isComplete = done === total;
            return (
              <span className={cn(
                'inline-flex items-center gap-0.5 text-[10px] font-medium rounded px-1 py-px',
                isComplete
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
              )}>
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
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 mt-0.5">
        <NoteActions note={note} />
      </div>
    </div>
  );
}

export function NoteList() {
  const { notes, loading } = useNotesStore();
  const view = useUIStore((s) => s.view);
  const showFolder = view === 'all' || view === 'favorites';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
        Loading...
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-1.5 px-4">
        <FileText className="h-6 w-6 stroke-1" />
        <p className="text-xs">No notes yet</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col p-1">
          {notes.map((note) => (
            <SortableNoteCard key={note.id} note={note} showFolder={showFolder} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
