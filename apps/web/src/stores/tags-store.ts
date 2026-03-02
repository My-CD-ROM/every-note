import { create } from 'zustand';
import type { TagResponse } from '@/lib/api';
import { tagsApi } from '@/lib/api';

interface TagsState {
  tags: TagResponse[];
  activeTagId: string | null;
  loading: boolean;

  fetchTags: () => Promise<void>;
  setActiveTag: (id: string | null) => void;
  createTag: (data: { name: string; color?: string }) => Promise<TagResponse>;
  updateTag: (id: string, data: { name?: string; color?: string }) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
}

export const useTagsStore = create<TagsState>((set) => ({
  tags: [],
  activeTagId: null,
  loading: false,

  fetchTags: async () => {
    set({ loading: true });
    try {
      const tags = await tagsApi.list();
      set({ tags });
    } finally {
      set({ loading: false });
    }
  },

  setActiveTag: (id) => set({ activeTagId: id }),

  createTag: async (data) => {
    const tag = await tagsApi.create(data);
    set((s) => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  updateTag: async (id, data) => {
    const updated = await tagsApi.update(id, data);
    set((s) => ({ tags: s.tags.map((t) => (t.id === id ? updated : t)) }));
  },

  deleteTag: async (id) => {
    await tagsApi.delete(id);
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }));
  },
}));
