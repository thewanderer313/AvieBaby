// src/books/types.ts

/** Stable id for a reader, e.g. 'ryan' | 'kristen' | 'grandma'. */
export type ReaderId = string;

/** Stable id for a book, e.g. 'goodnight-moon'. */
export type BookId = string;

export interface Reader {
  /** Stable id used as map key (e.g., 'ryan'). */
  id: ReaderId;
  /** Display name shown in the picker (e.g., "Uncle Ryan"). */
  name: string;
  /**
   * One audio clip per page, in the same order as Book.pages.
   * Length MUST equal Book.pages.length. Each entry is a require()'d mp3 module id.
   */
  pages: number[];
}

export interface Book {
  /** Stable id used in the file system (e.g., 'goodnight-moon'). */
  id: BookId;
  /** Display title shown in the picker (e.g., "Goodnight Moon"). */
  title: string;
  /** Optional thumbnail for the picker. require()'d png module id. */
  cover?: number;
  /**
   * Page images in order. Each entry is a require()'d image module id.
   * Length must equal each Reader.pages array's length.
   */
  pages: number[];
  /** One or more family-recorded readings. Order is presentation order in the picker. */
  readers: Reader[];
}
