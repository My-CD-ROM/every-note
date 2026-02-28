import { useEffect, useState } from 'react';
import { ChevronRight, Link2 } from 'lucide-react';
import { notesApi } from '@/lib/api';
import type { BacklinkResponse } from '@/lib/api';
import { useNotesStore } from '@/stores/notes-store';

interface BacklinksProps {
  noteId: string;
}

export function Backlinks({ noteId }: BacklinksProps) {
  const [backlinks, setBacklinks] = useState<BacklinkResponse[]>([]);
  const [expanded, setExpanded] = useState(true);
  const setActiveNote = useNotesStore((s) => s.setActiveNote);

  useEffect(() => {
    notesApi.backlinks(noteId).then(setBacklinks).catch(() => setBacklinks([]));
  }, [noteId]);

  if (backlinks.length === 0) return null;

  return (
    <div className="border-t border-border px-4 py-2">
      <button
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <Link2 className="h-3 w-3" />
        Linked mentions ({backlinks.length})
      </button>
      {expanded && (
        <div className="mt-1 flex flex-col gap-0.5">
          {backlinks.map((bl) => (
            <button
              key={bl.id}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm text-foreground hover:bg-muted"
              onClick={() => setActiveNote(bl.id)}
            >
              <span className="truncate">{bl.title || 'Untitled'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
