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

export const MagicButton: React.FC = () => {
  const { theme, advance } = useTheme();
  const { onThemeChange, playSparkleSFX } = useAudio();
  const scale = useSharedValue(1);
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
    scale.value = withSequence(
      withTiming(1.25, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(1.0, { duration: 200 }),
    );
    playSparkleSFX();
    advance();
  }, [advance, scale, playSparkleSFX]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.hit}
      hitSlop={20}
      accessibilityLabel="Change theme"
    >
      <Animated.View
        style={[
          styles.button,
          { backgroundColor: theme.buttonColor },
          animated,
        ]}
      >
        <Text style={styles.label} allowFontScaling={false}>Ava</Text>
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
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
