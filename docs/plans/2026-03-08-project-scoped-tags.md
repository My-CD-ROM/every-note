# Project-Scoped Tags Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate tags into global (for notes) and project-scoped (for tasks), so each project has its own tag pool.

**Architecture:** Add nullable `project_id` FK to `Tag` model. Backend filters tags by project. Frontend swaps tag picker context based on note's `project_id`.

**Tech Stack:** FastAPI, SQLModel, SQLite, React, Zustand, TypeScript

---

### Task 1: Add `project_id` column to Tag model and migrate DB

**Files:**
- Modify: `backend/app/models.py:28-35`
- Modify: `backend/app/database.py:224-253` (migrations list)

**Step 1: Add `project_id` field to Tag model**

In `backend/app/models.py`, update the `Tag` class:

```python
class Tag(SQLModel, table=True):
    __tablename__ = "tags"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    name: str = Field(index=True)
    color: str = Field(default="#6366f1")
    project_id: Optional[str] = Field(default=None, foreign_key="projects.id")
    created_at: str = Field(default_factory=utc_now)

    notes: list["Note"] = Relationship(back_populates="tags", link_model=NoteTag)
```

Remove `unique=True` from `name` — uniqueness is now per `(name, project_id)`.

**Step 2: Add migration in `database.py`**

Add to the `migrations` list:

```python
("tags", "project_id", "ALTER TABLE tags ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE"),
```

Add unique index after migrations:

```python
"CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_project ON tags(COALESCE(project_id, ''), name)",
```

Also drop the old unique index on `tags.name`:

```python
try:
    conn.execute("DROP INDEX IF EXISTS ix_tags_name")
except sqlite3.OperationalError:
    pass
```

**Step 3: Commit**

---

### Task 2: Update Tag schemas and API endpoints

**Files:**
- Modify: `backend/app/schemas.py:108-124`
- Modify: `backend/app/routers/tags.py`

**Step 1: Update schemas**

In `backend/app/schemas.py`:

```python
class TagCreate(BaseModel):
    name: str
    color: str = "#6366f1"
    project_id: Optional[str] = None


class TagResponse(BaseModel):
    id: str
    name: str
    color: str
    project_id: Optional[str] = None
    created_at: str
    note_count: int = 0
```

`TagUpdate` stays unchanged (no project_id change after creation).

**Step 2: Update `GET /tags` to accept `project_id` filter**

In `backend/app/routers/tags.py`:

```python
@router.get("", response_model=list[TagResponse])
def list_tags(session: S, project_id: Optional[str] = None):
    query = select(Tag).order_by(Tag.name)
    if project_id is not None:
        query = query.where(Tag.project_id == project_id)
    else:
        query = query.where(Tag.project_id == None)  # noqa: E711
    tags = session.exec(query).all()
    result = []
    for t in tags:
        count = session.exec(
            select(func.count()).select_from(NoteTag).join(Note, NoteTag.note_id == Note.id).where(
                NoteTag.tag_id == t.id, Note.is_trashed == False, Note.is_completed == False  # noqa: E712
            )
        ).one()
        result.append(TagResponse(**t.model_dump(), note_count=count))
    return result
```

**Step 3: Update `POST /tags` to accept `project_id`**

```python
@router.post("", response_model=TagResponse, status_code=201)
def create_tag(data: TagCreate, session: S):
    query = select(Tag).where(Tag.name == data.name)
    if data.project_id:
        query = query.where(Tag.project_id == data.project_id)
    else:
        query = query.where(Tag.project_id == None)  # noqa: E711
    existing = session.exec(query).first()
    if existing:
        raise HTTPException(409, "Tag already exists")

    tag = Tag(id=generate_ulid(), name=data.name, color=data.color, project_id=data.project_id)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return TagResponse(**tag.model_dump(), note_count=0)
```

**Step 4: Add validation on tag assignment**

In `backend/app/routers/notes.py`, in the `POST /notes/{note_id}/tags/{tag_id}` endpoint, add validation that project-scoped tags can only be assigned to notes in the same project:

```python
# After fetching note and tag:
if tag.project_id and tag.project_id != note.project_id:
    raise HTTPException(400, "Cannot assign project tag to note in different project")
```

**Step 5: Commit**

---

