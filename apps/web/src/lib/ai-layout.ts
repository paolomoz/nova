import { create } from 'zustand';

export type AILayoutMode = 'none' | 'rail' | 'contextual' | 'split' | 'fullscreen';

export type RailTab = 'chat' | 'discovery' | 'conversations' | 'settings';

interface AILayoutState {
  /** Currently active AI layout mode */
  mode: AILayoutMode;
  /** Previously active mode (for toggling back) */
  previousMode: AILayoutMode;
  /** Active tab within the Rail panel */
  railTab: RailTab;
  /** Whether the rail is in push mode (displaces content) vs overlay */
  railPush: boolean;
  /** Split view ratio (left pane percentage) */
  splitRatio: number;
  /** Context for contextual suggestions (e.g. selected text) */
  contextualSelection: string | null;
  /** Position for contextual popover */
  contextualPosition: { x: number; y: number } | null;

  /** Open a specific AI layout mode */
  openMode: (mode: AILayoutMode) => void;
  /** Close AI (set mode to none) */
  close: () => void;
  /** Toggle between current mode and none, or switch to a specific mode */
  toggle: (mode?: AILayoutMode) => void;
  /** Toggle between rail and fullscreen */
  toggleExpand: () => void;
  /** Set the active rail tab */
  setRailTab: (tab: RailTab) => void;
  /** Toggle rail push/overlay behavior */
  toggleRailPush: () => void;
  /** Set the split view ratio */
  setSplitRatio: (ratio: number) => void;
  /** Set contextual selection and position */
  setContextual: (selection: string | null, position: { x: number; y: number } | null) => void;
}

export const useAILayout = create<AILayoutState>((set, get) => ({
  mode: 'none',
  previousMode: 'none',
  railTab: 'chat',
  railPush: false,
  splitRatio: 60,
  contextualSelection: null,
  contextualPosition: null,

  openMode: (mode) => {
    const current = get().mode;
    set({
      mode,
      previousMode: current !== 'none' ? current : get().previousMode,
    });
  },

  close: () => {
    set((state) => ({
      mode: 'none',
      previousMode: state.mode !== 'none' ? state.mode : state.previousMode,
      contextualSelection: null,
      contextualPosition: null,
    }));
  },

  toggle: (mode) => {
    const current = get().mode;
    const target = mode || 'rail';
    if (current === target) {
      set({ mode: 'none', previousMode: target });
    } else {
      set({ mode: target, previousMode: current !== 'none' ? current : get().previousMode });
    }
  },

  toggleExpand: () => {
    const current = get().mode;
    if (current === 'rail') {
      set({ mode: 'fullscreen', previousMode: 'rail' });
    } else if (current === 'fullscreen') {
      set({ mode: 'rail', previousMode: 'fullscreen' });
    } else {
      set({ mode: 'fullscreen', previousMode: current });
    }
  },

  setRailTab: (tab) => set({ railTab: tab }),

  toggleRailPush: () => set((state) => ({ railPush: !state.railPush })),

  setSplitRatio: (ratio) => set({ splitRatio: Math.max(20, Math.min(80, ratio)) }),

  setContextual: (selection, position) => {
    if (selection && position) {
      set({
        contextualSelection: selection,
        contextualPosition: position,
        mode: 'contextual',
      });
    } else {
      set({
        contextualSelection: null,
        contextualPosition: null,
        mode: get().mode === 'contextual' ? 'none' : get().mode,
      });
    }
  },
}));
