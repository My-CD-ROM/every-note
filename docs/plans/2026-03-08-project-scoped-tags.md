# Project-Scoped Tags

## Problem
Tags are global — the same pool is shared between regular notes and project tasks. Project tasks need their own tags (e.g., "backend", "bug", "ui") that are specific to each project.

## Design

### Data Model
- Add nullable `project_id` FK to the `Tag` model
- `project_id = NULL` → global tag (for regular notes)
- `project_id = <id>` → project-scoped tag (only for tasks in that project)
- Unique constraint changes from `(name)` to `(name, project_id)` — same tag name can exist in different projects

### Backend
- `GET /tags` gains optional `?project_id=` filter
- `POST /tags` accepts optional `project_id` — if set, tag is scoped to that project
- Tag assignment validation: project-scoped tags can only be assigned to notes in the same project
- Existing tags untouched (they remain global with `project_id=NULL`)

### Frontend — Metadata Sidebar
- When editing a note with `project_id`: tag picker shows only that project's tags + "Create tag" option
- When editing a regular note (no project): tag picker shows only global tags (current behavior)
- "Create tag" inline creates a tag scoped to the note's project (or global if no project)

### Frontend — Board View
- Board cards show project tag color dots next to task title
- No filter bar for now (can add later)

### Migration
- Leave existing tags as-is (global, `project_id=NULL`)
- Mixed state is fine — global tags on project notes stay, new tags within projects are scoped

### Sidebar
- Global tags section stays as-is (shows only `project_id=NULL` tags)
- No project tag listing in sidebar — they live within the project/board context
