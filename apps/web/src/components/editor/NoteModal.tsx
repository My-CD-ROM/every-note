import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useNotesStore } from '@/stores/notes-store';
import { useUIStore } from '@/stores/ui-store';
import { useNoteEditor } from '@/hooks/useNoteEditor';
import { cn } from '@/lib/utils';
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
          'p-0 gap-0 overflow-hidden max-w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)]',
          isBoardContext ? 'sm:max-w-4xl sm:max-h-[85vh]' : 'sm:max-w-3xl sm:max-h-[85vh]'
        )}
        onEscapeKeyDown={(e) => {
          if (hook.duePopoverOpen || hook.tagPopoverOpen || hook.recurrencePopoverOpen || hook.reminderPopoverOpen) {
            e.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">{hook.note?.title || 'Note'}</DialogTitle>

        {hook.note && (
          isBoardContext
            ? <BoardCardContent hook={hook} onClose={handleClose} />
            : <NoteEditorContent hook={hook} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
