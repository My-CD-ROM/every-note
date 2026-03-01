import { create } from 'zustand';
import type { ProjectResponse } from '@/lib/api';
import { projectsApi } from '@/lib/api';

interface ProjectsState {
  projects: ProjectResponse[];
  activeProjectId: string | null;
  loading: boolean;

  fetchProjects: () => Promise<void>;
  setActiveProject: (id: string | null) => void;
  createProject: (data: { name: string; icon?: string | null; description?: string | null }) => Promise<ProjectResponse>;
  updateProject: (id: string, data: { name?: string; icon?: string | null; description?: string | null }) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  activeProjectId: null,
  loading: false,

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const projects = await projectsApi.list();
      set({ projects });
    } finally {
      set({ loading: false });
    }
  },

  setActiveProject: (id) => set({ activeProjectId: id }),

  createProject: async (data) => {
    const project = await projectsApi.create(data);
    set((s) => ({ projects: [...s.projects, project], activeProjectId: project.id }));
    return project;
  },

  updateProject: async (id, data) => {
    await projectsApi.update(id, data);
    const projects = await projectsApi.list();
    set({ projects });
  },

  deleteProject: async (id) => {
    await projectsApi.delete(id);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    }));
  },
}));
