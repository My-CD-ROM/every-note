# Modal Editor Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the right-side split-panel note editor with centered modal dialogs — GitHub Projects-style two-column for board cards, focused writing modal for regular notes.

**Architecture:** Two dialog variants sharing the same Radix Dialog shell. The existing `NoteEditor.tsx` (740 lines) is refactored into smaller, focused components: a metadata sidebar, a board card content layout, and a focused notes content layout. `activeNoteId` remains the trigger — when set, a modal opens instead of a side panel.

**Tech Stack:** React 19, Radix Dialog (existing), Zustand, Tailwind v4, shadcn/ui, CodeMirror 6 (via existing MarkdownEditor)

---

### Task 1: Extract shared editor hooks from NoteEditor

The existing NoteEditor.tsx has ~200 lines of hook logic (auto-save, title/content state, keyboard handlers, file upload). Extract these into a reusable hook so both modal variants can share them.

**Files:**
- Create: `apps/web/src/hooks/useNoteEditor.ts`
- Reference: `apps/web/src/components/editor/NoteEditor.tsx:40-277`

**Step 1: Create `useNoteEditor` hook**

Extract all state and logic from NoteEditor into a custom hook. This hook manages:
- `title`, `content`, `dirty`, `saving`, `justSaved` state
- `doSave`, `scheduleSave`, `flushSave` callbacks
- `dueDate`, `dueTime`, recurrence form state
- `handleTitleChange`, `handleContentChange`
- `handleSetDue`, `handleClearDue`
- `handleVersionRestore`
- `handleUploadFiles`
- Keyboard handler effects (Ctrl+S save, Esc close)
- Sync effect when activeNoteId changes
- beforeunload and unmount flush effects
- All popover open/close states
- Breadcrumb navigation state and handlers

The hook takes `{ note, activeNoteId }` and returns all the state + handlers the UI needs.

```typescript
// apps/web/src/hooks/useNoteEditor.ts
export function useNoteEditor() {
  const { notes, activeNoteId, updateNote, deleteNote, setActiveNote, fetchNotes, completeNote, uncompleteNote } = useNotesStore();
  const { tags, fetchTags } = useTagsStore();
  const note = notes.find((n) => n.id === activeNoteId);

  // ... all existing state and handlers from NoteEditor lines 46-276

  return {
    note, activeNoteId, tags,
    title, setTitle, content, setContent,
    dirty, saving, justSaved,
    handleTitleChange, handleContentChange, handleTitleKeyDown,
    flushSave,
    // Due date
    dueDate, setDueDate, dueTime, setDueTime,
    duePopoverOpen, setDuePopoverOpen,
    handleSetDue, handleClearDue,
    // Tags
    tagPopoverOpen, setTagPopoverOpen,
    // Recurrence
    recurrencePopoverOpen, setRecurrencePopoverOpen,
    recFreq, setRecFreq, recInterval, setRecInterval,
    // Reminder
    reminderPopoverOpen, setReminderPopoverOpen,
    // Attachments
    uploading, handleUploadFiles, fileInputRef, attachKey,
    // History
    showHistory, setShowHistory, handleVersionRestore,
    // Breadcrumbs
    parentStack, handleOpenSubtask, handleBreadcrumbNav,
    // Editor ref
    editorRef, selectionCoords, setSelectionCoords,
    // Animation ref
    wrapperRef,
    // Notes store actions
    updateNote, deleteNote, setActiveNote, fetchNotes, completeNote, uncompleteNote,
    fetchTags,
    // Computed
    isPastDue: note?.due_at ? new Date(note.due_at) < new Date() : false,
  };
}
```

**Step 2: Verify existing NoteEditor still works**

After extracting the hook, temporarily refactor `NoteEditor.tsx` to consume `useNoteEditor()` instead of having inline state. Verify TS compiles. This ensures the hook API is correct before building the new modals.

Run: `npx --package=typescript tsc --noEmit --project tsconfig.app.json 2>&1 | grep -E "NoteEditor|useNoteEditor"`

**Step 3: Commit**

```bash
git add apps/web/src/hooks/useNoteEditor.ts apps/web/src/components/editor/NoteEditor.tsx
git commit -m "refactor: extract useNoteEditor hook from NoteEditor"
```

---

### Task 2: Create MetadataSidebar component for board modal

Extract all metadata fields (status, due date, tags, recurrence, folder, reminder, actions) into a standalone sidebar component used by the board card modal.

**Files:**
- Create: `apps/web/src/components/editor/MetadataSidebar.tsx`
- Reference: `apps/web/src/components/editor/NoteEditor.tsx:353-608` (popovers and toolbar buttons)
- Reference: `apps/web/src/lib/statuses.ts` (status definitions)
- Reference: `apps/web/src/components/notes/NoteActions.tsx` (folder/tag/project pickers)

