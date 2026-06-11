import React, { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Character } from '../themes/types';

const SIZE = 120;
const LIFETIME_MS = 4000;

interface Props {
  character: Character;
  x: number;
  y: number;
  onComplete: () => void;
}

export const SpawnedCharacter: React.FC<Props> = ({ character, x, y, onComplete }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.15, { duration: 220, easing: Easing.out(Easing.back(1.6)) }),
      withTiming(1.0, { duration: 120 }),
    );
    opacity.value = withDelay(
      LIFETIME_MS - 600,
      withTiming(0, { duration: 600 }, (finished) => {
        if (finished) runOnJS(onComplete)();
      }),
    );
  }, [scale, opacity, onComplete]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { left: x - SIZE / 2, top: y - SIZE / 2 },
        animatedStyle,
      ]}
    >
      <Image source={character.image} style={styles.image} resizeMode="contain" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
