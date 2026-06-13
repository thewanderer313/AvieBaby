import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useBooks } from '../books/BookProvider';
import { useAudio } from '../audio/AudioProvider';
import { REGISTRY } from '../books/BookRegistry';

export const BookPage: React.FC = () => {
  const { selectedReading, pageIndex } = useBooks();
  const { playBookPage } = useAudio();

  useEffect(() => {
    if (!selectedReading) return;
    const page = selectedReading.pages[pageIndex];
    if (!page) return;
    const audioSource = REGISTRY.assets[page.audio];
    if (audioSource !== undefined) {
      playBookPage(audioSource);
    }
  }, [pageIndex, selectedReading, playBookPage]);

  if (!selectedReading) return <View style={styles.wrap} />;
  const page = selectedReading.pages[pageIndex];
  const imageSource = page ? REGISTRY.assets[page.image] : undefined;

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
