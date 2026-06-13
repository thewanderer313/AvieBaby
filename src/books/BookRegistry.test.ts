import { REGISTRY, validateRegistry } from './BookRegistry';

describe('BookRegistry', () => {
  test('REGISTRY exists with expected shape', () => {
    expect(Array.isArray(REGISTRY.titles)).toBe(true);
    expect(typeof REGISTRY.readingsByTitleId).toBe('object');
    expect(typeof REGISTRY.assets).toBe('object');
  });

  test('the empty registry passes validation', () => {
    expect(validateRegistry()).toEqual([]);
  });
});
