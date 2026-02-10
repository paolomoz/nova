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
  role?: string;
}

interface AuthState {
  user: User | null;
  org: Org | null;
  orgs: Org[];
  loading: boolean;
  error: string | null;
  onboarded: boolean;
  checkAuth: () => Promise<void>;
  devLogin: () => Promise<void>;
  loginWithGitHub: (code: string) => Promise<void>;
  loginWithIMS: (code: string) => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  loadOrgs: () => Promise<void>;
  logout: () => Promise<void>;
  setOnboarded: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  org: null,
  orgs: [],
  loading: true,
  error: null,
  onboarded: localStorage.getItem('nova_onboarded') === 'true',

  checkAuth: async () => {
    try {
      set({ loading: true, error: null });
      const data = await api.getMe();
      set({ user: data.user, org: data.org, loading: false });
      get().loadOrgs();
    } catch {
      // No session — auto-provision a demo session
      try {
        await api.demoLogin();
        const data = await api.getMe();
        set({ user: data.user, org: data.org, loading: false });
        get().loadOrgs();
      } catch {
        set({ user: null, org: null, loading: false });
      }
    }
  },

  devLogin: async () => {
    try {
      set({ loading: true, error: null });
      await api.devLogin();
      const data = await api.getMe();
      set({ user: data.user, org: data.org, loading: false });
      get().loadOrgs();
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  loginWithGitHub: async (code: string) => {
    try {
      set({ loading: true, error: null });
      await api.loginWithGitHub(code);
      const data = await api.getMe();
      set({ user: data.user, org: data.org, loading: false });
      get().loadOrgs();
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  loginWithIMS: async (code: string) => {
    try {
      set({ loading: true, error: null });
      await api.loginWithIMS(code);
      const data = await api.getMe();
      set({ user: data.user, org: data.org, loading: false });
      get().loadOrgs();
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  switchOrg: async (orgId: string) => {
    try {
      await api.switchOrg(orgId);
      const data = await api.getMe();
      set({ org: data.org });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  loadOrgs: async () => {
    try {
      const data = await api.getOrgs();
      set({ orgs: data.orgs });
    } catch { /* non-fatal */ }
  },

  logout: async () => {
    await api.logout();
    set({ user: null, org: null, orgs: [] });
  },

  setOnboarded: () => {
    localStorage.setItem('nova_onboarded', 'true');
    set({ onboarded: true });
  },
}));
