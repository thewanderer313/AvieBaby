import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useTheme } from '../themes/ThemeProvider';
import { useAudio } from '../audio/AudioProvider';
import { Character } from '../themes/types';
import { SpawnedCharacter } from './SpawnedCharacter';
import {
  SparkleParticles,
  makeParticle,
  Particle,
} from './SparkleParticles';

interface Spawn {
  key: number;
  character: Character;
  x: number;
  y: number;
}

const MAX_SPAWNS = 15;
let _spawnKey = 1;

export const PlaySurface: React.FC = () => {
  const { theme } = useTheme();
  const { playSpawnSFX, playSparkleSFX, playVoice } = useAudio();
  const [spawns, setSpawns] = useState<Spawn[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  // Throttle ref lives on the JS thread; we read/mutate it inside dragUpdate
  // (a JS-thread callback) rather than from the worklet, since Reanimated
  // worklets cannot reliably observe mutations to JS-scope `let` variables.
  const lastSfxAtRef = useRef(0);

  const spawnCharacter = useCallback(
    (x: number, y: number) => {
      const list = theme.characters;
      if (list.length === 0) return;
      const character = list[Math.floor(Math.random() * list.length)];
      setSpawns((prev) => {
        const next = [...prev, { key: _spawnKey++, character, x, y }];
        return next.slice(-MAX_SPAWNS);
      });
      playSpawnSFX();
      playVoice(character);
    },
    [theme.characters, playSpawnSFX, playVoice],
  );

  const emitSparkle = useCallback(
    (x: number, y: number) => {
      const color = theme.sparkleColors[Math.floor(Math.random() * theme.sparkleColors.length)];
      for (let i = 0; i < 4; i++) {
        particlesRef.current.push(makeParticle(x, y, color));
      }
    },
    [theme.sparkleColors],
  );

  const dragUpdate = useCallback(
    (x: number, y: number) => {
      emitSparkle(x, y);
      const now = Date.now();
      if (now - lastSfxAtRef.current > 200) {
        lastSfxAtRef.current = now;
        playSparkleSFX();
      }
    },
    [emitSparkle, playSparkleSFX],
  );

  const removeSpawn = useCallback((key: number) => {
    setSpawns((prev) => prev.filter((s) => s.key !== key));
  }, []);

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      runOnJS(spawnCharacter)(e.x, e.y);
    });

  const pan = Gesture.Pan()
    .minDistance(2)
    .onUpdate((e) => {
      runOnJS(dragUpdate)(e.x, e.y);
    });

  const gesture = Gesture.Simultaneous(tap, pan);

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill}>
        <SparkleParticles particlesRef={particlesRef} />
        {spawns.map((s) => (
          <SpawnedCharacter
            key={s.key}
            character={s.character}
            x={s.x}
            y={s.y}
            onComplete={() => removeSpawn(s.key)}
          />
        ))}
      </View>
    </GestureDetector>
  );
};

