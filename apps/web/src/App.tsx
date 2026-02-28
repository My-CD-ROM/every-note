import { useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';
import { NoteList } from '@/components/notes/NoteList';
import { NoteEditor } from '@/components/editor/NoteEditor';
import { SearchPalette } from '@/components/SearchPalette';
import { GraphView } from '@/components/graph/GraphView';
import { CalendarView } from '@/components/calendar/CalendarView';
import { BoardView } from '@/components/board/BoardView';
import { TemplatePicker } from '@/components/notes/TemplatePicker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Menu, Plus, FileText } from 'lucide-react';
import { useNotesStore } from '@/stores/notes-store';
import { useUIStore } from '@/stores/ui-store';
import { useFoldersStore } from '@/stores/folders-store';

const VIEW_TITLES: Record<string, string> = {
  all: 'All Notes',
  board: 'Board',
  trash: 'Trash',
  folder: 'Folder',
  tag: 'Tagged',
  favorites: 'Favorites',
  completed: 'Completed',
  daily: 'Calendar',
  graph: 'Graph View',
};

function TopBar() {
  const { createNote } = useNotesStore();
  const { setMobileSidebarOpen, view } = useUIStore();
  const activeFolderId = useFoldersStore((s) => s.activeFolderId);

  const handleTemplateCreate = async (data: { title: string; content: string; note_type?: string }) => {
    await createNote({
      title: data.title,
      content: data.content,
      folder_id: view === 'folder' ? activeFolderId : null,
      note_type: data.note_type,
    });
  };

  const showCreateButton = !['trash', 'all', 'board', 'graph', 'daily', 'completed'].includes(view);

  return (
    <div className="flex items-center justify-between border-b px-3 py-1.5 bg-background shrink-0">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setMobileSidebarOpen(true)}>
          <Menu className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold">
          {VIEW_TITLES[view] ?? 'Notes'}
        </h2>
      </div>
      {showCreateButton && (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => createNote({ folder_id: view === 'folder' ? activeFolderId : null })}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="text-xs">New Note</span>
          </Button>
          <TemplatePicker onSelect={handleTemplateCreate} />
        </div>
      )}
    </div>
  );
}

function NotesPage() {
  const { fetchNotes, activeNoteId } = useNotesStore();
  const { view } = useUIStore();

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Views that use the list + editor two-panel layout
  const isListView = ['all', 'folder', 'tag', 'trash', 'favorites', 'completed'].includes(view);

  return (
    <div className="flex h-full flex-col">
      <TopBar />

      {/* Full-page views */}
      {view === 'graph' && (
        <div className="flex-1 relative">
          <GraphView />
        </div>
      )}

      {view === 'daily' && (
        <div className="flex-1 overflow-hidden">
          <CalendarView />
        </div>
      )}

      {/* Kanban board view */}
      {view === 'board' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-x-auto bg-muted/30">
            <BoardView />
          </div>
          {activeNoteId && (
            <div className="w-[480px] flex-shrink-0 border-l min-w-0">
              <NoteEditor />
            </div>
          )}
        </div>
      )}

      {/* List + editor layout for all, folder, tag, trash, favorites, etc. */}
      {isListView && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 flex-shrink-0 border-r flex flex-col bg-muted/20">
            <ScrollArea className="flex-1">
              <NoteList />
            </ScrollArea>
          </div>
          <div className="flex-1 min-w-0">
            {activeNoteId ? (
              <NoteEditor />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-2">
                <FileText className="h-10 w-10 stroke-1" />
                <div className="text-center text-sm">
                  <p>No note selected</p>
                  <p className="text-xs text-muted-foreground/60">Select a note or press + to create one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <TooltipProvider>
      <AppShell>
        <NotesPage />
      </AppShell>
      <SearchPalette />
    </TooltipProvider>
  );
}

export default App;
