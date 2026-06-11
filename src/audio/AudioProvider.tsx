import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createAudioPlayer, useAudioPlayer } from 'expo-audio';
import { AudioController } from './AudioController';
import { AudioMode, Character, Theme } from '../themes/types';
import { loadAudioMode, saveAudioMode } from '../storage/settings';

const SFX_SPARKLE = require('../../assets/sfx/sparkle.mp3');
const SFX_SPAWN = require('../../assets/sfx/spawn.mp3');

interface AudioContextValue {
  mode: AudioMode;
  setMode: (m: AudioMode) => Promise<void>;
  onThemeChange: (theme: Theme) => void;
  playSparkleSFX: () => void;
  playSpawnSFX: () => void;
  playVoice: (character: Character) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export const AudioProvider: React.FC<{ initialTheme: Theme; children: React.ReactNode }> = ({
  initialTheme,
  children,
}) => {
  const controllerRef = useRef(new AudioController('silent'));
  const [mode, setModeState] = useState<AudioMode>('silent');
  const [currentMusicSource, setCurrentMusicSource] = useState<number>(initialTheme.music[0]);
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

  const playVoice = useCallback((character: Character) => {
    if (!controllerRef.current.shouldPlayVoice()) return;
    // Estimate clip length at 1500ms; controller plans the duck.
    const plan = controllerRef.current.describeDuck(1500);
    if (musicPlayer && controllerRef.current.shouldPlayMusic()) {
      musicPlayer.volume = plan.duckedVolume;
      setTimeout(() => {
        if (musicPlayer) musicPlayer.volume = 1.0;
      }, plan.fadeDownMs + plan.holdMs + plan.fadeUpMs);
    }
    playOneShot(character.voice, 1.0);
  }, [musicPlayer, playOneShot]);

  const value = useMemo<AudioContextValue>(
    () => ({ mode, setMode, onThemeChange, playSparkleSFX, playSpawnSFX, playVoice }),
    [mode, setMode, onThemeChange, playSparkleSFX, playSpawnSFX, playVoice],
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export function useAudio(): AudioContextValue {
  const v = useContext(AudioContext);
  if (!v) throw new Error('useAudio must be used inside <AudioProvider>');
  return v;
}
