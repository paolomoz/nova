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

export interface InsightCard {
  id: string;
  message: string;
  type: 'suggestion' | 'warning' | 'info';
  actions: Array<{ label: string; action: string }>;
  dismissed?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'insight';
  content: string;
  timestamp: number;
  insight?: InsightCard;
}

interface AIState {
  loading: boolean;
  streaming: boolean;
  response: string | null;
  messages: ChatMessage[];
  insights: InsightCard[];
  recentActions: AIAction[];
  currentPlan: PlanInfo | null;
  currentStep: string | null;
  completedSteps: CompletedStep[];
  validationResult: ValidationResult | null;
  abortController: AbortController | null;
  pendingNavigation: string | null;
  execute: (projectId: string, prompt: string) => Promise<void>;
  executeStreaming: (projectId: string, prompt: string) => void;
  cancelExecution: () => void;
  loadHistory: (projectId: string) => Promise<void>;
  addInsight: (insight: Omit<InsightCard, 'id'>) => void;
  dismissInsight: (id: string) => void;
  handleInsightAction: (insightId: string, action: string) => void;
  clearNavigation: () => void;
}

let insightCounter = 0;

export const useAI = create<AIState>((set, get) => ({
  loading: false,
  streaming: false,
  response: null,
  messages: [],
  insights: [],
  recentActions: [],
  currentPlan: null,
  currentStep: null,
  completedSteps: [],
  validationResult: null,
  abortController: null,
  pendingNavigation: null,

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

  addInsight: (insight: Omit<InsightCard, 'id'>) => {
    const id = `insight-${++insightCounter}`;
    const card: InsightCard = { ...insight, id };
    set((state) => ({
      insights: [...state.insights, card],
      messages: [
        ...state.messages,
        { id, role: 'insight' as const, content: insight.message, timestamp: Date.now(), insight: card },
      ],
    }));
  },

  dismissInsight: (id: string) => {
    set((state) => ({
      insights: state.insights.map((i) => (i.id === id ? { ...i, dismissed: true } : i)),
    }));
  },

  handleInsightAction: (insightId: string, action: string) => {
    // Handle navigation actions
    if (action.startsWith('navigate:')) {
      const path = action.slice('navigate:'.length);
      set({ pendingNavigation: path });
    }
    // Dismiss the insight after any action
    get().dismissInsight(insightId);
  },

  clearNavigation: () => {
    set({ pendingNavigation: null });
  },

  executeStreaming: (projectId: string, prompt: string) => {
    // Cancel any existing stream
    get().abortController?.abort();

    // Add user message to chat
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    set((state) => ({
      streaming: true,
      loading: true,
      response: null,
      messages: [...state.messages, userMsg],
      currentPlan: null,
      currentStep: 'Thinking...',
      completedSteps: [],
      validationResult: null,
    }));

    let createdPagePath: string | null = null;

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
        case 'tool_call': {
          const toolData = event.data as { toolName: string; input?: Record<string, unknown> };
          if (toolData.toolName === 'create_page' && toolData.input?.path) {
            // Track created page path for auto-navigation
            createdPagePath = toolData.input.path as string;
          }
          break;
        }
        case 'step_complete': {
          const step = event.data as unknown as CompletedStep;
          // Detect page creation from step result
          if (!createdPagePath && step.result) {
            const match = step.result.match(/Page created at (.+)/);
            if (match) createdPagePath = match[1].trim();
          }
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
        case 'insight': {
          const insightData = event.data as { message: string; type?: string; actions?: Array<{ label: string; action: string }> };
          get().addInsight({
            message: insightData.message,
            type: (insightData.type as InsightCard['type']) || 'suggestion',
            actions: insightData.actions || [
              { label: 'Accept', action: 'accept' },
              { label: 'Dismiss', action: 'dismiss' },
            ],
          });
          break;
        }
        case 'done': {
          const doneData = event.data as {
            response: string;
            toolCalls?: Array<{ name: string; input: Record<string, unknown>; result: string }>;
          };
          const { response } = doneData;
          // Check toolCalls from done event for create_page (covers single-mode)
          if (!createdPagePath && doneData.toolCalls) {
            for (const tc of doneData.toolCalls) {
              if (tc.name === 'create_page' && tc.input?.path) {
                createdPagePath = tc.input.path as string;
                break;
              }
            }
          }
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: response,
            timestamp: Date.now(),
          };
          set((state) => ({
            streaming: false, loading: false, response, currentStep: null, abortController: null,
            messages: [...state.messages, assistantMsg],
          }));
          // Auto-navigate insight for created pages
          if (createdPagePath) {
            get().addInsight({
              message: `Page created at ${createdPagePath}. Open it in the editor?`,
              type: 'info',
              actions: [
                { label: 'Open in Editor', action: `navigate:/editor?path=${encodeURIComponent(createdPagePath)}` },
                { label: 'Stay here', action: 'dismiss' },
              ],
            });
            // Notify sites browser to refresh its listing
            window.dispatchEvent(new CustomEvent('nova:content-changed', { detail: { path: createdPagePath } }));
          }
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
