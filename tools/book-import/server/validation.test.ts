import {
  toId,
  validateBookId,
  validateReaderId,
  validateFileSize,
  validateCountMatch,
} from './validation';

describe('toId', () => {
  test('lowercases and dashes', () => {
    expect(toId('Goodnight Moon')).toBe('goodnight-moon');
  });
  test('strips apostrophes', () => {
    expect(toId("Don't Let the Pigeon Drive the Bus")).toBe(
      'dont-let-the-pigeon-drive-the-bus',
    );
  });
  test('collapses spaces and dashes', () => {
    expect(toId('Brown Bear,  Brown - Bear')).toBe('brown-bear-brown-bear');
  });
  test('trims leading/trailing dashes', () => {
    expect(toId('  - Goodnight - ')).toBe('goodnight');
  });
  test('strips non-alphanumeric except dash', () => {
    expect(toId('Hello!@#World')).toBe('helloworld');
  });
});

describe('validateBookId', () => {
  test('accepts a valid id', () => {
    expect(validateBookId('goodnight-moon', [])).toBeNull();
  });
  test('rejects empty', () => {
    expect(validateBookId('', [])).toContain('required');
  });
  test('rejects id starting with a number', () => {
    expect(validateBookId('1book', [])).toContain('letter');
  });
  test('rejects id with uppercase', () => {
    expect(validateBookId('Book', [])).toContain('lowercase');
  });
  test('rejects collision', () => {
    expect(validateBookId('moon', ['moon', 'sun'])).toContain('already exists');
  });
});

describe('validateReaderId', () => {
  test('accepts a valid id', () => {
    expect(validateReaderId('uncle-ryan', [])).toBeNull();
  });
  test('rejects collision within book', () => {
    expect(validateReaderId('ryan', ['ryan'])).toContain('already');
  });
});

describe('validateFileSize', () => {
  test('accepts under the limit', () => {
    expect(validateFileSize(1024, 10 * 1024 * 1024, 'image')).toBeNull();
  });
  test('rejects over the limit', () => {
    expect(validateFileSize(11 * 1024 * 1024, 10 * 1024 * 1024, 'image')).toContain('too large');
  });
});

describe('validateCountMatch', () => {
  test('accepts equal counts', () => {
    expect(validateCountMatch(5, 5, 'pages', 'voices')).toBeNull();
  });
  test('rejects mismatched counts', () => {
    expect(validateCountMatch(5, 3, 'pages', 'voices')).toContain('5 pages');
  });
});
