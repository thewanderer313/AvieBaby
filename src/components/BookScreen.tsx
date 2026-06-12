import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppMode } from '../mode/AppModeProvider';
import { BOOKS } from '../books/BookRegistry';
import { BookProvider } from '../books/BookProvider';
import { BookPage } from './BookPage';
import { BookGestureSurface } from './BookGestureSurface';

export const BookScreen: React.FC = () => {
  const { currentBookId, currentReaderId } = useAppMode();

  const book = BOOKS.find((b) => b.id === currentBookId) ?? null;
  const reader = book?.readers.find((r) => r.id === currentReaderId) ?? null;

  if (!book || !reader) {
    return <View style={styles.root} />;
  }

  return (
    <BookProvider book={book} reader={reader}>
      <View style={styles.root}>
        <BookPage />
        <BookGestureSurface />
      </View>
    </BookProvider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
});
