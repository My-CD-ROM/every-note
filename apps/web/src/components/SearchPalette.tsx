import { useEffect, useState } from 'react';
import { FileText, Folder } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useUIStore } from '@/stores/ui-store';
import { useNotesStore } from '@/stores/notes-store';
import { searchApi } from '@/lib/api';
import type { SearchResult } from '@/lib/api';

export function SearchPalette() {
  const { searchOpen, setSearchOpen } = useUIStore();
  const setActiveNote = useNotesStore((s) => s.setActiveNote);
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

  return (
    <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
      <CommandInput
        placeholder="Search notes..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {results.map((r) => (
          <CommandItem
            key={r.id}
            value={r.id}
            onSelect={() => {
              setActiveNote(r.id);
              setSearchOpen(false);
              setQuery('');
            }}
          >
            <FileText className="mr-2 h-4 w-4 shrink-0" />
            <div className="flex flex-col overflow-hidden">
              <span className="truncate font-medium">{r.title || 'Untitled'}</span>
              <span className="text-xs text-muted-foreground truncate">
                {r.snippet.replace(/<[^>]*>/g, '')}
              </span>
              {r.folder_name && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                  <Folder className="h-3 w-3" />
                  {r.folder_name}
                </span>
              )}
            </div>
          </CommandItem>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
