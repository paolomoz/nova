import { create } from 'zustand';
import { api } from './api';

interface AIAction {
  id: string;
  actionType: string;
  description: string;
  createdAt: string;
}

interface AIState {
  loading: boolean;
  response: string | null;
  recentActions: AIAction[];
  execute: (projectId: string, prompt: string) => Promise<void>;
  loadHistory: (projectId: string) => Promise<void>;
}

export const useAI = create<AIState>((set) => ({
  loading: false,
  response: null,
  recentActions: [],

  execute: async (projectId: string, prompt: string) => {
    set({ loading: true, response: null });
    try {
      const result = await api.executeAI(projectId, prompt);
      set({ loading: false, response: result.response });
      // Refresh action history
      const history = await api.getActionHistory(projectId);
      set({
        recentActions: history.actions.map((a) => ({
          id: a.id,
          actionType: a.action_type,
          description: a.description,
          createdAt: a.created_at,
        })),
      });
    } catch (err) {
      set({ loading: false, response: `Error: ${(err as Error).message}` });
    }
  },

  loadHistory: async (projectId: string) => {
    try {
      const history = await api.getActionHistory(projectId);
      set({
        recentActions: history.actions.map((a) => ({
          id: a.id,
          actionType: a.action_type,
          description: a.description,
          createdAt: a.created_at,
        })),
      });
    } catch {
      // Non-fatal
    }
  },
}));
