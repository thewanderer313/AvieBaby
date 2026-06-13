import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useBooks } from '../books/BookProvider';

export const BookPage: React.FC = () => {
  // TODO Task 16: resolve page.image / page.audio asset ids and render image + audio.
  const { selectedReading, pageIndex } = useBooks();

  if (!selectedReading) return <View style={styles.wrap} />;
  // Page is intentionally unused until Task 16 wires up asset resolution.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _page = selectedReading.pages[pageIndex];

  return <View style={styles.wrap} />;
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
});
