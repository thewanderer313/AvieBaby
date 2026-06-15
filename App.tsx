import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/themes/ThemeProvider';
import { AudioProvider } from './src/audio/AudioProvider';
import { PlayScreen } from './src/components/PlayScreen';
import { AdultPanel } from './src/components/AdultPanel';
import { Greeting } from './src/components/Greeting';
import { THEMES } from './src/themes/ThemeRegistry';
import { AppModeProvider, useAppMode } from './src/mode/AppModeProvider';
import { BookProvider } from './src/books/BookProvider';
import { BookScreen } from './src/components/BookScreen';

function Root() {
  const { theme } = useTheme();
  const { mode } = useAppMode();
  return (
    <AudioProvider initialTheme={theme}>
      <View style={styles.root}>
        {mode === 'play' ? <PlayScreen /> : <BookScreen />}
        <AdultPanel />
        <Greeting />
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
      <AppModeProvider>
        <ThemeProvider>
          <BookProvider>
            <Root />
          </BookProvider>
        </ThemeProvider>
      </AppModeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});

// Touch THEMES to keep the registry imported for any tooling that tree-shakes
// dev-only imports too aggressively in some Metro configurations.
void THEMES;
