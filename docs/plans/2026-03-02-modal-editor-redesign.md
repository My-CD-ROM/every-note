# Modal Editor Redesign

## Context

Replace the current right-side split-panel editor with centered modal dialogs. Two distinct modal layouts: GitHub Projects-style for board cards, focused writing modal for regular notes.

## Board Card Modal (GitHub-style two-column)

Max width ~896px (max-w-4xl). Two columns inside:

**Left column (60%)**:
- Editable title (large, prominent)
- Markdown/checklist editor (primary content area)
- Collapsible sections: subtasks, attachments, backlinks

**Right column (40%) — metadata sidebar**:
- Status dropdown (prominent, top of sidebar)
- Due date (inline editable with calendar picker)
- Tags (list with add/remove)
- Recurrence (display + edit)
- Folder assignment
- Reminder (set/manage)
- Separator
- Actions: Favorite toggle, Mark complete, Move to trash

All metadata fields are directly editable inline — no nested popovers. The sidebar IS the metadata panel.

## Notes Modal (Focused Writing)

Max width ~768px (max-w-3xl). Single column, editor-first:

1. **Title** — large editable input
2. **Compact toolbar row** — icon buttons: star, due date, tags, attach, remind, recurrence, more menu. Auto-save indicator on right.
3. **Editor area** — takes 60-70% of modal height. Markdown or checklist. Hero of the modal.
4. **Collapsible sections** — subtasks, attachments, backlinks as compact headers. Expand on click.
5. **Status footer** — conditional bars for due date, recurrence, tags (at bottom, not between toolbar and editor)

## Shared Behavior

- **Open**: `activeNoteId` triggers modal render (replaces side panel logic in App.tsx)
- **Close**: backdrop click, Esc, or X button. Flushes auto-save before closing.
- **Animations**: Radix Dialog defaults — zoom-in-95 open, zoom-out-95 close, bg-black/50 backdrop
- **Mobile (<md)**: Near-full-screen with 8px inset. Board modal collapses to single column.
- **Keyboard**: Esc closes, Ctrl+S saves, Tab title→editor
- **URL**: Hash updates to `#note/{id}` for direct linking, browser back closes modal
- **Version history**: Nested panel inside modal (right-side slide-in within dialog content)

## Implementation Strategy

1. Create `NoteModal` wrapper that uses Dialog primitive with two content variants
2. Create `BoardCardContent` component (two-column layout for board context)
3. Create `NoteEditorContent` component (focused writing layout for notes context)
4. Extract metadata sidebar as a reusable component from current NoteEditor
5. Update App.tsx to render modal instead of side panel for all views
6. Update BoardView to open modal instead of side panel
7. Mobile: responsive collapse within both modal variants
8. URL hash routing for note modals

## Files to Modify

- `apps/web/src/App.tsx` — remove split-panel rendering, add modal trigger
- `apps/web/src/components/editor/NoteEditor.tsx` — refactor into modal content components
- `apps/web/src/components/board/BoardView.tsx` — remove side panel, use modal
- `apps/web/src/stores/ui-store.ts` — may need modal context state (board vs notes)
- `apps/web/src/hooks/useRouter.ts` — hash routing for note modals

## New Files

- `apps/web/src/components/editor/NoteModal.tsx` — modal shell + routing logic
- `apps/web/src/components/editor/BoardCardContent.tsx` — two-column board layout
- `apps/web/src/components/editor/NoteEditorContent.tsx` — focused writing layout
- `apps/web/src/components/editor/MetadataSidebar.tsx` — extracted metadata panel
