import { create } from 'zustand';
import { api, type SSEStreamEvent } from './api';

interface AIAction {
  id: string;
  actionType: string;
  description: string;
  createdAt: string;
}

interface PlanInfo {
  intent: string;
  stepCount: number;
  steps?: Array<{ id: string; description: string; toolName?: string }>;
}

interface CompletedStep {
  stepId: string;
  status: 'success' | 'error';
  description?: string;
  toolName?: string;
  result?: string;
  error?: string;
}

interface ValidationResult {
  passed: boolean;
  issues: string[];
  suggestions: string[];
}

interface AIState {
  loading: boolean;
  streaming: boolean;
  response: string | null;
  recentActions: AIAction[];
  currentPlan: PlanInfo | null;
  currentStep: string | null;
  completedSteps: CompletedStep[];
  validationResult: ValidationResult | null;
  abortController: AbortController | null;
  execute: (projectId: string, prompt: string) => Promise<void>;
  executeStreaming: (projectId: string, prompt: string) => void;
  cancelExecution: () => void;
  loadHistory: (projectId: string) => Promise<void>;
}

export const useAI = create<AIState>((set, get) => ({
  loading: false,
  streaming: false,
  response: null,
  recentActions: [],
  currentPlan: null,
  currentStep: null,
  completedSteps: [],
  validationResult: null,
  abortController: null,

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

  executeStreaming: (projectId: string, prompt: string) => {
    // Cancel any existing stream
    get().abortController?.abort();

    set({
      streaming: true,
      loading: true,
      response: null,
      currentPlan: null,
      currentStep: null,
      completedSteps: [],
      validationResult: null,
    });

    const controller = api.streamAI(projectId, prompt, (event: SSEStreamEvent) => {
      switch (event.event) {
        case 'mode':
          // Mode classified
          break;
        case 'plan_start':
          set({ currentStep: 'Planning...' });
          break;
        case 'plan_ready': {
          const plan = event.data as unknown as PlanInfo;
          set({ currentPlan: plan, currentStep: null });
          break;
        }
        case 'step_start': {
          const { stepId, description } = event.data as { stepId: string; description: string };
          set({ currentStep: `${stepId}: ${description}` });
          break;
        }
        case 'tool_call':
          // Tool is being called — could show tool name
          break;
        case 'step_complete': {
          const step = event.data as unknown as CompletedStep;
          set((state) => ({
            completedSteps: [...state.completedSteps, step],
            currentStep: null,
          }));
          break;
        }
        case 'validation_start':
          set({ currentStep: 'Validating results...' });
          break;
        case 'validation_complete': {
          const validation = event.data as unknown as ValidationResult;
          set({ validationResult: validation, currentStep: null });
          break;
        }
        case 'done': {
          const { response } = event.data as { response: string };
          set({ streaming: false, loading: false, response, currentStep: null, abortController: null });
          // Refresh history
          api.getActionHistory(projectId).then((history) => {
            set({
              recentActions: history.actions.map((a) => ({
                id: a.id,
                actionType: a.action_type,
                description: a.description,
                createdAt: a.created_at,
              })),
            });
          }).catch(() => {});
          break;
        }
        case 'error': {
          const { error } = event.data as { error: string };
          set({ streaming: false, loading: false, response: `Error: ${error}`, currentStep: null, abortController: null });
          break;
        }
      }
    });

    set({ abortController: controller });
  },

  cancelExecution: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ streaming: false, loading: false, currentStep: null, abortController: null });
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
