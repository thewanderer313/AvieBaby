import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { BookProvider, useBooks } from './BookProvider';
import { REGISTRY } from './BookRegistry';
import type { Reading } from './types';

// Minimal fake reading for tests (doesn't need to match real assets).
const FAKE_TITLE = { id: 'title-1', displayName: 'Test Book' };
const FAKE_READING: Reading = {
  id: 'reading-1',
  titleId: 'title-1',
  reader: 'Ryan',
  pages: [
    { image: 'img-0', audio: 'aud-0' },
    { image: 'img-1', audio: 'aud-1' },
    { image: 'img-2', audio: 'aud-2' },
  ],
};
const FAKE_READING_2: Reading = {
  id: 'reading-2',
  titleId: 'title-1',
  reader: 'Kristen',
  pages: [
    { image: 'img-0', audio: 'aud-0' },
  ],
};

// Temporarily patch REGISTRY for isolated tests, then restore.
function withPatchedRegistry(
  titles: typeof REGISTRY.titles,
  readingsByTitleId: typeof REGISTRY.readingsByTitleId,
) {
  const origTitles = REGISTRY.titles;
  const origReadings = REGISTRY.readingsByTitleId;
  beforeEach(() => {
    (REGISTRY as any).titles = titles;
    (REGISTRY as any).readingsByTitleId = readingsByTitleId;
  });
  afterEach(() => {
    (REGISTRY as any).titles = origTitles;
    (REGISTRY as any).readingsByTitleId = origReadings;
  });
}

describe('BookProvider', () => {
  test('useBooks export exists', () => {
    expect(typeof useBooks).toBe('function');
  });

  describe('with an empty registry', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(BookProvider, null, children);

    test('titles returns an empty array when registry is empty', async () => {
      const { result } = await renderHook(() => useBooks(), { wrapper });
      expect(Array.isArray(result.current.titles)).toBe(true);
      expect(result.current.titles).toEqual(REGISTRY.titles);
    });

    test('selectedReading starts as null', async () => {
      const { result } = await renderHook(() => useBooks(), { wrapper });
      expect(result.current.selectedReading).toBeNull();
    });

    test('pageIndex starts at 0', async () => {
      const { result } = await renderHook(() => useBooks(), { wrapper });
      expect(result.current.pageIndex).toBe(0);
    });
  });

  describe('with a patched registry', () => {
    withPatchedRegistry([FAKE_TITLE], { 'title-1': [FAKE_READING, FAKE_READING_2] });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(BookProvider, null, children);

    test('titles returns REGISTRY.titles', async () => {
      const { result } = await renderHook(() => useBooks(), { wrapper });
      expect(result.current.titles).toEqual([FAKE_TITLE]);
    });

    test('readingsForTitle returns readings for the given titleId', async () => {
      const { result } = await renderHook(() => useBooks(), { wrapper });
      const readings = result.current.readingsForTitle('title-1');
      expect(readings).toHaveLength(2);
      expect(readings[0].id).toBe('reading-1');
      expect(readings[1].id).toBe('reading-2');
    });

    test('readingsForTitle returns empty array for unknown titleId', async () => {
      const { result } = await renderHook(() => useBooks(), { wrapper });
      expect(result.current.readingsForTitle('does-not-exist')).toEqual([]);
    });

    test('selectReading updates selectedReading and resets pageIndex to 0', async () => {
      const { result } = await renderHook(() => useBooks(), { wrapper });

      // Advance page first so we can verify it resets.
      await act(async () => { result.current.selectReading(FAKE_READING); });
      await act(async () => { result.current.goToNext(); });
      expect(result.current.pageIndex).toBe(1);

      await act(async () => { result.current.selectReading(FAKE_READING_2); });
      expect(result.current.selectedReading).toEqual(FAKE_READING_2);
      expect(result.current.pageIndex).toBe(0);
    });

    test('goToNext advances pageIndex modulo page count', async () => {
      const { result } = await renderHook(() => useBooks(), { wrapper });
      await act(async () => { result.current.selectReading(FAKE_READING); }); // 3 pages

      expect(result.current.pageIndex).toBe(0);
      await act(async () => { result.current.goToNext(); });
      expect(result.current.pageIndex).toBe(1);
      await act(async () => { result.current.goToNext(); });
      expect(result.current.pageIndex).toBe(2);
      await act(async () => { result.current.goToNext(); }); // wraps
      expect(result.current.pageIndex).toBe(0);
    });

    test('goToPrev wraps backwards modulo page count', async () => {
      const { result } = await renderHook(() => useBooks(), { wrapper });
      await act(async () => { result.current.selectReading(FAKE_READING); }); // 3 pages

      expect(result.current.pageIndex).toBe(0);
      await act(async () => { result.current.goToPrev(); }); // wraps to last
      expect(result.current.pageIndex).toBe(2);
      await act(async () => { result.current.goToPrev(); });
      expect(result.current.pageIndex).toBe(1);
    });

    test('goToNext does nothing when no reading is selected', async () => {
      const { result } = await renderHook(() => useBooks(), { wrapper });
      await act(async () => { result.current.goToNext(); });
      expect(result.current.pageIndex).toBe(0);
    });

    test('selectReading(null) clears selection', async () => {
      const { result } = await renderHook(() => useBooks(), { wrapper });
      await act(async () => { result.current.selectReading(FAKE_READING); });
      await act(async () => { result.current.selectReading(null); });
      expect(result.current.selectedReading).toBeNull();
    });
  });
});
