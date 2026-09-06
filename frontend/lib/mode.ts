'use client';

import { useCallback, useState } from 'react';
import type { AppMode } from './data/provider';

const STORAGE_KEY = 'everroot-app-mode';
export const DEFAULT_APP_MODE: AppMode = 'DM';

function detectInitialMode(): AppMode {
  if (typeof window === 'undefined') return DEFAULT_APP_MODE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'DM' || raw === 'RT') return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_APP_MODE;
}

export function useMode() {
  const [mode, setModeState] = useState<AppMode>(detectInitialMode);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return { mode, setMode } as const;
}