### Task 3: Update shared types and API client

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/web/src/lib/api.ts:219-232`

**Step 1: Update `TagResponse` in shared types**

In `packages/shared/src/types.ts`, add `project_id` to `TagResponse`:

```typescript
export interface TagResponse {
  id: string;
  name: string;
  color: string;
  project_id: string | null;
  created_at: string;
  note_count: number;
}
```

**Step 2: Update `tagsApi` in API client**

In `apps/web/src/lib/api.ts`:

```typescript
export const tagsApi = {
  list(projectId?: string | null) {
    const params = projectId !== undefined
      ? `?project_id=${projectId ?? ''}`
      : '';
    return request<TagResponse[]>(`/tags${params}`);
  },
  create(data: { name: string; color?: string; project_id?: string | null }) {
    return request<TagResponse>('/tags', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: string, data: { name?: string; color?: string }) {
    return request<TagResponse>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/tags/${id}`, { method: 'DELETE' });
  },
};
```

**Step 3: Commit**

---

### Task 4: Update tags store for project-scoped fetching

**Files:**
- Modify: `apps/web/src/stores/tags-store.ts`

**Step 1: Update store to support project-scoped fetching**

```typescript
interface TagsState {
  tags: TagResponse[];
  activeTagId: string | null;
  loading: boolean;

  fetchTags: (projectId?: string | null) => Promise<void>;
  setActiveTag: (id: string | null) => void;
  createTag: (data: { name: string; color?: string; project_id?: string | null }) => Promise<TagResponse>;
  updateTag: (id: string, data: { name?: string; color?: string }) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
}

export const useTagsStore = create<TagsState>((set) => ({
  tags: [],
  activeTagId: null,
  loading: false,

  fetchTags: async (projectId?: string | null) => {
    set({ loading: true });
    try {
      const tags = await tagsApi.list(projectId);
      set({ tags });
    } finally {
      set({ loading: false });
    }
  },

  setActiveTag: (id) => set({ activeTagId: id }),

  createTag: async (data) => {
    const tag = await tagsApi.create(data);
    set((s) => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  updateTag: async (id, data) => {
    const updated = await tagsApi.update(id, data);
    set((s) => ({ tags: s.tags.map((t) => (t.id === id ? updated : t)) }));
  },

  deleteTag: async (id) => {
    await tagsApi.delete(id);
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }));
  },
}));
```

**Step 2: Commit**

---

### Task 5: Update MetadataSidebar tag picker

**Files:**
- Modify: `apps/web/src/components/editor/MetadataSidebar.tsx:77-230`

**Step 1: Fetch project-scoped tags and add inline create**

Update the tag fetching in MetadataSidebar to pass `note.project_id`:

```typescript
useEffect(() => {
  fetchTags(note?.project_id ?? undefined);
  fetchTree();
}, [fetchTags, fetchTree, note?.project_id]);
```

Add state and imports for inline tag creation:

```typescript
const { tags: allTags, fetchTags, createTag } = useTagsStore();
const [newTagName, setNewTagName] = useState('');
```

Inside the tag popover content, after the tag list, add a "Create tag" form:

```tsx
<div className="border-t mt-1 pt-1">
  <form
    className="flex items-center gap-1 px-1"
    onSubmit={async (e) => {
      e.preventDefault();
      if (!newTagName.trim()) return;
      const tag = await createTag({
        name: newTagName.trim(),
        project_id: note.project_id ?? undefined,
      });
      await notesApi.addTag(note.id, tag.id);
      setNewTagName('');
      fetchNotes();
    }}
  >
    <input
      value={newTagName}
      onChange={(e) => setNewTagName(e.target.value)}
      placeholder="New tag..."
      className="flex h-7 flex-1 rounded-md border bg-transparent px-2 text-xs"
    />
    <Button type="submit" size="icon" variant="ghost" className="h-7 w-7 shrink-0">
      <Plus className="h-3.5 w-3.5" />
    </Button>
  </form>
</div>
```

**Step 2: Commit**

---

### Task 6: Sidebar global tags — no changes needed

The sidebar calls `fetchTags()` with no arguments. The updated API defaults to filtering `project_id IS NULL` when no param is passed, so sidebar tag list automatically shows only global tags.

---

### Task 7: Update NoteActions tag submenu

**Files:**
- Modify: `apps/web/src/components/notes/NoteActions.tsx:40-45`

**Step 1: Fetch project-scoped tags in NoteActions**

Update the effect to pass the note's project_id:

```typescript
useEffect(() => {
  if (open) {
    fetchTags(note.project_id ?? undefined);
    fetchProjects();
  }
}, [open, fetchTags, fetchProjects, note.project_id]);
```

**Step 2: Commit**

---

### Task 8: Board card tag dots — no changes needed

Board cards already render `note.tags` as colored badges (BoardView.tsx:162-169). Project-scoped tags assigned to tasks will display automatically.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add `project_id` to Tag model + DB migration | models.py, database.py |
| 2 | Update schemas + API endpoints | schemas.py, tags.py, notes.py |
| 3 | Update shared types + API client | types.ts, api.ts |
| 4 | Update tags store | tags-store.ts |
| 5 | Update MetadataSidebar tag picker | MetadataSidebar.tsx |
| 6 | Sidebar global tags only | No changes needed |
| 7 | Update NoteActions tag submenu | NoteActions.tsx |
| 8 | Board card tag dots | No changes needed |
