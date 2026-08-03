export type EnhancementMode =
  | 'general'
  | 'image-generation'
  | 'coding'
  | 'creative-writing'
  | 'marketing'
  | 'academic';

export type GroqModel =
  | 'llama-3.3-70b-versatile'
  | 'llama-3.1-8b-instant'
  | 'mixtral-8x7b-32768'
  | 'gemma2-9b-it';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface HistoryEntry {
  id: string;
  originalPrompt: string;
  enhancedPrompt: string;
  mode: EnhancementMode;
  model: GroqModel;
  timestamp: number;
}

export interface AppSettings {
  apiKey: string;
  model: GroqModel;
  temperature: number;
  maxTokens: number;
  theme: ThemeMode;
}

export interface AppState {
  // Prompt state
  originalPrompt: string;
  enhancedPrompt: string;
  isEnhancing: boolean;
  error: string | null;

  // Mode
  mode: EnhancementMode;

  // Settings
  settings: AppSettings;

  // History
  history: HistoryEntry[];

  // UI state
  isSettingsOpen: boolean;
  isShortcutCheatsheetOpen: boolean;
  isHistoryOpen: boolean;

  // Actions
  setOriginalPrompt: (prompt: string) => void;
  setEnhancedPrompt: (prompt: string) => void;
  appendEnhancedPrompt: (chunk: string) => void;
  setIsEnhancing: (isEnhancing: boolean) => void;
  setError: (error: string | null) => void;
  setMode: (mode: EnhancementMode) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  restoreFromHistory: (entry: HistoryEntry) => void;
  clearAll: () => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutCheatsheetOpen: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  improveEnhanced: () => void;
}

export interface ShortcutDefinition {
  keys: string;
  description: string;
  macKeys?: string;
}

export const ENHANCEMENT_MODES: Record<EnhancementMode, { label: string; description: string }> = {
  general: {
    label: 'General',
    description: 'All-purpose prompt enhancement',
  },
  'image-generation': {
    label: 'Image Generation',
    description: 'Midjourney / Flux / Stable Diffusion style',
  },
  coding: {
    label: 'Coding / Technical',
    description: 'Programming and technical prompts',
  },
  'creative-writing': {
    label: 'Creative Writing',
    description: 'Stories, poetry, and creative content',
  },
  marketing: {
    label: 'Marketing / Ads',
    description: 'Ad copy, campaigns, and marketing',
  },
  academic: {
    label: 'Academic / Research',
    description: 'Research papers, analysis, and academic writing',
  },
};

export const GROQ_MODELS: Record<GroqModel, { label: string; description: string }> = {
  'llama-3.3-70b-versatile': {
    label: 'LLaMA 3.3 70B',
    description: 'Most capable — best quality',
  },
  'llama-3.1-8b-instant': {
    label: 'LLaMA 3.1 8B',
    description: 'Ultra-fast — good quality',
  },
  'mixtral-8x7b-32768': {
    label: 'Mixtral 8x7B',
    description: 'Balanced — 32K context',
  },
  'gemma2-9b-it': {
    label: 'Gemma 2 9B',
    description: 'Efficient — instruction-tuned',
  },
};

export const KEYBOARD_SHORTCUTS: ShortcutDefinition[] = [
  { keys: 'Ctrl + Enter', macKeys: '⌘ + Enter', description: 'Enhance prompt' },
  { keys: 'Ctrl + Shift + C', macKeys: '⌘ + ⇧ + C', description: 'Copy enhanced prompt' },
  { keys: 'Ctrl + K', macKeys: '⌘ + K', description: 'Focus input textarea' },
  { keys: 'Ctrl + Shift + L', macKeys: '⌘ + ⇧ + L', description: 'Clear everything' },
  { keys: 'Esc', macKeys: 'Esc', description: 'Close modal' },
  { keys: 'Ctrl + /', macKeys: '⌘ + /', description: 'Toggle shortcuts panel' },
];
