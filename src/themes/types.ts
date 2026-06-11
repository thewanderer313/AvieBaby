// src/themes/types.ts

export type AudioMode = 'silent' | 'gentle' | 'full';

export interface Character {
  /** Stable id used as map key (e.g., 'whale'). */
  id: string;
  /** Spoken label, e.g., 'Whale'. Used for the dev-time display and accessibility. */
  label: string;
  /** Bundled PNG; use require(). */
  image: number;
  /** Bundled mp3 voice clip; use require(). */
  voice: number;
}

export interface Theme {
  id: string;
  name: string;
  /** Bundled mp4 background loop. */
  video: number;
  /** Bundled mp3s, length 2. */
  music: [number, number];
  /** 2-3 characters per theme. */
  characters: Character[];
  /** Hex strings, 4-6 colors, used for sparkle trail particles. */
  sparkleColors: string[];
  /** Button color used by MagicButton when this theme is active. */
  buttonColor: string;
}
