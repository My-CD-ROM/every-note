import { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownPreview } from './MarkdownPreview';
import { notesApi } from '@/lib/api';
import type { NoteVersionBrief, NoteVersionResponse } from '@/lib/api';

interface VersionHistoryProps {
  noteId: string;
  onRestore: () => void;
  onClose: () => void;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function VersionHistory({ noteId, onRestore, onClose }: VersionHistoryProps) {
  const [versions, setVersions] = useState<NoteVersionBrief[]>([]);
  const [selected, setSelected] = useState<NoteVersionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notesApi.listVersions(noteId);
      setVersions(data);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleSelect = async (v: NoteVersionBrief) => {
    const full = await notesApi.getVersion(noteId, v.id);
    setSelected(full);
  };

  const handleRestore = async () => {
    if (!selected) return;
    await notesApi.restoreVersion(noteId, selected.id);
    onRestore();
  };

  return (
    <div className="flex h-full w-80 flex-col border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <History className="h-4 w-4" />
          Version History
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Version list */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-sm text-zinc-400">Loading...</div>
        ) : versions.length === 0 ? (
          <div className="p-4 text-sm text-zinc-400">No versions yet. Versions are created automatically when you edit.</div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {versions.map((v) => (
              <button
                key={v.id}
                className={`w-full text-left rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  selected?.id === v.id ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                }`}
                onClick={() => handleSelect(v)}
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {v.title || 'Untitled'}
                </div>
                <div className="text-xs text-zinc-400">{relativeTime(v.created_at)}</div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Preview + Restore */}
      {selected && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="max-h-48 overflow-auto">
            <MarkdownPreview content={selected.content} className="text-xs" />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 px-3 py-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleRestore}>
              <RotateCcw className="mr-1 h-3 w-3" />
              Restore
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
