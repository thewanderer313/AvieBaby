import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { REGISTRY } from '../books/BookRegistry';
import type { ReadingPage } from '../books/types';
import { useAudio } from '../audio/AudioProvider';

interface Props {
  page: ReadingPage;
  pageKey: string;
}

export const BookPage: React.FC<Props> = ({ page }) => {
  const imageSource = REGISTRY.assets[page.image];
  const audioSource = REGISTRY.assets[page.audio];
  const { playBookPage } = useAudio();

  useEffect(() => {
    if (audioSource != null) playBookPage(audioSource);
  }, [audioSource, playBookPage]);

  return (
    <View style={styles.fill}>
      {imageSource != null && (
        <Image source={imageSource} style={styles.fill} resizeMode="contain" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%', backgroundColor: '#000' },
});
