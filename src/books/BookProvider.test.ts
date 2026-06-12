import { nextPage, previousPage } from './BookProvider';

describe('nextPage', () => {
  test('advances by one when below the last page', () => {
    expect(nextPage(0, 5)).toBe(1);
    expect(nextPage(3, 5)).toBe(4);
  });

  test('loops back to 0 from the last page', () => {
    expect(nextPage(4, 5)).toBe(0);
  });

  test('returns 0 when pageCount is 1 (single-page book)', () => {
    expect(nextPage(0, 1)).toBe(0);
  });
});

describe('previousPage', () => {
  test('decrements by one when above page 0', () => {
    expect(previousPage(3)).toBe(2);
    expect(previousPage(1)).toBe(0);
  });

  test('stays at 0 when already at page 0 (no backward wrap)', () => {
    expect(previousPage(0)).toBe(0);
  });
});
