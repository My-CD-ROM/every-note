import { useMemo } from 'react';
import { AlertCircle, Calendar, CalendarClock, CheckCircle2, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/notes-store';
import { useUIStore } from '@/stores/ui-store';
import type { NoteResponse } from '@/lib/api';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysFromNow(iso: string): number {
  const due = startOfDay(new Date(iso));
  const today = startOfDay(new Date());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function formatDueTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dayLabel(daysAway: number): string {
  if (daysAway === 1) return 'Tomorrow';
  const d = new Date();
  d.setDate(d.getDate() + daysAway);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function AgendaItem({ note, detail, onClick }: { note: NoteResponse; detail: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-muted/50 transition-colors"
    >
      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      <span className="text-sm truncate flex-1">{note.title || 'Untitled'}</span>
      <span className="text-[10px] text-muted-foreground/50 shrink-0">{detail}</span>
    </button>
  );
}

export function DashboardPanel() {
  const { notes, createNote, setActiveNote } = useNotesStore();
  const { setView } = useUIStore();

  const { overdue, dueToday, upcoming, recentNotes } = useMemo(() => {
    const active = notes.filter((n) => !n.is_trashed && !n.is_completed);
    const now = new Date();

    const over: NoteResponse[] = [];
    const today: NoteResponse[] = [];
    // Group upcoming by days-from-now (1..7)
    const upcomingMap = new Map<number, NoteResponse[]>();

    for (const n of active) {
      if (!n.due_at) continue;
      const days = daysFromNow(n.due_at);
      if (days < 0) {
        over.push(n);
      } else if (days === 0) {
        today.push(n);
      } else if (days <= 7) {
        const arr = upcomingMap.get(days) || [];
        arr.push(n);
        upcomingMap.set(days, arr);
      }
    }

    // Sort overdue by most overdue first
    over.sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
    // Sort today by time
    today.sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());

    // Build upcoming groups sorted by day
    const upcomingGroups = [...upcomingMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, items]) => ({
        label: dayLabel(day),
        notes: items.sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime()),
      }));

    const recent = [...active]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 5);

    return { overdue: over, dueToday: today, upcoming: upcomingGroups, recentNotes: recent };
  }, [notes]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleClickNote = (noteId: string) => {
    setActiveNote(noteId);
    setView('all');
  };

  const hasAgenda = overdue.length > 0 || dueToday.length > 0 || upcoming.length > 0;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col items-center px-6 py-8 animate-fade-in-up">
        <div className="w-full max-w-lg space-y-6">
          {/* Greeting */}
          <div>
            <h2 className="text-lg font-semibold">{greeting()}</h2>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
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

          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <h3 className="text-xs font-medium text-red-500 uppercase tracking-wide">Overdue</h3>
                <span className="text-[10px] text-red-400 tabular-nums">{overdue.length}</span>
              </div>
              <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
                {overdue.map((note) => {
                  const days = Math.abs(daysFromNow(note.due_at!));
                  const detail = days === 1 ? '1 day overdue' : `${days} days overdue`;
                  return (
                    <AgendaItem key={note.id} note={note} detail={detail} onClick={() => handleClickNote(note.id)} />
                  );
                })}
              </div>
            </div>
          )}

          {/* Due Today */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-xs font-medium text-primary uppercase tracking-wide">Today</h3>
              {dueToday.length > 0 && (
                <span className="text-[10px] text-primary/70 tabular-nums">{dueToday.length}</span>
              )}
            </div>
            {dueToday.length > 0 ? (
              <div className="rounded-lg border bg-card">
                {dueToday.map((note) => (
                  <AgendaItem
                    key={note.id}
                    note={note}
                    detail={formatDueTime(note.due_at!)}
                    onClick={() => handleClickNote(note.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/60 px-3 py-2">Nothing due today. You're all clear.</p>
            )}
          </div>

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upcoming</h3>
              </div>
              <div className="rounded-lg border bg-card divide-y divide-border">
                {upcoming.map((group) => (
                  <div key={group.label}>
                    <div className="px-3 pt-2 pb-0.5">
                      <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">{group.label}</span>
                    </div>
                    {group.notes.map((note) => (
                      <AgendaItem
                        key={note.id}
                        note={note}
                        detail={formatDueTime(note.due_at!)}
                        onClick={() => handleClickNote(note.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty agenda state */}
          {!hasAgenda && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground/60">No upcoming deadlines. Set due dates on notes to see them here.</p>
            </div>
          )}

          {/* Recent */}
          {recentNotes.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Recent</h3>
              <div className="space-y-0.5">
                {recentNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => handleClickNote(note.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm truncate flex-1">{note.title || 'Untitled'}</span>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">{formatRelativeDate(note.updated_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
