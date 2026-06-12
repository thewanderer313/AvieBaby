import { BOOKS, validateBooks } from './BookRegistry';
import { Book } from './types';

const goodBook: Book = {
  id: 'sample-book',
  title: 'Sample',
  pages: [101, 102, 103],
  readers: [
    { id: 'ryan', name: 'Uncle Ryan', pages: [201, 202, 203] },
  ],
};

describe('BookRegistry', () => {
  test('BOOKS exists and is an array', () => {
    expect(Array.isArray(BOOKS)).toBe(true);
  });

  test('the current BOOKS array passes validation', () => {
    expect(validateBooks(BOOKS)).toEqual([]);
  });
});

describe('validateBooks', () => {
  test('accepts an empty array', () => {
    expect(validateBooks([])).toEqual([]);
  });

  test('accepts a well-formed book', () => {
    expect(validateBooks([goodBook])).toEqual([]);
  });

  test('rejects a book with zero readers', () => {
    const bad = { ...goodBook, readers: [] };
    expect(validateBooks([bad])).toContain(
      'Book "sample-book" has no readers; at least one is required.',
    );
  });

  test('rejects a reader whose page count differs from the book', () => {
    const bad = {
      ...goodBook,
      readers: [{ id: 'ryan', name: 'Uncle Ryan', pages: [201, 202] }],
    };
    expect(validateBooks([bad])).toContain(
      'Reader "ryan" in book "sample-book" has 2 audio pages but the book has 3 image pages.',
    );
  });

  test('rejects duplicate book ids', () => {
    const errors = validateBooks([goodBook, goodBook]);
    expect(errors).toContain('Duplicate book id: "sample-book".');
  });

  test('rejects duplicate reader ids within the same book', () => {
    const bad = {
      ...goodBook,
      readers: [
        { id: 'ryan', name: 'Uncle Ryan', pages: [201, 202, 203] },
        { id: 'ryan', name: 'Other Ryan', pages: [201, 202, 203] },
      ],
    };
    expect(validateBooks([bad])).toContain(
      'Duplicate reader id "ryan" within book "sample-book".',
    );
  });

  test('rejects a book with zero pages', () => {
    const bad: Book = {
      id: 'empty-book',
      title: 'Empty',
      pages: [],
      readers: [{ id: 'ryan', name: 'Uncle Ryan', pages: [] }],
    };
    expect(validateBooks([bad])).toContain(
      'Book "empty-book" has no pages; at least one is required.',
    );
  });
});
