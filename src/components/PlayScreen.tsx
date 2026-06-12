import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BackgroundVideo } from './BackgroundVideo';
import { PlaySurface } from './PlaySurface';
import { MagicButton } from './MagicButton';

export const PlayScreen: React.FC = () => (
  <View style={styles.root}>
    <BackgroundVideo />
    <PlaySurface />
    <MagicButton />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});
