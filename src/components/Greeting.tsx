import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAudio } from '../audio/AudioProvider';

const FADE_IN_MS = 400;
const HOLD_MS = 1500;
const FADE_OUT_MS = 700;

export const Greeting: React.FC = () => {
  const opacity = useSharedValue(0);
  const [done, setDone] = useState(false);
  const { playGreeting } = useAudio();
  const playedRef = useRef(false);

  // Animation runs once on mount.
  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.cubic) }),
      withDelay(
        HOLD_MS,
        withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
          if (finished) runOnJS(setDone)(true);
        }),
      ),
    );
  }, [opacity]);

  // Audio runs once on mount, delayed slightly so the audio mode has time
  // to hydrate from AsyncStorage (initial mode is 'silent' until load completes).
  //
  // playGreeting's identity changes whenever AudioProvider rebuilds it (e.g., a
  // theme change replaces the music player). The playedRef guard ensures the
  // greeting audio fires AT MOST ONCE per app launch, regardless of how many
  // times this effect re-runs after the initial play.
  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    const audioTimer = setTimeout(playGreeting, 300);
    return () => clearTimeout(audioTimer);
  }, [playGreeting]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (done) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, style]}>
      <Animated.View style={styles.card}>
        <Text style={styles.title}>Hi Ava!</Text>
        <Text style={styles.subtitle}>An app made just for Ava ♥</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    paddingHorizontal: 36,
    paddingVertical: 28,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
    opacity: 0.85,
  },
});
