const ID_REGEX = /^[a-z][a-z0-9-]*$/;

export function toId(input: string): string {
  return input
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateBookId(id: string, existingIds: string[]): string | null {
  if (!id) return 'Book id is required.';
  if (id !== id.toLowerCase()) return 'Book id must be lowercase.';
  if (!/^[a-z]/.test(id)) return 'Book id must start with a letter.';
  if (!ID_REGEX.test(id)) {
    return 'Book id may only contain lowercase letters, digits, and dashes.';
  }
  if (id.length > 50) return 'Book id must be 50 characters or fewer.';
  if (existingIds.includes(id)) return `Book id "${id}" already exists.`;
  return null;
}

export function validateReaderId(id: string, existingReaderIds: string[]): string | null {
  if (!id) return 'Reader id is required.';
  if (!ID_REGEX.test(id)) {
    return 'Reader id may only contain lowercase letters, digits, and dashes.';
  }
  if (existingReaderIds.includes(id)) return `Reader id "${id}" is already in this book.`;
  return null;
}

export function validateFileSize(
  bytes: number,
  limitBytes: number,
  kind: string,
): string | null {
  if (bytes > limitBytes) {
    const limitMb = Math.round(limitBytes / 1024 / 1024);
    return `${kind} file is too large (limit ${limitMb} MB).`;
  }
  return null;
}

export function validateCountMatch(
  a: number,
  b: number,
  aName: string,
  bName: string,
): string | null {
  if (a !== b) {
    return `You have ${a} ${aName} but ${b} ${bName}; they must match.`;
  }
  return null;
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_PAGES = 99;
