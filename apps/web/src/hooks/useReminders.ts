import { useCallback, useEffect, useRef, useState } from 'react';
import { remindersApi } from '@/lib/api';
import type { ReminderWithNote } from '@/lib/api';

export function useReminders() {
  const [pending, setPending] = useState<ReminderWithNote[]>([]);
  const [fired, setFired] = useState<ReminderWithNote[]>([]);

  const fetchPending = useCallback(async () => {
    try {
      const data = await remindersApi.pending();
      setPending(data);
    } catch {
      // Silently fail — polling will retry
    }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 30_000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  // Check for due reminders and fire them
  useEffect(() => {
    const now = new Date();
    const due = pending.filter((r) => new Date(r.remind_at) <= now);
    if (due.length === 0) return;

    for (const reminder of due) {
      // Show browser notification
      if (Notification.permission === 'granted') {
        const n = new Notification('Every Note Reminder', {
          body: reminder.note_title || 'Untitled',
          tag: reminder.id,
        });
        n.onclick = () => {
          window.focus();
        };
      }

      // Mark as fired
      remindersApi.fire(reminder.id);

      // Add to fired list
      setFired((prev) => {
        if (prev.some((f) => f.id === reminder.id)) return prev;
        return [reminder, ...prev];
      });
    }

    // Remove from pending
    const dueIds = new Set(due.map((r) => r.id));
    setPending((prev) => prev.filter((r) => !dueIds.has(r.id)));
  }, [pending]);

  const dismiss = useCallback(async (id: string) => {
    await remindersApi.dismiss(id);
    setFired((prev) => prev.filter((r) => r.id !== id));
    setPending((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const snooze = useCallback(async (id: string, minutes: number) => {
    await remindersApi.snooze(id, minutes);
    setFired((prev) => prev.filter((r) => r.id !== id));
    fetchPending();
  }, [fetchPending]);

  const requestPermission = useCallback(async () => {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  return { pending, fired, dismiss, snooze, requestPermission, refetch: fetchPending };
}
