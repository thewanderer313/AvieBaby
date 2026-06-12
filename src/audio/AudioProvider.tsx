import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createAudioPlayer, useAudioPlayer } from 'expo-audio';
import { AudioController } from './AudioController';
import { AudioMode, Character, Theme } from '../themes/types';
import { loadAudioMode, saveAudioMode } from '../storage/settings';

const SFX_SPARKLE = require('../../assets/sfx/sparkle.mp3');
const SFX_SPAWN = require('../../assets/sfx/spawn.mp3');
const GREETING_AUDIO = require('../../assets/greeting.mp3');

interface AudioContextValue {
  mode: AudioMode;
  setMode: (m: AudioMode) => Promise<void>;
  onThemeChange: (theme: Theme) => void;
  playSparkleSFX: () => void;
  playSpawnSFX: () => void;
  playVoice: (character: Character) => void;
  playGreeting: () => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export const AudioProvider: React.FC<{ initialTheme: Theme; children: React.ReactNode }> = ({
  initialTheme,
  children,
}) => {
  const controllerRef = useRef(new AudioController('silent'));
  const duckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setModeState] = useState<AudioMode>('silent');
  const [currentMusicSource, setCurrentMusicSource] = useState<number>(() => {
    const idx = controllerRef.current.pickTrackIndex(initialTheme.id);
    return initialTheme.music[idx];
  });
  const musicPlayer = useAudioPlayer(currentMusicSource);

  // Hydrate audio mode from storage on mount.
  useEffect(() => {
    loadAudioMode()
      .then((m) => {
        controllerRef.current.setMode(m);
        setModeState(m);
      })
      .catch(() => {
        // Silently fall back — controller already defaults to 'silent' from the constructor.
      });
  }, []);

  // Start/stop music whenever mode or source changes.
  useEffect(() => {
    if (!musicPlayer) return;
    musicPlayer.loop = true;
    if (controllerRef.current.shouldPlayMusic()) {
      musicPlayer.volume = 1.0;
      musicPlayer.play();
    } else {
      musicPlayer.pause();
    }
  }, [mode, musicPlayer, currentMusicSource]);

  const setMode = useCallback(async (m: AudioMode) => {
    controllerRef.current.setMode(m);
    setModeState(m);
    await saveAudioMode(m);
  }, []);

  const onThemeChange = useCallback((theme: Theme) => {
    const idx = controllerRef.current.pickTrackIndex(theme.id);
    setCurrentMusicSource(theme.music[idx]);
  }, []);

  const playOneShot = useCallback((source: number, volume = 1.0) => {
    try {
      const p = createAudioPlayer(source);
      p.volume = volume;
      p.play();
      // Release after a generous window — clips are <2s.
      setTimeout(() => {
        try { p.remove(); } catch {}
      }, 3000);
    } catch {}
  }, []);

  const playSparkleSFX = useCallback(() => {
    if (controllerRef.current.shouldPlaySFX()) playOneShot(SFX_SPARKLE, 0.7);
  }, [playOneShot]);

  const playSpawnSFX = useCallback(() => {
    if (controllerRef.current.shouldPlaySFX()) playOneShot(SFX_SPAWN, 0.8);
  }, [playOneShot]);

  const playDuckedAudio = useCallback(
    (source: number, estimatedDurationMs: number) => {
      if (!controllerRef.current.shouldPlayVoice()) return;
      const plan = controllerRef.current.describeDuck(estimatedDurationMs);
      if (musicPlayer && controllerRef.current.shouldPlayMusic()) {
        // Cancel any pending restore from a still-in-flight clip.
        if (duckTimerRef.current) {
          clearTimeout(duckTimerRef.current);
          duckTimerRef.current = null;
        }
        try { musicPlayer.volume = plan.duckedVolume; } catch {}
        duckTimerRef.current = setTimeout(() => {
          duckTimerRef.current = null;
          try { musicPlayer.volume = 1.0; } catch {}
        }, plan.fadeDownMs + plan.holdMs + plan.fadeUpMs);
      }
      playOneShot(source, 1.0);
    },
    [musicPlayer, playOneShot],
  );

  const playVoice = useCallback(
    (character: Character) => playDuckedAudio(character.voice, 1500),
    [playDuckedAudio],
  );

  const playGreeting = useCallback(
    () => playDuckedAudio(GREETING_AUDIO, 3500),
    [playDuckedAudio],
  );

  useEffect(() => {
    return () => {
      if (duckTimerRef.current) {
        clearTimeout(duckTimerRef.current);
        duckTimerRef.current = null;
      }
    };
  }, []);

  const value = useMemo<AudioContextValue>(
    () => ({ mode, setMode, onThemeChange, playSparkleSFX, playSpawnSFX, playVoice, playGreeting }),
    [mode, setMode, onThemeChange, playSparkleSFX, playSpawnSFX, playVoice, playGreeting],
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export function useAudio(): AudioContextValue {
  const v = useContext(AudioContext);
  if (!v) throw new Error('useAudio must be used inside <AudioProvider>');
  return v;
}
