import React, { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  useClock,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  bornAt: number;
  lifetimeMs: number;
}

const MAX_PARTICLES = 200;
const GRAVITY = 80; // px/s^2

export interface SparkleParticlesHandle {
  emit: (x: number, y: number, color: string) => void;
}

interface Props {
  particlesRef: React.MutableRefObject<Particle[]>;
}

export const SparkleParticles: React.FC<Props> = ({ particlesRef }) => {
  const clock = useClock();
  const lastTime = useSharedValue(0);
  const tick = useSharedValue(0);

  const _ = useDerivedValue(() => {
    const now = clock.value;
    const dt = lastTime.value === 0 ? 0 : (now - lastTime.value) / 1000;
    lastTime.value = now;

    const list = particlesRef.current;
    const alive: Particle[] = [];
    for (const p of list) {
      const age = now - p.bornAt;
      if (age > p.lifetimeMs) continue;
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      alive.push(p);
    }
    particlesRef.current = alive.slice(-MAX_PARTICLES);
    tick.value = now;
    return now;
  }, [clock, particlesRef]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <ParticleLayer particlesRef={particlesRef} tick={tick} />
    </Canvas>
  );
};

const ParticleLayer: React.FC<{
  particlesRef: React.MutableRefObject<Particle[]>;
  tick: ReturnType<typeof useSharedValue<number>>;
}> = ({ particlesRef, tick }) => {
  // Reading tick.value on every frame forces a re-render of this Group.
  const _t = useDerivedValue(() => tick.value, [tick]);
  const list = particlesRef.current;
  const now = Date.now();
  return (
    <Group>
      {list.map((p) => {
        const age = now - p.bornAt;
        const lifeFrac = Math.min(1, age / p.lifetimeMs);
        const r = 6 * (1 - lifeFrac * 0.6);
        const opacity = 1 - lifeFrac;
        return (
          <Circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={r}
            color={p.color}
            opacity={opacity}
          />
        );
      })}
    </Group>
  );
};

let _nextId = 1;
export function makeParticle(x: number, y: number, color: string): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 30 + Math.random() * 80;
  return {
    id: _nextId++,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 60,
    color,
    bornAt: Date.now(),
    lifetimeMs: 800 + Math.random() * 400,
  };
}
