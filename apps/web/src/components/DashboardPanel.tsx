import { FileText, FolderOpen, CheckCircle2, Star, Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotesStore } from '@/stores/notes-store';
import { useFoldersStore } from '@/stores/folders-store';
import { useUIStore } from '@/stores/ui-store';

export function DashboardPanel() {
  const { notes, createNote, setActiveNote } = useNotesStore();
  const { tree: folders } = useFoldersStore();
  const { setView } = useUIStore();

  const activeNotes = notes.filter((n) => !n.is_trashed);
  const pinnedCount = activeNotes.filter((n) => n.is_pinned).length;
  const completedCount = activeNotes.filter((n) => n.is_completed).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayNotes = activeNotes.filter((n) => n.daily_date === todayStr);

  const recentNotes = [...activeNotes]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);

  const stats = [
    { icon: FileText, label: 'Notes', value: activeNotes.length },
    { icon: FolderOpen, label: 'Folders', value: folders.length },
    { icon: Star, label: 'Pinned', value: pinnedCount },
    { icon: CheckCircle2, label: 'Completed', value: completedCount },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handleClickNote = (noteId: string) => {
    setActiveNote(noteId);
    setView('all');
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 animate-fade-in-up">
      <div className="w-full max-w-md space-y-6">
        {/* Greeting */}
        <div>
          <h2 className="text-lg font-semibold">{greeting()}</h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            {todayNotes.length > 0 && ` \u00b7 ${todayNotes.length} daily note${todayNotes.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border bg-card px-3 py-2.5 text-center">
              <s.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-semibold tabular-nums">{s.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={async () => { await createNote({}); setView('all'); }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Note
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5"
            onClick={async () => { await createNote({ note_type: 'checklist' }); setView('all'); }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            New Checklist
          </Button>
        </div>

        {/* Recent notes */}
        {recentNotes.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent</h3>
            <div className="space-y-0.5">
              {recentNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleClickNote(note.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors group"
                >
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <span className="text-sm truncate flex-1">{note.title || 'Untitled'}</span>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">{formatDate(note.updated_at)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
