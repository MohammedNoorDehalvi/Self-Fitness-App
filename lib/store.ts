import { create } from 'zustand';
import type { AppState, AppSettings, HistoryEntry, EnhancementMode } from './types';
import { generateId } from './utils';

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 2048,
  theme: 'dark',
};

const MAX_HISTORY = 20;

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem('promptboost-settings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('promptboost-settings', JSON.stringify(settings));
  } catch {}
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('promptboost-history');
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function saveHistory(history: HistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('promptboost-history', JSON.stringify(history));
  } catch {}
}

export const useAppStore = create<AppState>((set, get) => ({
  // Prompt state
  originalPrompt: '',
  enhancedPrompt: '',
  isEnhancing: false,
  error: null,

  // Mode
  mode: 'general' as EnhancementMode,

  // Settings
  settings: DEFAULT_SETTINGS,

  // History
  history: [],

  // UI state
  isSettingsOpen: false,
  isShortcutCheatsheetOpen: false,
  isHistoryOpen: false,

  // Actions
  setOriginalPrompt: (prompt: string) => set({ originalPrompt: prompt }),
  setEnhancedPrompt: (prompt: string) => set({ enhancedPrompt: prompt }),
  appendEnhancedPrompt: (chunk: string) =>
    set((state) => ({ enhancedPrompt: state.enhancedPrompt + chunk })),
  setIsEnhancing: (isEnhancing: boolean) => set({ isEnhancing }),
  setError: (error: string | null) => set({ error }),
  setMode: (mode: EnhancementMode) => set({ mode }),

  updateSettings: (partial: Partial<AppSettings>) => {
    const newSettings = { ...get().settings, ...partial };
    saveSettings(newSettings);
    set({ settings: newSettings });
  },

  addHistoryEntry: (entry) => {
    const newEntry: HistoryEntry = {
      ...entry,
      id: generateId(),
      timestamp: Date.now(),
    };
    const newHistory = [newEntry, ...get().history].slice(0, MAX_HISTORY);
    saveHistory(newHistory);
    set({ history: newHistory });
  },

  clearHistory: () => {
    saveHistory([]);
    set({ history: [] });
  },

  restoreFromHistory: (entry: HistoryEntry) =>
    set({
      originalPrompt: entry.originalPrompt,
      enhancedPrompt: entry.enhancedPrompt,
      mode: entry.mode,
    }),

  clearAll: () =>
    set({
      originalPrompt: '',
      enhancedPrompt: '',
      error: null,
    }),

  setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
  setShortcutCheatsheetOpen: (open: boolean) => set({ isShortcutCheatsheetOpen: open }),
  setHistoryOpen: (open: boolean) => set({ isHistoryOpen: open }),

  improveEnhanced: () => {
    const { enhancedPrompt } = get();
    if (enhancedPrompt) {
      set({ originalPrompt: enhancedPrompt, enhancedPrompt: '' });
    }
  },
}));

// Initialize from localStorage on client side
export function initializeStore() {
  const settings = loadSettings();
  const history = loadHistory();
  useAppStore.setState({ settings, history });
}