**Step 1: Create MetadataSidebar component**

This is a vertical sidebar with labeled fields. Each field is directly inline-editable (no popover-in-popover). Fields:

```tsx
// apps/web/src/components/editor/MetadataSidebar.tsx
export function MetadataSidebar({ hook }: { hook: ReturnType<typeof useNoteEditor> }) {
  // Renders:
  // - Status dropdown (STATUSES from lib/statuses.ts) — only if note.project_id
  // - Due date section with Calendar + time input
  // - Tags section with tag list + add/remove
  // - Recurrence section with freq/interval
  // - Folder assignment dropdown
  // - Reminder section with quick-set buttons
  // - Separator
  // - Actions: favorite toggle, mark complete, move to trash
}
```

Each section has a label (`text-xs font-medium text-muted-foreground uppercase tracking-wide`) and the editable control below it. Sections are stacked vertically with `space-y-4`.

For the status dropdown: render colored dots + labels from `STATUSES`, call `notesApi.setStatus()` on change.

For tags: list existing tags as pills, add tag via a small popover or inline picker.

For folder: simple dropdown using the folder tree (same pattern as NoteActions).

**Step 2: Type-check**

Run: `npx --package=typescript tsc --noEmit --project tsconfig.app.json 2>&1 | grep MetadataSidebar`

**Step 3: Commit**

```bash
git add apps/web/src/components/editor/MetadataSidebar.tsx
git commit -m "feat: add MetadataSidebar component for board modal"
```

---

### Task 3: Create NoteModal shell component

The shared modal shell that wraps both content variants. Uses the existing Radix Dialog primitive.

**Files:**
- Create: `apps/web/src/components/editor/NoteModal.tsx`
- Reference: `apps/web/src/components/ui/dialog.tsx`
- Reference: `apps/web/src/stores/ui-store.ts`

**Step 1: Create NoteModal component**

```tsx
// apps/web/src/components/editor/NoteModal.tsx
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useNotesStore } from '@/stores/notes-store';
import { useUIStore } from '@/stores/ui-store';
import { useNoteEditor } from '@/hooks/useNoteEditor';
import { BoardCardContent } from './BoardCardContent';
import { NoteEditorContent } from './NoteEditorContent';

export function NoteModal() {
  const { activeNoteId, setActiveNote } = useNotesStore();
  const view = useUIStore((s) => s.view);
  const hook = useNoteEditor();

  const isOpen = !!activeNoteId && !!hook.note;
  const isBoardContext = view === 'board';

  const handleClose = () => {
    hook.flushSave();
    setActiveNote(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'p-0 gap-0 overflow-hidden',
          isBoardContext
            ? 'sm:max-w-4xl max-h-[85vh]'   // Board: wider
            : 'sm:max-w-3xl max-h-[85vh]'    // Notes: focused
        )}
        // Prevent Esc from closing while popovers are open
        onEscapeKeyDown={(e) => {
          if (hook.duePopoverOpen || hook.tagPopoverOpen || hook.recurrencePopoverOpen || hook.reminderPopoverOpen) {
            e.preventDefault();
          }
        }}
      >
        {hook.note && (
          isBoardContext
            ? <BoardCardContent hook={hook} onClose={handleClose} />
            : <NoteEditorContent hook={hook} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
```

Key decisions:
- `showCloseButton={false}` — each content variant renders its own close button with custom placement
- `max-h-[85vh]` — modal doesn't take full viewport, comfortable
- `p-0 gap-0` — remove default dialog padding, content variants manage their own padding
- Esc is intercepted when sub-popovers are open

**Step 2: Type-check**

Run: `npx --package=typescript tsc --noEmit --project tsconfig.app.json 2>&1 | grep NoteModal`

**Step 3: Commit**

```bash
git add apps/web/src/components/editor/NoteModal.tsx
git commit -m "feat: add NoteModal shell with dialog routing"
```

---

### Task 4: Create BoardCardContent component

The GitHub Projects-style two-column layout for editing board cards.

**Files:**
- Create: `apps/web/src/components/editor/BoardCardContent.tsx`
- Reference: `apps/web/src/components/editor/MetadataSidebar.tsx` (Task 2)

**Step 1: Create BoardCardContent**

```
┌────────────────────────────────────────────────────┐
│  [X]  Title input                       Saved ✓   │
│  ──────────────────────────────────────────────────│
│  ┌──────────────────────┐  ┌──────────────────────┐│
│  │  Editor area         │  │  MetadataSidebar     ││
│  │  (scrollable)        │  │  (scrollable)        ││
│  │                      │  │                      ││
│  │  ▸ Subtasks          │  │                      ││
│  │  ▸ Attachments       │  │                      ││
│  │  ▸ Backlinks         │  │                      ││
│  └──────────────────────┘  └──────────────────────┘│
└────────────────────────────────────────────────────┘
```

