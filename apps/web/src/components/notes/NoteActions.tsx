import { useState, useEffect } from 'react';
import { ArrowUpFromDot, Circle, CornerDownRight, LayoutDashboard, MoreHorizontal, FolderIcon, Star, Tag, Undo2, Trash2, CheckCircle2 } from 'lucide-react';
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
import { useProjectsStore } from '@/stores/projects-store';
import { notesApi } from '@/lib/api';
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
  const { projects, fetchProjects, activeProjectId } = useProjectsStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTags(note.project_id ?? undefined);
      fetchProjects();
    }
  }, [open, fetchTags, fetchProjects, note.project_id]);

  const folders = flattenFolders(tree);

  if (note.is_trashed) {
    return (
      <div className="flex gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="Restore"
          onClick={async () => {
            await restoreNote(note.id);
            fetchNotes({ trashed: true });
          }}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red-500"
          title="Delete permanently"
          onClick={() => deleteNote(note.id, true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (note.is_completed) {
    return (
      <div className="flex gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="Restore"
          onClick={async () => {
            await uncompleteNote(note.id);
            fetchNotes({ completed: true });
          }}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red-500"
          title="Move to trash"
          onClick={async () => {
            await deleteNote(note.id);
            fetchNotes({ completed: true });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
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

        {/* Move to project — only for project tasks */}
        {note.project_id && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <LayoutDashboard className="mr-2 h-4 w-4" /> Move to project
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={async () => {
                  await updateNote(note.id, { project_id: null });
                  setOpen(false);
                }}
              >
                No project
              </DropdownMenuItem>
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={async () => {
                    await updateNote(note.id, { project_id: p.id });
                    if (view === 'board' && activeProjectId) {
                      fetchNotes({ project_id: activeProjectId });
                    } else {
                      fetchNotes();
                    }
                    setOpen(false);
                  }}
                >
                  {p.icon ? `${p.icon} ` : ''}{p.name}
                  {note.project_id === p.id && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

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

        {/* Set status — only for project tasks */}
        {note.project_id && (
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
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => updateNote(note.id, { is_pinned: !note.is_pinned })}
        >
          <Star className="mr-2 h-4 w-4" /> {note.is_pinned ? 'Unfavorite' : 'Favorite'}
        </DropdownMenuItem>

        {!note.project_id && (
          <DropdownMenuItem onClick={() => completeNote(note.id)}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Complete
          </DropdownMenuItem>
        )}

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
