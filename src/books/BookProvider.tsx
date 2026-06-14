import React, { createContext, useContext, useMemo, useState } from 'react';
import { REGISTRY } from './BookRegistry';
import type { TitleGroup, Reading } from './types';

export interface BookContext {
  titles: TitleGroup[];
  readingsForTitle: (titleId: string) => Reading[];
  selectedReading: Reading | null;
  selectReading: (r: Reading | null) => void;
  pageIndex: number;
  goToNext: () => void;
  goToPrev: () => void;
}

const Ctx = createContext<BookContext | null>(null);

export const BookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const value = useMemo<BookContext>(
    () => ({
      titles: REGISTRY.titles,
      readingsForTitle: (titleId) => REGISTRY.readingsByTitleId[titleId] ?? [],
      selectedReading,
      selectReading: (r) => {
        setSelectedReading(r);
        setPageIndex(0);
      },
      pageIndex,
      goToNext: () => {
        if (!selectedReading) return;
        setPageIndex((i) => (i + 1) % selectedReading.pages.length);
      },
      goToPrev: () => {
        if (!selectedReading) return;
        setPageIndex((i) => (i - 1 + selectedReading.pages.length) % selectedReading.pages.length);
      },
    }),
    [selectedReading, pageIndex],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useBooks(): BookContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBooks must be used inside BookProvider');
  return ctx;
}