Layout structure:
- Top bar: close button, title input, save status indicator (same toolbar row)
- Below: `flex` with left column (editor + collapsible sections in a ScrollArea) and right column (MetadataSidebar in a ScrollArea, `w-72 border-l`)
- On mobile (`< md`): single column, MetadataSidebar collapses into a horizontal strip or bottom section

```tsx
// apps/web/src/components/editor/BoardCardContent.tsx
export function BoardCardContent({ hook, onClose }: { hook: ReturnType<typeof useNoteEditor>; onClose: () => void }) {
  const { note } = hook;
  if (!note) return null;

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Header: close + title + save status */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
        <Input value={hook.title} onChange={(e) => hook.handleTitleChange(e.target.value)} onKeyDown={hook.handleTitleKeyDown} placeholder="Untitled" className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0 flex-1" />
        {/* save status indicator */}
      </div>

      {/* Body: two columns */}
      <div className="flex flex-1 min-h-0">
        {/* Left: editor + sections */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Status bars */}
            {/* Editor (markdown/checklist) */}
            {/* Subtasks */}
            {/* Attachments */}
            {/* Backlinks */}
          </div>
        </ScrollArea>

        {/* Right: metadata sidebar */}
        <ScrollArea className="hidden md:block w-72 border-l">
          <MetadataSidebar hook={hook} />
        </ScrollArea>
      </div>
    </div>
  );
}
```

**Step 2: Type-check**

**Step 3: Commit**

```bash
git add apps/web/src/components/editor/BoardCardContent.tsx
git commit -m "feat: add BoardCardContent two-column layout"
```

---

### Task 5: Create NoteEditorContent component

The focused writing modal for regular notes.

**Files:**
- Create: `apps/web/src/components/editor/NoteEditorContent.tsx`

**Step 1: Create NoteEditorContent**

```
┌──────────────────────────────────────────────┐
│  [X]  Title input                   Saved ✓  │
│  ⭐  📅  🏷  📎  🔔  🔄  ⋯                 │
│  ──────────────────────────────────────────── │
│  ┌──────────────────────────────────────────┐ │
│  │                                          │ │
│  │       Markdown / Checklist editor        │ │
│  │       (main scrollable area)             │ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│  ▸ Subtasks (2/5)     ▸ Attachments (1)      │
│  ▸ Backlinks                                  │
│  ┌─ conditional status bars ───────────────┐  │
│  │  📅 Due...  │  🔄 Every...  │  🏷 tags  │  │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

Layout structure:
- Top bar: close button + title input + save status
- Toolbar row: icon buttons for star, due, tags, attach, remind, recurrence, more menu (same as current NoteEditor toolbar, but single compact row)
- Editor area: ScrollArea taking remaining height, contains markdown/checklist + floating format toolbar
- Bottom section: collapsible subtasks/attachments/backlinks + conditional status bars

The editor area gets `flex-1` so it expands to fill the modal.

```tsx
// apps/web/src/components/editor/NoteEditorContent.tsx
export function NoteEditorContent({ hook, onClose }: { hook: ReturnType<typeof useNoteEditor>; onClose: () => void }) {
  // Reuses same popovers and toolbar buttons from current NoteEditor
  // but arranged in a compact single-row toolbar
  // Editor area gets maximum height
}
```

Move the toolbar buttons (star, due date popover, tag popover, attach, remind, recurrence, more menu) from NoteEditor.tsx here. The popovers remain the same — Calendar, tag list, recurrence form, reminder shortcuts.

**Step 2: Type-check**

**Step 3: Commit**

```bash
git add apps/web/src/components/editor/NoteEditorContent.tsx
git commit -m "feat: add NoteEditorContent focused writing layout"
```

---

### Task 6: Wire NoteModal into App.tsx and remove side panels

Replace all side-panel NoteEditor renderings with the single NoteModal.

**Files:**
- Modify: `apps/web/src/App.tsx:1-170`
- Modify: `apps/web/src/components/board/BoardView.tsx`

**Step 1: Update App.tsx**

In `NotesPage` component:

1. Remove the NoteEditor import
2. Add NoteModal import
3. Remove the split-panel rendering for list views (lines 156-167)
4. Remove the side-panel rendering for board view (lines 140-144)
5. For list views: always render full-width NoteList (remove the `!activeNoteId` condition)
6. Render `<NoteModal />` once at the end of NotesPage, outside any view conditionals

Before:
```tsx
{isListView && !activeNoteId && (
  <div className="flex-1 overflow-hidden">
    <ScrollArea className="h-full"><NoteList expanded /></ScrollArea>
  </div>
)}
{isListView && activeNoteId && (
  <div className="flex flex-1 overflow-hidden">
    <div className="hidden md:flex w-72 ..."><NoteList /></div>
    <div className="flex-1 min-w-0"><NoteEditor /></div>
  </div>
)}
```

After:
```tsx
{isListView && (
  <div className="flex-1 overflow-hidden">
    <ScrollArea className="h-full"><NoteList expanded /></ScrollArea>
  </div>
)}
```

For board view, remove the NoteEditor side panel:
```tsx
{/* Before: */}
{activeNoteId && (
  <div className="hidden md:block w-[480px] ..."><NoteEditor /></div>
)}

