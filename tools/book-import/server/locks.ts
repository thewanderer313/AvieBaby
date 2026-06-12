const bookLocks = new Map<string, Promise<unknown>>();

/**
 * Serialize write operations per book id. The returned promise resolves with
 * the work's return value once all earlier queued work for the same book has
 * completed (regardless of whether earlier work succeeded or failed).
 *
 * The map entry is updated on each call so subsequent callers wait for
 * the latest enqueued work, not just the originally-stored promise.
 */
export function withBookLock<T>(bookId: string, work: () => Promise<T>): Promise<T> {
  const prev = bookLocks.get(bookId) ?? Promise.resolve();
  const next: Promise<T> = prev.then(work, work);
  // Store a non-rejecting chain so the next caller's `prev.then(...)` runs
  // regardless of this caller's outcome.
  bookLocks.set(bookId, next.catch(() => undefined));
  return next;
}
