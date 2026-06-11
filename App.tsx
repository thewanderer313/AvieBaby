import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/themes/ThemeProvider';
import { AudioProvider } from './src/audio/AudioProvider';
import { BackgroundVideo } from './src/components/BackgroundVideo';
import { PlaySurface } from './src/components/PlaySurface';
import { MagicButton } from './src/components/MagicButton';
import { AdultPanel } from './src/components/AdultPanel';
import { THEMES } from './src/themes/ThemeRegistry';

function Root() {
  const { theme } = useTheme();
  return (
    <AudioProvider initialTheme={theme}>
      <View style={styles.root}>
        <BackgroundVideo />
        <PlaySurface />
        <MagicButton />
        <AdultPanel />
      </View>
    </AudioProvider>
  );
}

export default function App() {
  useEffect(() => {
    // Swallow the Android hardware back button — the only exit is via AdultPanel.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});

// Touch THEMES to keep the registry imported for any tooling that tree-shakes
// dev-only imports too aggressively in some Metro configurations.
void THEMES;
