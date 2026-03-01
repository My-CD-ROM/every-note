# Notes vs Tasks — Separation of Concerns

## Core Rule

Items in **folders** are "notes". Items in **projects** are "tasks". They share the same `Note` DB model but behave differently in the UI.

## Notes (folder items, `project_id IS NULL`)

- Can be pinned, trashed, completed
- Show in "Completed" sidebar view when `is_completed = true`
- Show in "Trash" sidebar view when `is_trashed = true`
- No board column / kanban concept

## Tasks (project items, `project_id IS NOT NULL`)

- Live on the board — status determined by `board_column` only
- No complete/uncomplete action in the UI
- Can be trashed (show in Trash alongside trashed notes)
- `is_completed` flag not used — "done" state is `board_column = 'done'`
- Do not appear in the "Completed" sidebar view

## UI Changes

1. **NoteActions dropdown** — hide "Mark complete" / "Mark incomplete" for items with `project_id`
2. **NoteList card** — don't show completion UI for project tasks
3. **Completed sidebar view** — only show notes (`project_id IS NULL`)
4. **Backend `/notes?completed=true`** — add `project_id IS NULL` filter

## What Stays the Same

- Same `Note` DB model (no schema change)
- Board view unchanged (already uses columns)
- Trash works for both notes and tasks
