import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useBooks } from '../books/BookProvider';

// Size of the AdultPanel long-press hotspot corner to exclude.
const HOTSPOT = 120;

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

  // Split into two Views so the bottom-left 120x120 corner is excluded.
  // In LANDSCAPE_LEFT mode the AdultPanel hotspot sits at bottom-left
  // (same physical corner). We do not place a gesture detector there so
  // the AdultPanel's 2000 ms LongPress can fire without a spurious page-flip.
  //
  //  ┌──────────────────────────────────┐
  //  │          top strip (full width)  │ flex:1 top
  //  ├────────┬─────────────────────────┤
  //  │ hotspot│  bottom strip (rest)    │ HOTSPOT tall
  //  └────────┴─────────────────────────┘
  //   ^HOTSPOT^

  return (
    <View style={styles.surface} pointerEvents="box-none">
      {/* Top region — full width, fills remaining space above bottom strip */}
      <GestureDetector gesture={gesture}>
        <View style={styles.topRegion} />
      </GestureDetector>

      {/* Bottom strip — excludes the left HOTSPOT×HOTSPOT corner */}
      <View style={styles.bottomStrip} pointerEvents="box-none">
        {/* Left gap: the hotspot corner — no gesture detector */}
        <View style={styles.hotspotGap} />
        {/* Right portion of bottom strip */}
        <GestureDetector gesture={gesture}>
          <View style={styles.bottomRight} />
        </GestureDetector>
      </View>
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
    backgroundColor: 'transparent',
  },
  topRegion: {
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
  bottomRight: {
    flex: 1,
    height: HOTSPOT,
    backgroundColor: 'transparent',
  },
});
