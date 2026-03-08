import { useState } from 'react';
import { CalendarClock, Check, CheckCircle2, ChevronRight, ChevronUp, Loader2, Repeat, Settings2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownEditor } from './MarkdownEditor';
import { FormatToolbar } from './FormatToolbar';
import { Backlinks } from './Backlinks';
import { AttachmentPanel } from './AttachmentPanel';
import { MetadataSidebar } from './MetadataSidebar';
import { notesApi } from '@/lib/api';
import type { RecurrenceRule } from '@/lib/api';
import type { useNoteEditor } from '@/hooks/useNoteEditor';

const FREQ_OPTIONS: { value: RecurrenceRule['freq']; label: string }[] = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'yearly', label: 'Year' },
];

function formatRecurrence(rule: RecurrenceRule): string {
  const freq = FREQ_OPTIONS.find((f) => f.value === rule.freq);
  if (rule.interval === 1) return `Every ${freq?.label.toLowerCase() || rule.freq}`;
  return `Every ${rule.interval} ${freq?.label.toLowerCase() || rule.freq}s`;
}

function formatDueAt(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} at ${time}`;
}

interface Props {
  hook: ReturnType<typeof useNoteEditor>;
  onClose: () => void;
}

export function BoardCardContent({ hook, onClose }: Props) {
  const {
    note,
    fetchNotes,
    uncompleteNote,
    parentStack,
    handleOpenSubtask,
    handleBreadcrumbNav,
    title,
    content,
    dirty,
    saving,
    justSaved,
    selectionCoords,
    setSelectionCoords,
    isDragOver,
    setIsDragOver,
    attachKey,
    fileInputRef,
    editorRef,
    wrapperRef,
    flushSave,
    handleTitleChange,
    handleContentChange,
    handleTitleKeyDown,
    handleUploadFiles,
  } = hook;

  const [showMobileMetadata, setShowMobileMetadata] = useState(false);

  if (!note) return null;

  const isPastDue = note.due_at && new Date(note.due_at) < new Date();

  return (
    <div ref={wrapperRef} className="flex flex-col max-h-[calc(100vh-1rem)] sm:max-h-[85vh] animate-fade-in-up">
      {/* Header bar: close + title + save status */}
      <div className="flex items-center gap-1 border-b px-4 py-2 bg-background/50 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => { flushSave(); onClose(); }}
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </Button>
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          placeholder="Untitled"
          className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 md:hidden"
          onClick={() => setShowMobileMetadata(!showMobileMetadata)}
          title="Toggle metadata"
        >
          {showMobileMetadata ? <ChevronUp className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
        </Button>
        <div className="flex items-center gap-1 shrink-0 min-w-[60px] justify-end">
          {saving && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving
            </span>
          )}
          {!saving && justSaved && (
            <span className="flex items-center gap-1 text-[10px] text-primary">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
          {dirty && !saving && (
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" title="Unsaved changes" />
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left column: editor + bottom sections */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          {/* Breadcrumb navigation for subtasks */}
          {parentStack.length > 0 && (
            <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-muted/30 text-xs shrink-0">
              {parentStack.map((parent) => (
                <span key={parent.id} className="flex items-center gap-1">
                  <button
                    onClick={() => handleBreadcrumbNav(parent.id)}
                    className="text-muted-foreground hover:text-foreground hover:underline transition-colors truncate max-w-[150px]"
                  >
                    {parent.title}
                  </button>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                </span>
              ))}
              <span className="text-foreground font-medium truncate">{title || 'Untitled'}</span>
            </div>
          )}

          {/* Completed indicator bar */}
          {note.is_completed && (
            <div className="flex items-center gap-2 px-4 py-1.5 text-xs border-b bg-primary/5 dark:bg-primary/10 text-primary shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Completed {note.completed_at ? new Date(note.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
              <button
                onClick={() => uncompleteNote(note.id)}
                className="ml-auto flex items-center gap-1 hover:opacity-80 transition-colors"
              >
                <Undo2 className="h-3 w-3" />
                Uncomplete
              </button>
            </div>
          )}

          {/* Due date indicator bar */}
          {note.due_at && (
            <div className={`flex items-center gap-2 px-4 py-1 text-xs border-b shrink-0 ${
              isPastDue ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400' : 'bg-primary/10 text-primary'
            }`}>
              <CalendarClock className="h-3 w-3" />
              <span>Due {formatDueAt(note.due_at)}</span>
              {isPastDue && <span className="font-medium">(overdue)</span>}
            </div>
          )}

          {/* Recurrence indicator bar */}
          {note.recurrence_rule && (
            <div className="flex items-center gap-2 px-4 py-1 text-xs border-b bg-primary/5 text-primary shrink-0">
              <Repeat className="h-3 w-3" />
              <span>{formatRecurrence(note.recurrence_rule)}</span>
            </div>
          )}

          {/* Tags bar */}
          {note.tags.length > 0 && (
            <div className="flex items-center gap-1.5 px-4 py-1 border-b flex-wrap shrink-0">
              {note.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 cursor-pointer hover:opacity-70 transition-opacity"
                  style={{ color: tag.color, backgroundColor: `${tag.color}18` }}
                  title={`Remove tag: ${tag.name}`}
                  onClick={async () => {
                    await notesApi.removeTag(note.id, tag.id);
                    fetchNotes();
                  }}
                >
                  {tag.name}
                  <X className="h-2.5 w-2.5" />
                </span>
              ))}
            </div>
          )}

          {/* Floating format toolbar (appears on text selection) */}
          {selectionCoords && (
            <FormatToolbar editorRef={editorRef} coords={selectionCoords} />
          )}

          {/* Scrollable editor + bottom sections */}
          <ScrollArea className="flex-1">
            {/* Editor area with drag-and-drop */}
            <div
              className={`relative ${isDragOver ? 'ring-2 ring-primary ring-inset' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files.length) handleUploadFiles(e.dataTransfer.files);
              }}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.items)
                  .filter((item) => item.kind === 'file')
                  .map((item) => item.getAsFile())
                  .filter((f): f is File => f !== null);
                if (files.length > 0) {
                  e.preventDefault();
                  handleUploadFiles(files);
                }
              }}
            >
              {isDragOver && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-md pointer-events-none">
                  <span className="text-sm font-medium text-primary">Drop to attach</span>
                </div>
              )}
              <MarkdownEditor
                ref={editorRef}
                value={content}
                onChange={handleContentChange}
                onSelectionChange={setSelectionCoords}
                className="h-full"
              />
            </div>



            <AttachmentPanel
              key={`attach-${note.id}-${attachKey}`}
              noteId={note.id}
              onInsert={(md) => editorRef.current?.insertAtCursor(md)}
            />

            <Backlinks noteId={note.id} />
          </ScrollArea>

          {/* Hidden file input for uploads */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleUploadFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* Right column: metadata sidebar */}
        <div className="hidden md:block w-72 border-l shrink-0">
          <ScrollArea className="h-full">
            <MetadataSidebar hook={hook} />
          </ScrollArea>
        </div>
      </div>

      {/* Mobile metadata (collapsible, below editor) */}
      {showMobileMetadata && (
        <div className="md:hidden border-t">
          <MetadataSidebar hook={hook} />
        </div>
      )}
    </div>
  );
}
