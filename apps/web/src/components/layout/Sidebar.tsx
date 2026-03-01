import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  FolderIcon,
  LayoutDashboard,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Sun,
  Moon,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useFoldersStore } from '@/stores/folders-store';
import { useTagsStore } from '@/stores/tags-store';
import { useNotesStore } from '@/stores/notes-store';
import { useProjectsStore } from '@/stores/projects-store';
import { useUIStore } from '@/stores/ui-store';
import { exportApi } from '@/lib/api';
import type { FolderTree } from '@/lib/api';

const TAG_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const FOLDER_EMOJIS = [
  '📁', '📂', '📝', '📋', '📌', '📎', '📊', '📈',
  '🏠', '💼', '🎯', '🎨', '🎵', '🎮', '📚', '📖',
  '💡', '🔧', '⚙️', '🛠️', '🧪', '🔬', '💻', '🖥️',
  '🌟', '⭐', '❤️', '🔥', '✨', '🚀', '💎', '🎁',
  '🏢', '🏗️', '📦', '🗂️', '🗃️', '🗄️', '📑', '🔖',
  '🧠', '💭', '🎓', '📐', '✏️', '🖊️', '🖋️', '📏',
];

function EmojiPicker({ value, onChange }: { value: string | null; onChange: (emoji: string | null) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-6 w-6 shrink-0 flex items-center justify-center rounded hover:bg-sidebar-accent transition-colors text-sm"
          title="Pick icon"
          onClick={(e) => e.stopPropagation()}
        >
          {value || <FolderIcon className="h-4 w-4 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-8 gap-0.5">
          {FOLDER_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              className={cn(
                'h-7 w-7 flex items-center justify-center rounded text-sm hover:bg-muted transition-colors',
                value === emoji && 'bg-muted ring-1 ring-primary'
              )}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
        {value && (
          <button
            className="w-full mt-1.5 text-[10px] text-muted-foreground hover:text-foreground py-1 transition-colors"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Remove icon
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FolderNode({ folder, depth = 0 }: { folder: FolderTree; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(folder.name);
  const activeFolderId = useFoldersStore((s) => s.activeFolderId);
  const setActiveFolder = useFoldersStore((s) => s.setActiveFolder);
  const updateFolder = useFoldersStore((s) => s.updateFolder);
  const deleteFolder = useFoldersStore((s) => s.deleteFolder);
  const setView = useUIStore((s) => s.setView);
  const fetchNotes = useNotesStore((s) => s.fetchNotes);
  const setActiveNote = useNotesStore((s) => s.setActiveNote);
  const setActiveTag = useTagsStore((s) => s.setActiveTag);

  const isActive = activeFolderId === folder.id;
  const hasChildren = folder.children.length > 0;

  const handleRename = async () => {
    const trimmed = renameName.trim();
    if (trimmed && trimmed !== folder.name) {
      await updateFolder(folder.id, { name: trimmed });
    }
    setRenaming(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete folder "${folder.name}"? Notes inside will be unlinked.`)) return;
    if (activeFolderId === folder.id) {
      setActiveFolder(null);
      setView('all');
      fetchNotes();
    }
    await deleteFolder(folder.id);
  };

  return (
    <div>
      <div className="group flex items-center">
        <div
          role="button"
          tabIndex={0}
          className={cn(
            'flex flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer',
            'hover:bg-sidebar-accent',
            isActive && 'bg-sidebar-accent font-medium'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (renaming) return;
            setActiveFolder(folder.id);
            setActiveTag(null);
            setView('folder');
            setActiveNote(null);
            fetchNotes({ folder_id: folder.id });
          }}
          onKeyDown={(e) => { if (renaming) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveFolder(folder.id); setActiveTag(null); setView('folder'); setActiveNote(null); fetchNotes({ folder_id: folder.id }); } }}
        >
          {hasChildren ? (
            <ChevronRight
              className={cn('h-3.5 w-3.5 shrink-0 transition-transform', expanded && 'rotate-90')}
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            />
          ) : (
            <span className="w-3.5" />
          )}
          <EmojiPicker
            value={folder.icon}
            onChange={(emoji) => updateFolder(folder.id, { icon: emoji })}
          />
          {renaming ? (
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') { setRenaming(false); setRenameName(folder.name); }
              }}
              onBlur={handleRename}
              className="h-5 text-sm px-1 py-0"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className="truncate">{folder.name}</span>
              {folder.note_count > 0 && (
                <span className="ml-auto text-xs text-muted-foreground/60">{folder.note_count}</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center mr-1 opacity-0 group-hover:opacity-100">
          <a
            href={exportApi.folderUrl(folder.id)}
            download
            title="Export folder as .zip"
          >
            <Download className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </a>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-sidebar-accent"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => { setRenaming(true); setRenameName(folder.name); }}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderNode key={child.id} folder={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavItem({ icon: Icon, label, active, iconColor, onClick }: {
  icon: typeof FileText;
  label: string;
  active: boolean;
  iconColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
        'hover:bg-sidebar-accent',
        active && 'bg-sidebar-accent font-medium'
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" style={iconColor ? { color: iconColor } : undefined} />
      <span>{label}</span>
    </button>
  );
}

function SectionHeader({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1 flex items-center gap-2 px-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</span>
      <div className="flex-1 border-t border-border/40" />
      {action}
    </div>
  );
}

function ProjectItem({ project }: { project: { id: string; name: string; icon?: string | null; note_count: number } }) {
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(project.name);
  const { activeProjectId, setActiveProject, updateProject, deleteProject } = useProjectsStore();
  const setActiveFolder = useFoldersStore((s) => s.setActiveFolder);
  const setActiveTag = useTagsStore((s) => s.setActiveTag);
  const { setActiveNote, fetchNotes } = useNotesStore();
  const { setView, view } = useUIStore();

  const isActive = view === 'board' && activeProjectId === project.id;

  const handleRename = async () => {
    const trimmed = renameName.trim();
    if (trimmed && trimmed !== project.name) {
      await updateProject(project.id, { name: trimmed });
    }
    setRenaming(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete project "${project.name}"? Notes will be unlinked from the project.`)) return;
    if (activeProjectId === project.id) {
      setActiveProject(null);
      setView('all');
      fetchNotes();
    }
    await deleteProject(project.id);
  };

  return (
    <div className="group flex items-center">
      <button
        className={cn(
          'flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
          'hover:bg-sidebar-accent',
          isActive && 'bg-sidebar-accent font-medium'
        )}
        onClick={() => {
          if (renaming) return;
          setActiveProject(project.id);
          setActiveFolder(null);
          setActiveTag(null);
          setActiveNote(null);
          setView('board');
          fetchNotes({ project_id: project.id });
        }}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" style={{ color: '#E74C3C' }} />
        {renaming ? (
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') { setRenaming(false); setRenameName(project.name); }
            }}
            onBlur={handleRename}
            className="h-5 text-sm px-1 py-0"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="truncate">{project.icon ? `${project.icon} ` : ''}{project.name}</span>
            {project.note_count > 0 && (
              <span className="ml-auto text-xs text-muted-foreground/60">{project.note_count}</span>
            )}
          </>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="mr-1 h-5 w-5 flex items-center justify-center rounded hover:bg-sidebar-accent opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => { setRenaming(true); setRenameName(project.name); }}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Sidebar() {
  const { tree, fetchTree } = useFoldersStore();
  const { tags, fetchTags, activeTagId, setActiveTag, createTag } = useTagsStore();
  const { fetchNotes, setActiveNote } = useNotesStore();
  const { projects, fetchProjects, createProject } = useProjectsStore();
  const { theme, toggleTheme, setView, setSearchOpen, view } = useUIStore();
  const setActiveFolder = useFoldersStore((s) => s.setActiveFolder);

  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [showNewTag, setShowNewTag] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const createFolder = useFoldersStore((s) => s.createFolder);

  useEffect(() => {
    fetchTree();
    fetchTags();
    fetchProjects();
  }, [fetchTree, fetchTags, fetchProjects]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder({ name: newFolderName.trim() });
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    await createTag({ name: newTagName.trim(), color });
    setNewTagName('');
    setShowNewTag(false);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const project = await createProject({ name: newProjectName.trim() });
    setNewProjectName('');
    setShowNewProject(false);
    setActiveFolder(null);
    setActiveTag(null);
    setActiveNote(null);
    setView('board');
    fetchNotes({ project_id: project.id });
  };

  const nav = (v: typeof view, fetchParams?: Parameters<typeof fetchNotes>[0]) => {
    setActiveFolder(null);
    setActiveTag(null);
    setView(v);
    setActiveNote(null);
    if (fetchParams !== undefined) {
      fetchNotes(fetchParams);
    } else {
      fetchNotes();
    }
  };

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-base font-bold tracking-tight">Every Note</h1>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      {/* Search trigger */}
      <div className="px-3 pb-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-muted-foreground h-8 text-sm"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search...</span>
          <kbd className="ml-auto text-[10px] text-muted-foreground/50 font-mono">Ctrl K</kbd>
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        {/* ── NOTES ── */}
        <SectionHeader label="Notes" />
        <div className="space-y-0.5">
          <NavItem icon={FileText} label="All Notes" active={view === 'all'} onClick={() => nav('all')} />
          <NavItem icon={Star} label="Favorites" active={view === 'favorites'} iconColor="#f59e0b" onClick={() => nav('favorites', { pinned: true })} />
          <NavItem icon={CheckCircle2} label="Completed" active={view === 'completed'} iconColor="#10b981" onClick={() => nav('completed', { completed: true })} />
          <NavItem icon={Trash2} label="Trash" active={view === 'trash'} onClick={() => nav('trash', { trashed: true })} />
        </div>

        {/* Folders (sub-section under Notes) */}
        <div className="mt-2 mb-1 flex items-center justify-between px-2">
          <span className="text-[10px] font-medium text-muted-foreground/50">Folders</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setShowNewFolder(!showNewFolder)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {showNewFolder && (
          <div className="mb-1 px-1">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowNewFolder(false);
              }}
              placeholder="Folder name"
              className="h-7 text-sm"
              autoFocus
            />
          </div>
        )}

        {tree.map((folder) => (
          <FolderNode key={folder.id} folder={folder} />
        ))}

        {/* Tags (sub-section under Notes) */}
        <div className="mt-2 mb-1 flex items-center justify-between px-2">
          <span className="text-[10px] font-medium text-muted-foreground/50">Tags</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setShowNewTag(!showNewTag)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {showNewTag && (
          <div className="mb-1 px-1">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTag();
                if (e.key === 'Escape') setShowNewTag(false);
              }}
              placeholder="Tag name"
              className="h-7 text-sm"
              autoFocus
            />
          </div>
        )}

        {tags.map((tag) => (
          <button
            key={tag.id}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
              'hover:bg-sidebar-accent',
              activeTagId === tag.id && 'bg-sidebar-accent font-medium'
            )}
            onClick={() => {
              setActiveTag(tag.id);
              setActiveFolder(null);
              setView('tag');
              setActiveNote(null);
              fetchNotes({ tag_id: tag.id });
            }}
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="truncate">{tag.name}</span>
            {tag.note_count > 0 && (
              <span className="ml-auto text-xs text-muted-foreground/60">{tag.note_count}</span>
            )}
          </button>
        ))}

        {/* ── PROJECTS ── */}
        <SectionHeader
          label="Projects"
          action={
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setShowNewProject(!showNewProject)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          }
        />

        {showNewProject && (
          <div className="mb-1 px-1">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') setShowNewProject(false);
              }}
              placeholder="Project name"
              className="h-7 text-sm"
              autoFocus
            />
          </div>
        )}

        {projects.map((project) => (
          <ProjectItem key={project.id} project={project} />
        ))}

        {/* ── CALENDAR ── */}
        <SectionHeader label="Calendar" />
        <NavItem icon={CalendarDays} label="Calendar" active={view === 'daily'} iconColor="#3b82f6" onClick={() => { setActiveFolder(null); setActiveTag(null); setActiveNote(null); setView('daily'); }} />

        {/* ── FINANCE ── */}
        <SectionHeader label="Finance" />
        <NavItem
          icon={Wallet}
          label="Finance"
          active={view === 'finance'}
          iconColor="#7C756E"
          onClick={() => {
            setActiveFolder(null);
            setActiveTag(null);
            setActiveNote(null);
            setView('finance');
          }}
        />

        <div className="h-4" />
      </ScrollArea>
    </div>
  );
}
