import { AudioMode } from '../themes/types';

export interface DuckPlan {
  duckedVolume: number;
  fadeDownMs: number;
  holdMs: number;
  fadeUpMs: number;
}

export class AudioController {
  private mode: AudioMode;
  private lastTrackByTheme = new Map<string, number>();

  constructor(initial: AudioMode = 'silent') {
    this.mode = initial;
  }

  getMode(): AudioMode {
    return this.mode;
  }

  setMode(mode: AudioMode): void {
    this.mode = mode;
  }

  shouldPlayMusic(): boolean {
    return this.mode === 'full';
  }

  shouldPlaySFX(): boolean {
    return this.mode !== 'silent';
  }

  shouldPlayVoice(): boolean {
    return this.mode !== 'silent';
  }

  /**
   * Picks 0 or 1 (a theme has 2 tracks). Never returns the same value
   * as the previous pick for this theme.
   */
  pickTrackIndex(themeId: string): 0 | 1 {
    const last = this.lastTrackByTheme.get(themeId);
    const next: 0 | 1 = last === 0 ? 1 : last === 1 ? 0 : (Math.random() < 0.5 ? 0 : 1);
    this.lastTrackByTheme.set(themeId, next);
    return next;
  }

  describeDuck(voiceClipMs: number): DuckPlan {
    return {
      duckedVolume: 0.3,
      fadeDownMs: 120,
      holdMs: voiceClipMs,
      fadeUpMs: 400,
    };
  }
}
