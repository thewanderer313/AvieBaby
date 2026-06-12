import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../themes/ThemeProvider';
import { useAudio } from '../audio/AudioProvider';

const SIZE = 110;
const RING_MAX_SCALE = 3.2;
const PRESS_DURATION_MS = 600;

export const MagicButton: React.FC = () => {
  const { theme, advance } = useTheme();
  const { onThemeChange, playSparkleSFX } = useAudio();
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const didMountRef = useRef(false);

  // AudioProvider already picked an initial track for the first theme,
  // so we only notify on subsequent theme changes (after the user presses the button).
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    onThemeChange(theme);
  }, [theme, onThemeChange]);

  const onPress = useCallback(() => {
    // Squish → big pop → settle. More dramatic than the previous single bounce
    // so the press feels physically satisfying.
    scale.value = withSequence(
      withTiming(0.85, { duration: 80, easing: Easing.out(Easing.quad) }),
      withTiming(1.4, { duration: 220, easing: Easing.out(Easing.back(2)) }),
      withTiming(1.0, { duration: 220, easing: Easing.inOut(Easing.cubic) }),
    );

    // Spin one full turn
    rotation.value = 0;
    rotation.value = withTiming(360, {
      duration: PRESS_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });

    // Glow halo: brief pulse of theme color behind the button.
    glowScale.value = 1;
    glowOpacity.value = 0;
    glowScale.value = withSequence(
      withTiming(1.45, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(1.65, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    glowOpacity.value = withSequence(
      withTiming(0.65, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );

    // Shockwave ring expanding outward
    ringScale.value = 0;
    ringOpacity.value = 0.7;
    ringScale.value = withTiming(RING_MAX_SCALE, {
      duration: PRESS_DURATION_MS + 100,
      easing: Easing.out(Easing.cubic),
    });
    ringOpacity.value = withTiming(0, {
      duration: PRESS_DURATION_MS + 100,
      easing: Easing.out(Easing.cubic),
    });

    playSparkleSFX();
    advance();
  }, [advance, scale, rotation, ringScale, ringOpacity, glowScale, glowOpacity, playSparkleSFX]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.hit}
      hitSlop={20}
      accessibilityLabel="Magic button — change theme"
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          { backgroundColor: theme.buttonColor },
          glowStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { borderColor: theme.buttonColor },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.button,
          { backgroundColor: theme.buttonColor },
          buttonStyle,
        ]}
      >
        <Text style={styles.label} allowFontScaling={false}>
          Magic{'\n'}Button
        </Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  hit: {
    position: 'absolute',
    right: 24,
    bottom: 40,
    width: SIZE + 40,
    height: SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 6,
  },
  glow: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  label: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
