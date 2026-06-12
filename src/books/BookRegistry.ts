import { Book } from './types';

/**
 * Hand-edited registry. Append entries as books and recordings are produced.
 * Each entry's pages array uses require() for static asset resolution by Metro.
 */
export const BOOKS: Book[] = [];

export function validateBooks(books: Book[]): string[] {
  const errors: string[] = [];
  const seenBookIds = new Set<string>();
  for (const book of books) {
    if (seenBookIds.has(book.id)) {
      errors.push(`Duplicate book id: "${book.id}".`);
    }
    seenBookIds.add(book.id);

    if (book.readers.length === 0) {
      errors.push(`Book "${book.id}" has no readers; at least one is required.`);
    }

    if (book.pages.length === 0) {
      errors.push(`Book "${book.id}" has no pages; at least one is required.`);
    }

    const seenReaderIds = new Set<string>();
    for (const reader of book.readers) {
      if (seenReaderIds.has(reader.id)) {
        errors.push(`Duplicate reader id "${reader.id}" within book "${book.id}".`);
      }
      seenReaderIds.add(reader.id);

      if (reader.pages.length !== book.pages.length) {
        errors.push(
          `Reader "${reader.id}" in book "${book.id}" has ${reader.pages.length} audio pages but the book has ${book.pages.length} image pages.`,
        );
      }
    }
  }
  return errors;
}
