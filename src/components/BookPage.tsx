import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useBook } from '../books/BookProvider';
import { useAudio } from '../audio/AudioProvider';

export const BookPage: React.FC = () => {
  const { book, reader, currentPage } = useBook();
  const { playBookPage } = useAudio();

  // Whenever the page index changes (including initial mount), play that
  // page's audio. The audio provider cancels any in-flight book clip first.
  useEffect(() => {
    const audioSource = reader.pages[currentPage];
    if (audioSource !== undefined) {
      playBookPage(audioSource);
    }
  }, [currentPage, reader.pages, playBookPage]);

  const imageSource = book.pages[currentPage];

  return (
    <View style={styles.wrap}>
      {imageSource !== undefined && (
        <Image source={imageSource} style={styles.image} resizeMode="contain" />
      )}
    </View>
  );
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
  image: {
    width: '100%',
    height: '100%',
  },
});
