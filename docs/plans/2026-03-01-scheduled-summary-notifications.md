# Scheduled Summary Notifications

## Overview

Periodic browser notifications that summarize uncompleted task counts from specific folders. Two preconfigured summaries ship by default; custom ones can be added later.

## Preconfigured Summaries

1. **Weekend** — targets the "weekend" folder:
   - Friday 18:00 — "You have N tasks for the weekend"
   - Saturday 09:00 — same
   - Sunday 09:00 — same

2. **Daily** — targets the "daily" folder (or daily notes view):
   - Every day 09:00 — "You have N tasks for today"

## Data Model

New `scheduled_summaries` table:

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK (ULID) | |
| name | TEXT | Human label ("Weekend reminder", "Daily reminder") |
| folder_id | TEXT FK nullable | Target folder to count notes from |
| cron_expression | TEXT | Cron-style schedule (e.g. `0 18 * * 5`) |
| message_template | TEXT | Template with `{count}` placeholder |
| last_fired_at | TEXT nullable | ISO timestamp of last fire |
| is_active | BOOL | Enable/disable toggle |
| created_at | TEXT | |

## Backend

- `GET /reminders/summaries` — checks all active scheduled summaries against current time. For each one where current time has passed the cron schedule and `last_fired_at` is before the scheduled time: return it with the computed count and mark `last_fired_at`.
- Count query: `SELECT COUNT(*) FROM notes WHERE folder_id = ? AND is_trashed = 0 AND is_completed = 0 AND parent_id IS NULL`
- Cron evaluation: use `croniter` library to compute next/previous fire times.
- Seed the two default summaries on app startup if they don't exist.

## Frontend

- Extend the existing 30s polling loop to also call `/reminders/summaries`.
- When summaries are returned, show browser notifications with the message.
- Summaries appear in the NotificationCenter popover under a "Summaries" section.

## Dependencies

- `croniter` Python package for cron expression evaluation.
