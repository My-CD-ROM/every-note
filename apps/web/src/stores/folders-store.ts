import { create } from 'zustand';
import type { FolderTree } from '@/lib/api';
import { foldersApi } from '@/lib/api';

interface FoldersState {
  tree: FolderTree[];
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
  activeFolderId: null,
  loading: false,

  fetchTree: async () => {
    set({ loading: true });
    try {
      const tree = await foldersApi.tree();
      set({ tree });
    } finally {
      set({ loading: false });
    }
  },

  setActiveFolder: (id) => set({ activeFolderId: id }),

  createFolder: async (data) => {
    await foldersApi.create(data);
    const tree = await foldersApi.tree();
    set({ tree });
  },

  updateFolder: async (id, data) => {
    await foldersApi.update(id, data);
    const tree = await foldersApi.tree();
    set({ tree });
  },

  deleteFolder: async (id) => {
    await foldersApi.delete(id);
    const tree = await foldersApi.tree();
    set({ tree });
  },
}));
