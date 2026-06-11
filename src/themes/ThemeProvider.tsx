import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Theme } from './types';
import { THEMES } from './ThemeRegistry';

interface ThemeContextValue {
  theme: Theme;
  index: number;
  advance: () => void;
  jumpTo: (themeId: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [index, setIndex] = useState(0);

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % THEMES.length);
  }, []);

  const jumpTo = useCallback((themeId: string) => {
    const i = THEMES.findIndex((t) => t.id === themeId);
    if (i >= 0) setIndex(i);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: THEMES[index], index, advance, jumpTo }),
    [index, advance, jumpTo],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}
