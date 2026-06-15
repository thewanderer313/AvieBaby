import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useBooks } from '../books/BookProvider';

// Size of the AdultPanel long-press hotspot corner to exclude from page gestures.
const HOTSPOT = 120;

export const BookGestureSurface: React.FC = () => {
  const { goToNext, goToPrev } = useBooks();

  // Right half: tap to advance to next page.
  const nextTap = Gesture.Tap().maxDuration(799).onEnd(() => {
    runOnJS(goToNext)();
  });

  // Left half: tap to go back to previous page.
  const prevTap = Gesture.Tap().maxDuration(799).onEnd(() => {
    runOnJS(goToPrev)();
  });

  // Layout in LANDSCAPE_LEFT:
  //   ┌──────────────────────┬──────────────────────┐
  //   │                      │                      │
  //   │     LEFT HALF        │     RIGHT HALF       │
  //   │     tap = prev       │     tap = next       │
  //   │                      │                      │
  //   ├──────────┬───────────┤                      │
  //   │ HOTSPOT  │ bottom-   │                      │
  //   │ (no     │ left-rest │                      │
  //   │ gesture)│ tap = prev│                      │
  //   └──────────┴───────────┴──────────────────────┘
  //
  // The bottom-left HOTSPOT×HOTSPOT corner is left without a page-gesture
  // detector so the AdultPanel's 2 s LongPress can fire from that physical
  // corner (which is the top-left in portrait once we exit book mode).

  return (
    <View style={styles.surface} pointerEvents="box-none">
      {/* Left half — column: top region + bottom strip (hotspot gap + rest) */}
      <View style={styles.leftHalf} pointerEvents="box-none">
        <GestureDetector gesture={prevTap}>
          <View style={styles.topPortion} />
        </GestureDetector>
        <View style={styles.bottomStrip} pointerEvents="box-none">
          <View style={styles.hotspotGap} />
          <GestureDetector gesture={prevTap}>
            <View style={styles.bottomLeftRest} />
          </GestureDetector>
        </View>
      </View>

      {/* Right half — full height tap-to-next */}
      <GestureDetector gesture={nextTap}>
        <View style={styles.rightHalf} />
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  surface: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  leftHalf: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  rightHalf: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topPortion: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bottomStrip: {
    height: HOTSPOT,
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  hotspotGap: {
    width: HOTSPOT,
    height: HOTSPOT,
    backgroundColor: 'transparent',
  },
  bottomLeftRest: {
    flex: 1,
    height: HOTSPOT,
    backgroundColor: 'transparent',
  },
});
