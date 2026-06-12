import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  BackHandler,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useTheme } from '../themes/ThemeProvider';
import { useAudio } from '../audio/AudioProvider';
import { AudioMode } from '../themes/types';
import { THEMES } from '../themes/ThemeRegistry';

const AUTO_DISMISS_MS = 5000;

export const AdultPanel: React.FC = () => {
  const { jumpTo, theme } = useTheme();
  const { mode, setMode } = useAudio();
  const [open, setOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetDismissTimer = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setOpen(false), AUTO_DISMISS_MS);
  }, []);

  useEffect(() => {
    if (open) resetDismissTimer();
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [open, resetDismissTimer]);

  useEffect(() => {
    if (!open) setConfirmExit(false);
  }, [open]);

  const openPanel = useCallback(() => setOpen(true), []);

  // Use gesture-handler's LongPress so it competes in the same gesture system
  // as PlaySurface (which uses Gesture.Pan + Gesture.Tap). React Native's
  // Pressable can be starved of touches when a sibling Pan gesture is waiting
  // for movement.
  const longPress = Gesture.LongPress()
    .minDuration(2000)
    .maxDistance(40)
    .shouldCancelWhenOutside(false)
    .onStart(() => {
      runOnJS(openPanel)();
    });

  const onChangeMode = useCallback(
    (m: AudioMode) => {
      setMode(m);
      resetDismissTimer();
    },
    [setMode, resetDismissTimer],
  );

  const onJump = useCallback(
    (id: string) => {
      jumpTo(id);
      resetDismissTimer();
    },
    [jumpTo, resetDismissTimer],
  );

  const onExit = useCallback(() => {
    if (!confirmExit) {
      setConfirmExit(true);
      resetDismissTimer();
      return;
    }
    BackHandler.exitApp();
  }, [confirmExit, resetDismissTimer]);

  return (
    <>
      <GestureDetector gesture={longPress}>
        <View style={styles.hotspot} />
      </GestureDetector>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.panel} onTouchStart={resetDismissTimer}>
            <Text style={styles.title}>Ava's App</Text>
            <Text style={styles.tagline}>Made just for Ava</Text>

            <Text style={styles.label}>Audio</Text>
            <View style={styles.row}>
              {(['silent', 'gentle', 'full'] as AudioMode[]).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.radio, mode === m && styles.radioActive]}
                  onPress={() => onChangeMode(m)}
                >
                  <Text style={styles.radioText}>{m}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Jump to theme</Text>
            <View style={styles.row}>
              {THEMES.map((t) => (
                <Pressable
                  key={t.id}
                  style={[styles.themeBtn, theme.id === t.id && styles.themeBtnActive]}
                  onPress={() => onJump(t.id)}
                >
                  <Text style={styles.radioText}>{t.name}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.exit} onPress={onExit}>
              <Text style={styles.exitText}>{confirmExit ? 'Tap again to exit' : 'Exit app'}</Text>
            </Pressable>

            <Pressable style={styles.close} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  hotspot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 120,
    height: 120,
    // Temporary debug tint — confirms hotspot position is reachable. Remove
    // once the long-press is firing reliably on device.
    backgroundColor: 'rgba(255, 80, 80, 0.18)',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: 320,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  tagline: { color: '#aaa', fontSize: 12, marginTop: 2, marginBottom: 8, fontStyle: 'italic' },
  label: { color: '#aaa', fontSize: 12, marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  radio: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2c2c2e' },
  radioActive: { backgroundColor: '#0a84ff' },
  radioText: { color: '#fff', fontSize: 14 },
  themeBtn: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2c2c2e' },
  themeBtnActive: { backgroundColor: '#0a84ff' },
  exit: { marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: '#3a1c1c' },
  exitText: { color: '#ff453a', textAlign: 'center' },
  close: { marginTop: 8, padding: 10 },
  closeText: { color: '#999', textAlign: 'center' },
});
