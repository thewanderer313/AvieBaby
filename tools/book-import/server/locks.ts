const tails = new Map<string, Promise<unknown>>();

function withKeyedLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  tails.set(
    key,
    next.catch(() => {}),
  );
  return next;
}

export function withLibraryLock<T>(fn: () => Promise<T>): Promise<T> {
  return withKeyedLock('library', fn);
}

export function withTitleLock<T>(titleId: string, fn: () => Promise<T>): Promise<T> {
  return withKeyedLock(`title:${titleId}`, fn);
}

export function withReadingLock<T>(readingId: string, fn: () => Promise<T>): Promise<T> {
  return withKeyedLock(`reading:${readingId}`, fn);
}
