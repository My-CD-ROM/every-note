import { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
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
import {
  parseChecklist,
  serializeChecklist,
  checklistProgress,
  type ChecklistItem,
} from '@/lib/checklist';

interface ChecklistEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function SortableChecklistItem({
  item,
  onToggle,
  onTextChange,
  onDelete,
  onKeyDown,
  focusId,
}: {
  item: ChecklistItem;
  onToggle: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onKeyDown: (id: string, e: React.KeyboardEvent<HTMLInputElement>) => void;
  focusId: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (focusId === item.id) {
      inputRef.current?.focus();
    }
  }, [focusId, item.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors',
        isDragging && 'bg-muted/80'
      )}
    >
      <button
        className="cursor-grab touch-none opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
      </button>

      <input
        type="checkbox"
        checked={item.checked}
        onChange={() => onToggle(item.id)}
        className="h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600 accent-indigo-500 cursor-pointer"
      />

      <input
        ref={inputRef}
        type="text"
        value={item.text}
        onChange={(e) => onTextChange(item.id, e.target.value)}
        onKeyDown={(e) => onKeyDown(item.id, e)}
        placeholder="Item text..."
        className={cn(
          'flex-1 bg-transparent border-0 outline-none text-sm py-0',
          item.checked && 'line-through text-muted-foreground'
        )}
      />

      <button
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-destructive/10 transition-all"
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  );
}

export function ChecklistEditor({ value, onChange }: ChecklistEditorProps) {
  const [items, setItems] = useState<ChecklistItem[]>(() => parseChecklist(value));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [quickAddText, setQuickAddText] = useState('');
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Re-parse when value changes externally (e.g. version restore)
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (value !== prevValueRef.current) {
      const serialized = serializeChecklist(items);
      if (value !== serialized) {
        setItems(parseChecklist(value));
      }
      prevValueRef.current = value;
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback(
    (newItems: ChecklistItem[]) => {
      setItems(newItems);
      const md = serializeChecklist(newItems);
      prevValueRef.current = md;
      onChange(md);
    },
    [onChange]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleToggle = useCallback(
    (id: string) => {
      commit(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
    },
    [items, commit]
  );

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      commit(items.map((i) => (i.id === id ? { ...i, text } : i)));
    },
    [items, commit]
  );

  const handleDelete = useCallback(
    (id: string) => {
      commit(items.filter((i) => i.id !== id));
    },
    [items, commit]
  );

  const handleKeyDown = useCallback(
    (id: string, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const idx = items.findIndex((i) => i.id === id);
        const newItem: ChecklistItem = {
          id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: '',
          checked: false,
        };
        const newItems = [...items];
        newItems.splice(idx + 1, 0, newItem);
        commit(newItems);
        setFocusId(newItem.id);
      } else if (e.key === 'Backspace' && (e.target as HTMLInputElement).value === '') {
        e.preventDefault();
        const idx = items.findIndex((i) => i.id === id);
        if (items.length > 0) {
          const newItems = items.filter((i) => i.id !== id);
          commit(newItems);
          // Focus the previous item, or next, or quick add
          if (idx > 0) {
            setFocusId(newItems[idx - 1].id);
          } else if (newItems.length > 0) {
            setFocusId(newItems[0].id);
          } else {
            quickAddRef.current?.focus();
          }
        }
      }
    },
    [items, commit]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newItems = [...items];
      const [moved] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, moved);
      commit(newItems);
    },
    [items, commit]
  );

  const handleQuickAdd = useCallback(() => {
    if (!quickAddText.trim()) return;
    const newItem: ChecklistItem = {
      id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: quickAddText.trim(),
      checked: false,
    };
    commit([...items, newItem]);
    setQuickAddText('');
    // Keep focus on quick add for consecutive entries
    quickAddRef.current?.focus();
  }, [quickAddText, items, commit]);

  const { done, total } = checklistProgress(items);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      {total > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">
              {done}/{total} completed
            </span>
            <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                done === total ? 'bg-emerald-500' : 'bg-indigo-500'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-1.5">
            <p className="text-sm">No items yet</p>
            <p className="text-xs text-muted-foreground/60">Add your first item below</p>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableChecklistItem
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onTextChange={handleTextChange}
                onDelete={handleDelete}
                onKeyDown={handleKeyDown}
                focusId={focusId}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Quick add input */}
      <div className="border-t px-4 py-2">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={quickAddRef}
            type="text"
            value={quickAddText}
            onChange={(e) => setQuickAddText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickAdd();
            }}
            placeholder="Add an item..."
            className="flex-1 bg-transparent border-0 outline-none text-sm py-1 placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
    </div>
  );
}
