import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BookPage } from './BookPage';
import { BookGestureSurface } from './BookGestureSurface';

export const BookScreen: React.FC = () => {
  return (
    <View style={styles.root}>
      <BookPage />
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
