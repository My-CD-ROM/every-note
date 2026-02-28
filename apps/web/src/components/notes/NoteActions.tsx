import { useState, useEffect } from 'react';
import { ArrowUpFromDot, Circle, CornerDownRight, MoreHorizontal, FolderIcon, Tag, Undo2, Trash2, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotesStore } from '@/stores/notes-store';
import { useFoldersStore } from '@/stores/folders-store';
import { useTagsStore } from '@/stores/tags-store';
import { useUIStore } from '@/stores/ui-store';
import { notesApi, exportApi } from '@/lib/api';
import type { FolderTree, NoteResponse } from '@/lib/api';
import { STATUSES } from '@/lib/statuses';

function flattenFolders(tree: FolderTree[], depth = 0): Array<FolderTree & { depth: number }> {
  const result: Array<FolderTree & { depth: number }> = [];
  for (const f of tree) {
    result.push({ ...f, depth });
    result.push(...flattenFolders(f.children, depth + 1));
  }
  return result;
}

export function NoteActions({ note }: { note: NoteResponse }) {
  const { notes, updateNote, deleteNote, restoreNote, completeNote, uncompleteNote, fetchNotes } = useNotesStore();
  const { tree, activeFolderId } = useFoldersStore();
  const { tags, fetchTags, activeTagId } = useTagsStore();
  const view = useUIStore((s) => s.view);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) fetchTags();
  }, [open, fetchTags]);

  const folders = flattenFolders(tree);

  if (note.is_trashed) {
    return (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={async () => {
            await restoreNote(note.id);
            fetchNotes({ trashed: true });
          }}
        >
          <Undo2 className="mr-1 h-3 w-3" /> Restore
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-red-500"
          onClick={() => deleteNote(note.id, true)}
        >
          <Trash2 className="mr-1 h-3 w-3" /> Delete
        </Button>
      </div>
    );
  }

  if (note.is_completed) {
    return (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={async () => {
            await uncompleteNote(note.id);
            fetchNotes({ completed: true });
          }}
        >
          <Undo2 className="mr-1 h-3 w-3" /> Restore
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-red-500"
          onClick={async () => {
            await deleteNote(note.id);
            fetchNotes({ completed: true });
          }}
        >
          <Trash2 className="mr-1 h-3 w-3" /> Trash
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Move to folder */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderIcon className="mr-2 h-4 w-4" /> Move to folder
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={async () => {
                await updateNote(note.id, { folder_id: null });
                setOpen(false);
              }}
            >
              No folder
            </DropdownMenuItem>
            {folders.map((f) => (
              <DropdownMenuItem
                key={f.id}
                onClick={async () => {
                  await updateNote(note.id, { folder_id: f.id });
                  setOpen(false);
                }}
                style={{ paddingLeft: `${f.depth * 12 + 8}px` }}
              >
                {f.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Tags */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Tag className="mr-2 h-4 w-4" /> Tags
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {tags.map((tag) => {
              const hasTag = note.tags.some((t) => t.id === tag.id);
              return (
                <DropdownMenuItem
                  key={tag.id}
                  onClick={async () => {
                    if (hasTag) {
                      await notesApi.removeTag(note.id, tag.id);
                    } else {
                      await notesApi.addTag(note.id, tag.id);
                    }
                    fetchNotes(
                      view === 'folder' ? { folder_id: activeFolderId ?? undefined } :
                      view === 'tag' ? { tag_id: activeTagId ?? undefined } :
                      view === 'trash' ? { trashed: true } :
                      undefined
                    );
                  }}
                >
                  <span
                    className="mr-2 h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                  {hasTag && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Convert to subtask / Promote to note */}
        {note.parent_id ? (
          <DropdownMenuItem
            onClick={async () => {
              await updateNote(note.id, { parent_id: null });
              fetchNotes();
              setOpen(false);
            }}
          >
            <ArrowUpFromDot className="mr-2 h-4 w-4" /> Promote to note
          </DropdownMenuItem>
        ) : note.subtask_count === 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CornerDownRight className="mr-2 h-4 w-4" /> Convert to subtask
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {notes
                .filter((n) => n.id !== note.id && !n.parent_id && !n.is_daily && n.subtask_count >= 0)
                .slice(0, 20)
                .map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    onClick={async () => {
                      await updateNote(note.id, { parent_id: n.id });
                      fetchNotes();
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{n.title || 'Untitled'}</span>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* Set status */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Circle className="mr-2 h-4 w-4" /> Set status
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {STATUSES.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={async () => {
                  await notesApi.setStatus(note.id, s.id);
                  fetchNotes();
                  setOpen(false);
                }}
              >
                <span className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
                {note.status === s.id && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            ))}
            {note.status && (
              <DropdownMenuItem
                onClick={async () => {
                  await notesApi.setStatus(note.id, null);
                  fetchNotes();
                  setOpen(false);
                }}
              >
                Remove status
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => updateNote(note.id, { is_pinned: !note.is_pinned })}
        >
          {note.is_pinned ? 'Unfavorite' : 'Favorite'}
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a href={exportApi.noteUrl(note.id)} download>
            <Download className="mr-2 h-4 w-4" /> Export as .md
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => completeNote(note.id)}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Complete
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-red-500"
          onClick={() => deleteNote(note.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
