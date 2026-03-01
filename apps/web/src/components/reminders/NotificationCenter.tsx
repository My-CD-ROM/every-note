import { Bell, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ReminderWithNote } from '@/lib/api';

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const absDiff = Math.abs(diffMs);

  if (absDiff < 60_000) return diffMs > 0 ? 'in <1 min' : 'just now';
  if (absDiff < 3600_000) {
    const mins = Math.round(absDiff / 60_000);
    return diffMs > 0 ? `in ${mins} min` : `${mins} min ago`;
  }
  if (absDiff < 86400_000) {
    const hrs = Math.round(absDiff / 3600_000);
    return diffMs > 0 ? `in ${hrs}h` : `${hrs}h ago`;
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface NotificationCenterProps {
  pending: ReminderWithNote[];
  fired: ReminderWithNote[];
  onDismiss: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onOpenNote: (noteId: string) => void;
}

export function NotificationCenter({ pending, fired, onDismiss, onSnooze, onOpenNote }: NotificationCenterProps) {
  const totalBadge = pending.length + fired.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          {totalBadge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center px-1">
              {totalBadge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="px-3 py-2 border-b">
          <span className="text-sm font-medium">Reminders</span>
        </div>

        {totalBadge === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No reminders
          </div>
        )}

        {fired.length > 0 && (
          <div>
            <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Fired
            </div>
            {fired.map((r) => (
              <ReminderItem key={r.id} reminder={r} onDismiss={onDismiss} onSnooze={onSnooze} onOpen={onOpenNote} />
            ))}
          </div>
        )}

        {pending.length > 0 && (
          <div>
            <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Upcoming
            </div>
            {pending.map((r) => (
              <ReminderItem key={r.id} reminder={r} onDismiss={onDismiss} onSnooze={onSnooze} onOpen={onOpenNote} />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ReminderItem({
  reminder,
  onDismiss,
  onSnooze,
  onOpen,
}: {
  reminder: ReminderWithNote;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onOpen: (noteId: string) => void;
}) {
  return (
    <div className="px-3 py-2 hover:bg-muted transition-colors group">
      <button className="text-sm font-medium truncate w-full text-left" onClick={() => onOpen(reminder.note_id)}>
        {reminder.note_title || 'Untitled'}
      </button>
      <div className="flex items-center gap-1 mt-1">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(reminder.remind_at)}</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="text-[10px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted-foreground/10"
            onClick={() => onSnooze(reminder.id, 15)}
          >
            15m
          </button>
          <button
            className="text-[10px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted-foreground/10"
            onClick={() => onSnooze(reminder.id, 60)}
          >
            1h
          </button>
          <button
            className="text-muted-foreground hover:text-destructive p-0.5 rounded hover:bg-muted-foreground/10"
            onClick={() => onDismiss(reminder.id)}
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
