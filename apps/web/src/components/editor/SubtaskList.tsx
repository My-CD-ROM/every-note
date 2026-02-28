import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { notesApi } from '@/lib/api';
import type { NoteResponse } from '@every-note/shared';

interface SubtaskListProps {
  noteId: string;
  onOpenSubtask: (subtaskId: string) => void;
}

export function SubtaskList({ noteId, onOpenSubtask }: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<NoteResponse[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchSubtasks = useCallback(async () => {
    const data = await notesApi.listSubtasks(noteId);
    setSubtasks(data);
  }, [noteId]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  const handleAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setAdding(true);
    await notesApi.create({ title: trimmed, parent_id: noteId });
    setNewTitle('');
    setAdding(false);
    fetchSubtasks();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const toggleComplete = async (subtask: NoteResponse) => {
    if (subtask.is_completed) {
      await notesApi.uncomplete(subtask.id);
    } else {
      await notesApi.complete(subtask.id);
    }
    fetchSubtasks();
  };

  const handleDelete = async (subtaskId: string) => {
    await notesApi.delete(subtaskId, true);
    fetchSubtasks();
  };

  const completedCount = subtasks.filter((s) => s.is_completed).length;
  const totalCount = subtasks.length;

  if (totalCount === 0 && collapsed) {
    setCollapsed(false);
  }

  return (
    <div className="border-t">
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Subtasks
        </button>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
        )}
        {totalCount > 0 && (
          <div className="flex-1 max-w-[120px] h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-4 pb-3 space-y-1">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
              <button
                onClick={() => toggleComplete(subtask)}
                className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                  subtask.is_completed
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-muted-foreground/30 hover:border-muted-foreground/60'
                }`}
              >
                {subtask.is_completed && <Check className="h-3 w-3" />}
              </button>
              <button
                onClick={() => onOpenSubtask(subtask.id)}
                className={`flex-1 text-left text-sm truncate hover:underline ${
                  subtask.is_completed ? 'line-through text-muted-foreground' : ''
                }`}
              >
                {subtask.title || 'Untitled'}
              </button>
              {subtask.due_at && (
                <span className={`text-[10px] shrink-0 ${
                  new Date(subtask.due_at) < new Date() ? 'text-red-500' : 'text-muted-foreground'
                }`}>
                  {new Date(subtask.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600"
                onClick={() => handleDelete(subtask.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {/* Add subtask input */}
          <div className="flex items-center gap-2 px-2 pt-1">
            <Plus className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add subtask..."
              disabled={adding}
              className="h-7 border-0 px-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
      )}
    </div>
  );
}
