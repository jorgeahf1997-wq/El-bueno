import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'pc_theme';
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#ffffff', dark: '#131a27' };

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function systemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applies the theme to <html data-theme> and to the browser UI colour. index.html does the same before first paint. */
function apply(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = THEME_COLORS[theme];
    meta.removeAttribute('media');
  });
}

/** "Automático" follows the device; "Claro"/"Escuro" are remembered on this device only. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);
  const resolved: ResolvedTheme = choice === 'system' ? system : choice;

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const onChange = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    apply(resolved);
  }, [resolved]);

  const setTheme = useCallback((next: ThemeChoice) => {
    setChoice(next);
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable: the choice lasts until the page is closed
    }
  }, []);

  /** Quick toggle used by the header button: always switches to the opposite of what is shown now. */
  const toggle = useCallback(() => setTheme(resolved === 'dark' ? 'light' : 'dark'), [resolved, setTheme]);

  return { choice, resolved, setTheme, toggle };
}
