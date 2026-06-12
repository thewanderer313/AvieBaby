import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Book, Reader } from './types';

export function nextPage(current: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return (current + 1) % pageCount;
}

export function previousPage(current: number): number {
  return current > 0 ? current - 1 : 0;
}

interface BookContextValue {
  book: Book;
  reader: Reader;
  currentPage: number;
  next: () => void;
  previous: () => void;
}

const BookContext = createContext<BookContextValue | null>(null);

interface ProviderProps {
  book: Book;
  reader: Reader;
  children: React.ReactNode;
}

export const BookProvider: React.FC<ProviderProps> = ({ book, reader, children }) => {
  const [currentPage, setCurrentPage] = useState(0);

  // Reset to page 0 when the book or reader changes (adult re-picks).
  useEffect(() => {
    setCurrentPage(0);
  }, [book.id, reader.id]);

  const next = useCallback(() => {
    setCurrentPage((p) => nextPage(p, book.pages.length));
  }, [book.pages.length]);

  const previous = useCallback(() => {
    setCurrentPage(previousPage);
  }, []);

  const value = useMemo<BookContextValue>(
    () => ({ book, reader, currentPage, next, previous }),
    [book, reader, currentPage, next, previous],
  );

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
};

export function useBook(): BookContextValue {
  const v = useContext(BookContext);
  if (!v) throw new Error('useBook must be used inside <BookProvider>');
  return v;
}
