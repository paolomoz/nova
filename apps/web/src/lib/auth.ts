import { create } from 'zustand';
import { api } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

interface Org {
  id: string;
  slug: string;
  name: string;
}

interface AuthState {
  user: User | null;
  org: Org | null;
  loading: boolean;
  error: string | null;
  checkAuth: () => Promise<void>;
  loginWithGitHub: (code: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  org: null,
  loading: true,
  error: null,

  checkAuth: async () => {
    try {
      set({ loading: true, error: null });
      const data = await api.getMe();
      set({ user: data.user, org: data.org, loading: false });
    } catch {
      set({ user: null, org: null, loading: false });
    }
  },

  loginWithGitHub: async (code: string) => {
    try {
      set({ loading: true, error: null });
      await api.loginWithGitHub(code);
      const data = await api.getMe();
      set({ user: data.user, org: data.org, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  logout: async () => {
    await api.logout();
    set({ user: null, org: null });
  },
}));
