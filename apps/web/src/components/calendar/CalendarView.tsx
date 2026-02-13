import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dailyApi } from '@/lib/api';
import type { NoteResponse } from '@/lib/api';
import { useNotesStore } from '@/stores/notes-store';
import { useUIStore } from '@/stores/ui-store';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const days: { date: Date; inMonth: boolean }[] = [];

  // Padding days from previous month
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, inMonth: false });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    days.push({ date: new Date(year, month, i), inMonth: true });
  }

  // Padding days for next month to fill 6 rows
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), inMonth: false });
  }

  return days;
}

function DayCell({
  date,
  inMonth,
  isToday,
  notes,
  onClickDay,
  onClickNote,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  notes: NoteResponse[];
  onClickDay: (date: Date) => void;
  onClickNote: (noteId: string) => void;
}) {
  return (
    <div
      className={cn(
        'group flex flex-col border-r border-b border-zinc-200 dark:border-zinc-800 min-h-[100px] p-1 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50',
        !inMonth && 'bg-zinc-50/50 dark:bg-zinc-950/50'
      )}
    >
      {/* Day number header */}
      <div className="flex items-center justify-between mb-0.5">
        <span
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
            isToday && 'bg-blue-500 text-white',
            !isToday && inMonth && 'text-zinc-700 dark:text-zinc-300',
            !isToday && !inMonth && 'text-zinc-400 dark:text-zinc-600'
          )}
        >
          {date.getDate()}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onClickDay(date);
          }}
          title="Create daily note"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Note previews */}
      <div className="flex-1 space-y-0.5 overflow-hidden">
        {notes.slice(0, 3).map((note) => (
          <button
            key={note.id}
            className={cn(
              'w-full text-left rounded px-1 py-0.5 text-[11px] leading-tight truncate transition-colors',
              note.is_daily
                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onClickNote(note.id);
            }}
            title={note.title || 'Untitled'}
          >
            {note.title || 'Untitled'}
          </button>
        ))}
        {notes.length > 3 && (
          <span className="block text-[10px] text-zinc-400 px-1">
            +{notes.length - 3} more
          </span>
        )}
      </div>
    </div>
  );
}

export function CalendarView() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [monthNotes, setMonthNotes] = useState<NoteResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const setActiveNote = useNotesStore((s) => s.setActiveNote);
  const fetchNotes = useNotesStore((s) => s.fetchNotes);
  const setView = useUIStore((s) => s.setView);

  const days = useMemo(() => getMonthDays(year, month), [year, month]);

  const monthLabel = new Date(year, month).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const fetchMonthNotes = useCallback(async () => {
    setLoading(true);
    try {
      const start = toDateStr(new Date(year, month, 1));
      const end = toDateStr(new Date(year, month + 1, 0));
      const notes = await dailyApi.range(start, end);
      setMonthNotes(notes);
    } catch {
      setMonthNotes([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchMonthNotes();
  }, [fetchMonthNotes]);

  // Group notes by date (YYYY-MM-DD from updated_at)
  const notesByDate = useMemo(() => {
    const map: Record<string, NoteResponse[]> = {};
    for (const note of monthNotes) {
      // For daily notes, use daily_date; for regular notes, use updated_at date part
      const dateKey = note.daily_date || note.updated_at.split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(note);
    }
    return map;
  }, [monthNotes]);

  const prevMonth = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const handleClickDay = async (date: Date) => {
    const dateStr = toDateStr(date);
    try {
      const note = await dailyApi.getOrCreate(dateStr);
      await fetchNotes();
      setActiveNote(note.id);
      setView('daily');
    } catch {
      // ignore
    }
  };

  const handleClickNote = (noteId: string) => {
    setActiveNote(noteId);
    setView('all');
  };

  const todayStr = toDateStr(today);

  return (
    <div className="flex h-full flex-col">
      {/* Calendar header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {monthLabel}
          </h2>
          {loading && (
            <span className="text-xs text-zinc-400">Loading...</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-1.5 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-800 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-auto">
        {days.map(({ date, inMonth }, i) => {
          const dateStr = toDateStr(date);
          return (
            <DayCell
              key={i}
              date={date}
              inMonth={inMonth}
              isToday={dateStr === todayStr}
              notes={notesByDate[dateStr] || []}
              onClickDay={handleClickDay}
              onClickNote={handleClickNote}
            />
          );
        })}
      </div>
    </div>
  );
}
