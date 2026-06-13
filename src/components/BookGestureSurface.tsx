import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useBooks } from '../books/BookProvider';

export const BookGestureSurface: React.FC = () => {
  const { goToNext, goToPrev } = useBooks();

  const tap = Gesture.Tap()
    .maxDuration(799)
    .onEnd(() => {
      runOnJS(goToNext)();
    });

  const longPress = Gesture.LongPress()
    .minDuration(800)
    .maxDistance(40)
    .shouldCancelWhenOutside(false)
    .onStart(() => {
      runOnJS(goToPrev)();
    });

  const gesture = Gesture.Race(tap, longPress);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.surface} />
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  surface: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});
