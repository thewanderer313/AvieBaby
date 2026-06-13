import { withLibraryLock, withTitleLock, withReadingLock } from '../locks.js';

describe('locks', () => {
  test('withLibraryLock serializes calls', async () => {
    const order: string[] = [];
    const a = withLibraryLock(async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push('a-done');
    });
    const b = withLibraryLock(async () => { order.push('b-done'); });
    await Promise.all([a, b]);
    expect(order).toEqual(['a-done', 'b-done']);
  });

  test('withTitleLock is keyed per title id', async () => {
    const order: string[] = [];
    const a = withTitleLock('x', async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push('x-a');
    });
    const b = withTitleLock('y', async () => { order.push('y-b'); });
    await Promise.all([a, b]);
    expect(order).toEqual(['y-b', 'x-a']);
  });

  test('withReadingLock is keyed per reading id', async () => {
    const order: string[] = [];
    const a = withReadingLock('r1', async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push('r1-done');
    });
    const b = withReadingLock('r1', async () => { order.push('r1-second'); });
    await Promise.all([a, b]);
    expect(order).toEqual(['r1-done', 'r1-second']);
  });

  test('lock releases even when fn throws', async () => {
    await expect(withLibraryLock(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    const ok = await withLibraryLock(async () => 'ok');
    expect(ok).toBe('ok');
  });
});
