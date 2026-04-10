import { create } from 'zustand';
import type { Tag, TagCreate } from '../types/todo';
import * as api from '../api/tags';

interface TagState {
  tags: Tag[];
  loadTags: () => Promise<void>;
  addTag: (payload: TagCreate) => Promise<Tag>;
  removeTag: (id: number) => Promise<void>;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],

  loadTags: async () => {
    const tags = await api.fetchTags();
    set({ tags });
  },

  addTag: async (payload) => {
    const tag = await api.createTag(payload);
    await get().loadTags();
    return tag;
  },

  removeTag: async (id) => {
    await api.deleteTag(id);
    await get().loadTags();
  },
}));
