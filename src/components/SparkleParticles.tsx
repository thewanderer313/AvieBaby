import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  /** ms since some shared origin (we use Date.now()) */
  bornAt: number;
  lifetimeMs: number;
}

export interface SparkleParticlesHandle {
  emit: (x: number, y: number, color: string) => void;
}

const MAX_PARTICLES = 200;
const GRAVITY = 80; // px/s^2

interface Props {
  particlesRef: React.MutableRefObject<Particle[]>;
}

/**
 * Renders particles from a parent-owned ref. Runs a JS-thread requestAnimationFrame
 * loop that advances physics, culls dead particles, and triggers a re-render so the
 * Skia canvas repaints. The ref pattern lets the parent push new particles without
 * paying for a setState per emit (drags fire many emits per frame).
 */
export const SparkleParticles: React.FC<Props> = ({ particlesRef }) => {
  // tick is incremented every animation frame to force a re-render
  // even though the actual particle data lives in a ref. The number value is
  // not consumed; only its identity change matters.
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let last = performance.now();

    const step = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(0.05, (now - last) / 1000); // clamp to 50ms to avoid jumps on tab restore
      last = now;
      const nowEpoch = Date.now();

      const src = particlesRef.current;
      const alive: Particle[] = [];
      for (let i = 0; i < src.length; i++) {
        const p = src[i];
        const age = nowEpoch - p.bornAt;
        if (age > p.lifetimeMs) continue;
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        alive.push(p);
      }
      // Drop oldest first if over the cap.
      particlesRef.current = alive.length > MAX_PARTICLES
        ? alive.slice(alive.length - MAX_PARTICLES)
        : alive;

      setTick((t) => (t + 1) & 0x7fffffff);
      raf = requestAnimationFrame(step);
    };

    let raf = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [particlesRef]);

  const list = particlesRef.current;
  const nowEpoch = Date.now();

  return (
    <Canvas style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Group>
        {list.map((p) => {
          const age = nowEpoch - p.bornAt;
          const lifeFrac = age <= 0 ? 0 : Math.min(1, age / p.lifetimeMs);
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
    </Canvas>
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
