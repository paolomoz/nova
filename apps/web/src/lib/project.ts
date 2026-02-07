import { create } from 'zustand';
import { api, type Project } from './api';

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;
  loadProjects: () => Promise<void>;
  setActiveProject: (id: string) => void;
}

export const useProject = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  loading: true,

  loadProjects: async () => {
    set({ loading: true });
    try {
      const data = await api.getProjects();
      const projects = data.projects;
      set({
        projects,
        activeProjectId: projects.length > 0 ? projects[0].id : null,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id });
  },
}));
