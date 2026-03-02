import { useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';
import { NoteList } from '@/components/notes/NoteList';
import { NoteEditor } from '@/components/editor/NoteEditor';
import { SearchPalette } from '@/components/SearchPalette';
import { CalendarView } from '@/components/calendar/CalendarView';
import { BoardView } from '@/components/board/BoardView';
import { FinanceView } from '@/components/finance/FinanceView';
import { NotificationCenter } from '@/components/reminders/NotificationCenter';
import { TemplatePicker } from '@/components/notes/TemplatePicker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Menu, Plus } from 'lucide-react';
import { useNotesStore } from '@/stores/notes-store';
import { useUIStore } from '@/stores/ui-store';
import { useFoldersStore } from '@/stores/folders-store';
import { useProjectsStore } from '@/stores/projects-store';
import { useReminders } from '@/hooks/useReminders';
import { useRouter } from '@/hooks/useRouter';
import { DashboardPanel } from '@/components/DashboardPanel';

const VIEW_TITLES: Record<string, string> = {
  home: 'Home',
  all: 'All Notes',
  board: 'Board',
  trash: 'Trash',
  folder: 'Folder',
  tag: 'Tagged',
  favorites: 'Favorites',
  completed: 'Completed',
  daily: 'Calendar',
  finance: 'Finance',
};

function TopBar() {
  const { createNote, activeNoteId, setActiveNote } = useNotesStore();
  const { setMobileSidebarOpen, view } = useUIStore();
  const activeFolderId = useFoldersStore((s) => s.activeFolderId);
  const { activeProjectId, projects } = useProjectsStore();
  const { pending, fired, dismiss, snooze, requestPermission } = useReminders();

  // Request notification permission on mount
  useEffect(() => { requestPermission(); }, [requestPermission]);

  const activeProject = view === 'board' ? projects.find((p) => p.id === activeProjectId) : null;

  const handleTemplateCreate = async (data: { title: string; content: string; note_type?: string }) => {
    await createNote({
      title: data.title,
      content: data.content,
      folder_id: view === 'folder' ? activeFolderId : null,
      note_type: data.note_type,
    });
  };

  const showCreateButton = !['home', 'trash', 'board', 'daily', 'completed', 'finance'].includes(view);

  return (
    <div className="flex items-center justify-between border-b px-3 py-1.5 bg-background shrink-0">
      <div className="flex items-center gap-2">
        {activeNoteId ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setActiveNote(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setMobileSidebarOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <h2 className="text-sm font-semibold">
          {activeProject ? `${activeProject.icon ? activeProject.icon + ' ' : ''}${activeProject.name}` : VIEW_TITLES[view] ?? 'Notes'}
        </h2>
      </div>
      <div className="flex items-center gap-1">
        <NotificationCenter
          pending={pending}
          fired={fired}
          onDismiss={dismiss}
          onSnooze={snooze}
          onOpenNote={(noteId) => setActiveNote(noteId)}
        />
        {showCreateButton && (
          <>
            <Button
              size="sm"
              className="h-7 gap-1.5"
              onClick={() => createNote({ folder_id: view === 'folder' ? activeFolderId : null })}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">New Note</span>
            </Button>
            <TemplatePicker onSelect={handleTemplateCreate} />
          </>
        )}
      </div>
    </div>
  );
}

function NotesPage() {
  const { activeNoteId } = useNotesStore();
  const { view } = useUIStore();

  useRouter();

  // Views that use the list + editor two-panel layout
  const isListView = ['all', 'folder', 'tag', 'trash', 'favorites', 'completed'].includes(view);

  return (
    <div className="flex h-full flex-col">
      <TopBar />

      {/* Home — dashboard stats */}
      {view === 'home' && (
        <div className="flex-1 overflow-hidden">
          <DashboardPanel />
        </div>
      )}

      {/* Finance — full-page view */}
      {view === 'finance' && (
        <div className="flex-1 overflow-hidden">
          <FinanceView />
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
            <div className="hidden md:block w-[480px] flex-shrink-0 border-l min-w-0">
              <NoteEditor />
            </div>
          )}
        </div>
      )}

      {/* Adaptive layout: full-width grid when browsing, split when editing */}
      {isListView && !activeNoteId && (
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <NoteList expanded />
          </ScrollArea>
        </div>
      )}
      {isListView && activeNoteId && (
        <div className="flex flex-1 overflow-hidden">
          <div className="hidden md:flex w-72 flex-shrink-0 border-r flex-col bg-muted/20">
            <ScrollArea className="flex-1">
              <NoteList />
            </ScrollArea>
          </div>
          <div className="flex-1 min-w-0">
            <NoteEditor />
          </div>
        </div>
      )}
    </div>
  );
}

function useGlobalShortcuts() {
  const { setSearchOpen } = useUIStore();
  const { createNote } = useNotesStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // Ctrl/Cmd+K — open search
      if (mod && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Ctrl/Cmd+N — new note (only when not in an input)
      if (mod && e.key === 'n') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        createNote({});
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSearchOpen, createNote]);
}

function App() {
  useGlobalShortcuts();

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
