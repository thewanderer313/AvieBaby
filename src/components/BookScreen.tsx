import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BookPage } from './BookPage';
import { BookGestureSurface } from './BookGestureSurface';
import { useBooks } from '../books/BookProvider';

export const BookScreen: React.FC = () => {
  const { selectedReading, pageIndex } = useBooks();

  // Parent should only mount BookScreen when a reading is selected.
  // Guard here in case of a race.
  if (!selectedReading) return null;

  const page = selectedReading.pages[pageIndex];

  return (
    <View style={styles.root}>
      <BookPage
        page={page}
        pageKey={`${selectedReading.id}-${pageIndex}`}
      />
      <BookGestureSurface />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
});
