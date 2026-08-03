'use client';

import { Settings, Keyboard, Moon, Sun, Monitor, Zap, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';

export default function Header() {
  const { settings, updateSettings, setSettingsOpen, setShortcutCheatsheetOpen, setHistoryOpen } =
    useAppStore();

  const cycleTheme = () => {
    const order: Array<'dark' | 'light' | 'system'> = ['dark', 'light', 'system'];
    const idx = order.indexOf(settings.theme);
    updateSettings({ theme: order[(idx + 1) % order.length] });
  };

  const ThemeIcon = settings.theme === 'dark' ? Moon : settings.theme === 'light' ? Sun : Monitor;

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sticky top-0 z-50 w-full glass bg-[hsl(var(--background)/0.8)] border-b border-[hsl(var(--border))]"
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 h-16">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              <span className="gradient-text">PromptBoost</span>
            </h1>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-0.5 tracking-wide uppercase">
              AI Prompt Enhancer
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setHistoryOpen(true)}
            className="p-2.5 rounded-xl hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            title="History"
          >
            <History className="w-[18px] h-[18px]" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShortcutCheatsheetOpen(true)}
            className="p-2.5 rounded-xl hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            title="Keyboard Shortcuts"
          >
            <Keyboard className="w-[18px] h-[18px]" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={cycleTheme}
            className="p-2.5 rounded-xl hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            title={`Theme: ${settings.theme}`}
          >
            <ThemeIcon className="w-[18px] h-[18px]" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSettingsOpen(true)}
            className="p-2.5 rounded-xl hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            title="Settings"
          >
            <Settings className="w-[18px] h-[18px]" />
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
}
