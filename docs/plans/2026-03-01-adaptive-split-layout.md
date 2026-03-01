# Adaptive Split Layout

## Problem
The 3-panel layout (sidebar + narrow 256px note list + right panel) wastes space. The note list is cramped and the right panel shows a low-value dashboard when no note is selected.

## Design
Replace the fixed 3-panel layout with an adaptive layout that responds to whether a note is selected.

### No note selected — Full-width Note Grid
- Note list fills the entire content area (right of sidebar)
- Notes display as a responsive grid: `grid-cols-2 xl:grid-cols-3`
- Cards show title + metadata only (date, folder, due, tags, checklist count)
- Pinned/General groups with collapsible headers
- Filter input spans full width at top

### Note selected — Split View
- Grid collapses into a narrow single-column list (~280px) on the left
- Editor takes remaining space on the right (flex-1)
- Active note highlighted in list for quick switching

### Removed
- Dashboard panel (greeting, stats, recent notes) — the note grid replaces it

## Files
- `App.tsx` — conditional layout based on `activeNoteId`
- `NoteList.tsx` — `expanded` prop to toggle grid vs compact list
- `DashboardPanel.tsx` — stop rendering
