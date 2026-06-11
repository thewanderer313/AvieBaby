import { THEMES, THEME_IDS } from './ThemeRegistry';

describe('ThemeRegistry', () => {
  test('contains exactly three themes', () => {
    expect(THEMES).toHaveLength(3);
  });

  test('every theme has 2 music tracks', () => {
    for (const t of THEMES) {
      expect(t.music).toHaveLength(2);
    }
  });

  test('every theme has 2 or 3 characters', () => {
    for (const t of THEMES) {
      expect(t.characters.length).toBeGreaterThanOrEqual(2);
      expect(t.characters.length).toBeLessThanOrEqual(3);
    }
  });

  test('every theme has 4-6 sparkle colors', () => {
    for (const t of THEMES) {
      expect(t.sparkleColors.length).toBeGreaterThanOrEqual(4);
      expect(t.sparkleColors.length).toBeLessThanOrEqual(6);
    }
  });

  test('character ids are unique within a theme', () => {
    for (const t of THEMES) {
      const ids = t.characters.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test('theme ids are unique and exposed via THEME_IDS in same order', () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(THEME_IDS).toEqual(ids);
  });
});
