import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';

export type AppMode = 'play' | 'book';

interface AppModeContextValue {
  mode: AppMode;
  currentBookId: string | null;
  currentReaderId: string | null;
  enterBook: (bookId: string, readerId: string) => void;
  exitBook: () => void;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

export const AppModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<AppMode>('play');
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [currentReaderId, setCurrentReaderId] = useState<string | null>(null);

  // Lock orientation whenever the mode changes. LANDSCAPE_LEFT = counterclockwise.
  useEffect(() => {
    if (mode === 'book') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT).catch(() => {});
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
  }, [mode]);

  const enterBook = useCallback((bookId: string, readerId: string) => {
    setCurrentBookId(bookId);
    setCurrentReaderId(readerId);
    setMode('book');
  }, []);

  const exitBook = useCallback(() => {
    setMode('play');
    setCurrentBookId(null);
    setCurrentReaderId(null);
  }, []);

  const value = useMemo<AppModeContextValue>(
    () => ({ mode, currentBookId, currentReaderId, enterBook, exitBook }),
    [mode, currentBookId, currentReaderId, enterBook, exitBook],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
};

export function useAppMode(): AppModeContextValue {
  const v = useContext(AppModeContext);
  if (!v) throw new Error('useAppMode must be used inside <AppModeProvider>');
  return v;
}
