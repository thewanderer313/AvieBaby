import { AudioController } from './AudioController';
import { THEMES } from '../themes/ThemeRegistry';

describe('AudioController', () => {
  describe('track picking', () => {
    test('picks a valid track index for a theme', () => {
      const c = new AudioController();
      const idx = c.pickTrackIndex('sleepy-ocean');
      expect([0, 1]).toContain(idx);
    });

    test('does not repeat back-to-back for the same theme', () => {
      const c = new AudioController();
      const seen: number[] = [];
      for (let i = 0; i < 5; i++) {
        seen.push(c.pickTrackIndex('sleepy-ocean'));
      }
      for (let i = 1; i < seen.length; i++) {
        expect(seen[i]).not.toBe(seen[i - 1]);
      }
    });

    test('tracks history per theme independently', () => {
      const c = new AudioController();
      const ocean1 = c.pickTrackIndex('sleepy-ocean');
      const space1 = c.pickTrackIndex('sparkle-space');
      const ocean2 = c.pickTrackIndex('sleepy-ocean');
      expect(ocean2).not.toBe(ocean1);
      expect([0, 1]).toContain(space1);
    });
  });

  describe('shouldPlayMusic / shouldPlaySFX / shouldPlayVoice', () => {
    test('silent mode: nothing plays', () => {
      const c = new AudioController('silent');
      expect(c.shouldPlayMusic()).toBe(false);
      expect(c.shouldPlaySFX()).toBe(false);
      expect(c.shouldPlayVoice()).toBe(false);
    });

    test('gentle mode: SFX + voice yes, music no', () => {
      const c = new AudioController('gentle');
      expect(c.shouldPlayMusic()).toBe(false);
      expect(c.shouldPlaySFX()).toBe(true);
      expect(c.shouldPlayVoice()).toBe(true);
    });

    test('music mode: music + SFX yes, voice no', () => {
      const c = new AudioController('music');
      expect(c.shouldPlayMusic()).toBe(true);
      expect(c.shouldPlaySFX()).toBe(true);
      expect(c.shouldPlayVoice()).toBe(false);
    });

    test('full mode: all three yes', () => {
      const c = new AudioController('full');
      expect(c.shouldPlayMusic()).toBe(true);
      expect(c.shouldPlaySFX()).toBe(true);
      expect(c.shouldPlayVoice()).toBe(true);
    });

    test('setMode changes behavior', () => {
      const c = new AudioController('silent');
      c.setMode('full');
      expect(c.shouldPlayMusic()).toBe(true);
      c.setMode('music');
      expect(c.shouldPlayVoice()).toBe(false);
      expect(c.shouldPlayMusic()).toBe(true);
    });
  });

  describe('voice ducking schedule', () => {
    test('describeDuck returns target volume and ramp times', () => {
      const c = new AudioController('full');
      const plan = c.describeDuck(1500); // voice clip 1.5s
      expect(plan.duckedVolume).toBe(0.3);
      expect(plan.fadeDownMs).toBeGreaterThan(0);
      expect(plan.holdMs).toBe(1500);
      expect(plan.fadeUpMs).toBeGreaterThan(0);
    });
  });

  test('registry sanity: every theme has 2 tracks', () => {
    for (const t of THEMES) expect(t.music).toHaveLength(2);
  });
});
