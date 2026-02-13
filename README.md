# Every Note

A clean, fast, self-hosted notes app with markdown editing and full-text search.

## Features

- **Markdown editor** with live preview (split pane) powered by CodeMirror 6
- **Full-text search** with BM25 ranking and highlighted snippets (SQLite FTS5)
- **Nested folders** and **tags** for organizing notes
- **Command palette** (Cmd+K) for quick search
- **Dark/light theme** toggle
- **Keyboard shortcuts**: Cmd+N (new note), Cmd+K (search), Cmd+S (save)
- **Note pinning** and **soft-delete** with trash view
- **Responsive** design — works on mobile browsers

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLModel |
| Database | SQLite + FTS5 (WAL mode) |
| Frontend | Vite + React 19 + TypeScript |
| CSS | Tailwind CSS v4 |
| Components | shadcn/ui (Radix primitives) |
| Editor | CodeMirror 6 |
| State | Zustand |
| Package manager | uv (backend), npm (frontend) |

## Quick Start

### With Docker

```bash
docker compose up
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/docs

### Manual Setup

**Backend:**

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

The frontend proxies API requests to the backend at `localhost:8000`.

## Project Structure

```
every-note/
  backend/
    app/
      main.py          # FastAPI app, startup, route registration
      database.py      # SQLite engine, WAL mode, FTS5 schema + triggers
      models.py        # SQLModel models (Note, Folder, Tag)
      schemas.py       # Pydantic request/response schemas
      routers/
        notes.py       # CRUD + trash/restore + tag assignment
        folders.py     # CRUD + recursive tree query
        tags.py        # CRUD
        search.py      # FTS5 search with BM25 ranking
    pyproject.toml
    Dockerfile
  frontend/
    src/
      components/
        layout/        # AppShell, Sidebar
        editor/        # CodeMirror editor, Markdown preview
        notes/         # NoteList, NoteActions
        ui/            # shadcn/ui components
      stores/          # Zustand stores (notes, folders, tags, ui)
      lib/             # API client, utilities
      App.tsx
    vite.config.ts
    Dockerfile
  docker-compose.yml
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /notes | List notes (filter by folder, tag, trashed) |
| POST | /notes | Create note |
| GET | /notes/:id | Get note |
| PATCH | /notes/:id | Update note |
| DELETE | /notes/:id | Trash/permanently delete note |
| POST | /notes/:id/restore | Restore from trash |
| POST | /notes/:id/tags/:tagId | Add tag to note |
| DELETE | /notes/:id/tags/:tagId | Remove tag from note |
| GET | /folders | List folders |
| GET | /folders/tree | Get full folder tree |
| POST | /folders | Create folder |
| PATCH | /folders/:id | Update folder |
| DELETE | /folders/:id | Delete folder |
| GET | /tags | List tags |
| POST | /tags | Create tag |
| PATCH | /tags/:id | Update tag |
| DELETE | /tags/:id | Delete tag |
| GET | /search?q=... | Full-text search with BM25 ranking |

## License

MIT
