import { create } from 'zustand';
import type { FolderTree } from '@/lib/api';
import { foldersApi } from '@/lib/api';

function flattenTree(nodes: FolderTree[]): Record<string, string> {
  const map: Record<string, string> = {};
  const walk = (list: FolderTree[]) => {
    for (const f of list) {
      map[f.id] = f.name;
      if (f.children) walk(f.children);
    }
  };
  walk(nodes);
  return map;
}

interface FoldersState {
  tree: FolderTree[];
  folderMap: Record<string, string>;
  activeFolderId: string | null;
  loading: boolean;

  fetchTree: () => Promise<void>;
  setActiveFolder: (id: string | null) => void;
  createFolder: (data: { name: string; icon?: string | null; parent_id?: string | null }) => Promise<void>;
  updateFolder: (id: string, data: { name?: string; icon?: string | null }) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

export const useFoldersStore = create<FoldersState>((set) => ({
  tree: [],
  folderMap: {},
  activeFolderId: null,
  loading: false,

  fetchTree: async () => {
    set({ loading: true });
    try {
      const tree = await foldersApi.tree();
      set({ tree, folderMap: flattenTree(tree) });
    } finally {
      set({ loading: false });
    }
  },

  setActiveFolder: (id) => set({ activeFolderId: id }),

  createFolder: async (data) => {
    await foldersApi.create(data);
    const tree = await foldersApi.tree();
    set({ tree, folderMap: flattenTree(tree) });
  },

  updateFolder: async (id, data) => {
    await foldersApi.update(id, data);
    const tree = await foldersApi.tree();
    set({ tree, folderMap: flattenTree(tree) });
  },

  deleteFolder: async (id) => {
    await foldersApi.delete(id);
    const tree = await foldersApi.tree();
    set({ tree, folderMap: flattenTree(tree) });
  },
}));
