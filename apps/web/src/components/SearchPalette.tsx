import { useEffect, useState } from 'react';
import { Calendar, CornerDownRight, FileText, Folder } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useUIStore } from '@/stores/ui-store';
import { useNotesStore } from '@/stores/notes-store';
import { searchApi } from '@/lib/api';
import type { SearchResult } from '@/lib/api';

export function SearchPalette() {
  const { searchOpen, setSearchOpen, setView } = useUIStore();
  const { setActiveNote, notes } = useNotesStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  // Search on query change
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await searchApi.search(query);
        setResults(data);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const recentNotes = query.trim()
    ? []
    : [...notes]
        .filter((n) => !n.is_trashed)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 8);

  const handleSelect = (noteId: string) => {
    setActiveNote(noteId);
    setView('all');
    setSearchOpen(false);
    setQuery('');
  };

  return (
    <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
      <CommandInput
        placeholder="Search notes..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recent notes when no query */}
        {recentNotes.length > 0 && (
          <CommandGroup heading="Recent">
            {recentNotes.map((note) => (
              <CommandItem
                key={note.id}
                value={`recent-${note.id}-${note.title}`}
                onSelect={() => handleSelect(note.id)}
              >
                <Calendar className="mr-2 h-4 w-4 shrink-0 text-muted-foreground/50" />
                <span className="truncate">{note.title || 'Untitled'}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Search results */}
        {results.length > 0 && (
          <CommandGroup heading="Results">
            {results.map((r) => (
              <CommandItem
                key={r.id}
                value={`${r.id}-${r.title}`}
                onSelect={() => handleSelect(r.id)}
              >
                <FileText className="mr-2 h-4 w-4 shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate font-medium">{r.title || 'Untitled'}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {r.snippet.replace(/<[^>]*>/g, '')}
                  </span>
                  {r.parent_title && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                      <CornerDownRight className="h-3 w-3" />
                      subtask of {r.parent_title}
                    </span>
                  )}
                  {r.folder_name && !r.parent_title && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                      <Folder className="h-3 w-3" />
                      {r.folder_name}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