{/* After: remove entirely */}
```

Add NoteModal at the bottom of NotesPage return:
```tsx
<NoteModal />
```

7. Update TopBar: the mobile back button (`activeNoteId ? ArrowLeft : Menu`) now just clears the note (which closes the modal). This should still work since `setActiveNote(null)` closes the dialog.

**Step 2: Update BoardView**

In BoardView.tsx, remove the import and rendering context for side panel. Board cards already call `setActiveNote(note.id)` on click — this now opens the modal.

**Step 3: Type-check**

Run: `npx --package=typescript tsc --noEmit --project tsconfig.app.json 2>&1 | head -20`

**Step 4: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/board/BoardView.tsx
git commit -m "feat: replace side panels with NoteModal"
```

---

### Task 7: Clean up old NoteEditor and verify

The original `NoteEditor.tsx` is now dead code (all rendering moved to BoardCardContent and NoteEditorContent, all logic moved to useNoteEditor hook).

**Files:**
- Delete or gut: `apps/web/src/components/editor/NoteEditor.tsx`

**Step 1: Remove NoteEditor.tsx**

Delete the file entirely, or convert it to a thin re-export if other files import from it. Check for any remaining imports:

```bash
grep -r "NoteEditor" apps/web/src/ --include="*.tsx" --include="*.ts"
```

Remove any remaining imports. The only consumer should now be the NoteModal via BoardCardContent and NoteEditorContent.

**Step 2: Type-check full project**

Run: `npx --package=typescript tsc --noEmit --project tsconfig.app.json 2>&1 | head -30`

**Step 3: Manual verification**

Test in browser:
- Click a note in list view → modal opens (focused writing)
- Click a card in board view → modal opens (two-column GitHub style)
- Esc closes modal
- Backdrop click closes modal
- Auto-save works (edit title, wait 1s, close, reopen)
- Mobile: modal is near-full-screen

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove old NoteEditor side panel"
```

---

### Task 8: Mobile responsiveness

Ensure both modal variants work well on small screens.

**Files:**
- Modify: `apps/web/src/components/editor/BoardCardContent.tsx`
- Modify: `apps/web/src/components/editor/NoteEditorContent.tsx`
- Modify: `apps/web/src/components/editor/NoteModal.tsx`

**Step 1: Mobile sizing for NoteModal**

In `NoteModal.tsx`, update DialogContent className to be near-full-screen on mobile:
```tsx
className={cn(
  'p-0 gap-0 overflow-hidden max-w-[calc(100%-1rem)] max-h-[calc(100%-1rem)]',
  isBoardContext ? 'sm:max-w-4xl sm:max-h-[85vh]' : 'sm:max-w-3xl sm:max-h-[85vh]'
)}
```

**Step 2: Board modal single-column on mobile**

In `BoardCardContent.tsx`, the metadata sidebar (`w-72 border-l`) is already `hidden md:block`. On mobile, add a collapsible metadata section below the editor using a `ChevronDown/ChevronUp` toggle.

**Step 3: Mobile back button cleanup**

In `App.tsx` TopBar: the mobile back button for `activeNoteId` may no longer be needed since the modal handles its own close. Either remove it or keep it as a secondary close mechanism.

**Step 4: Commit**

```bash
git add apps/web/src/components/editor/BoardCardContent.tsx apps/web/src/components/editor/NoteEditorContent.tsx apps/web/src/components/editor/NoteModal.tsx apps/web/src/App.tsx
git commit -m "feat: mobile responsive modal layouts"
```

---

### Dependency Order

```
Task 1 (useNoteEditor hook)
  ├── Task 2 (MetadataSidebar) ─────┐
  ├── Task 5 (NoteEditorContent) ───┤
  └── Task 3 (NoteModal shell) ─────┤
       └── Task 4 (BoardCardContent)┘
                                    └── Task 6 (Wire into App.tsx)
                                         └── Task 7 (Clean up)
                                              └── Task 8 (Mobile)
```

Tasks 2, 3, 5 can run in parallel after Task 1. Task 4 depends on Tasks 2+3. Task 6 depends on all content components. Tasks 7-8 are sequential at the end.
