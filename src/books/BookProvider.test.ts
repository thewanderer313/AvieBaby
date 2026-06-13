import { useBooks } from './BookProvider';

describe('BookProvider', () => {
  test('useBooks export exists', () => {
    expect(typeof useBooks).toBe('function');
  });
});
