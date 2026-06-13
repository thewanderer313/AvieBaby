import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { REGISTRY } from '../books/BookRegistry';
import { useAppMode } from '../mode/AppModeProvider';

const AUTO_DISMISS_MS = 5000;

type PanelView = 'settings' | 'lockdown' | 'book-picker' | 'reader-picker';
type LockdownPlatform = 'android' | 'ios';

const ANDROID_STEPS: string[] = [
  'Open Settings → Security & privacy → Other security settings → App pinning. Turn it ON.',
  'Toggle "Ask for PIN before unpinning" ON so Ava can\'t accidentally unpin it.',
  'Open this app, then open the Recents view (swipe up + hold, or the recents button).',
  'Tap the AvieBaby icon at the top of its card, then tap "Pin".',
  'To unpin later: swipe up from the bottom and hold. The phone will ask for your PIN.',
];

const IOS_STEPS: string[] = [
  'Open Settings → Accessibility → Guided Access. Turn it ON.',
  'Tap "Passcode Settings" and set a Guided Access passcode (Touch ID / Face ID optional).',
  'Open this app.',
  'Triple-click the side button, then tap "Start" in the top-right.',
  'To exit: triple-click the side button, enter your passcode, then tap "End".',
];

export const AdultPanel: React.FC = () => {
  const { jumpTo, theme } = useTheme();
  const { mode, setMode } = useAudio();
  const { mode: appMode, enterBook, exitBook } = useAppMode();
  const [selectedBookForReaderPicker, setSelectedBookForReaderPicker] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [view, setView] = useState<PanelView>('settings');
  const [shownPlatform, setShownPlatform] = useState<LockdownPlatform>(
    Platform.OS === 'ios' ? 'ios' : 'android',
  );
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
    if (!open) {
      setConfirmExit(false);
      setView('settings');
      setSelectedBookForReaderPicker(null);
    }
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

  const openLockdown = useCallback(() => {
    setView('lockdown');
    resetDismissTimer();
  }, [resetDismissTimer]);

  const backToSettings = useCallback(() => {
    setView('settings');
    resetDismissTimer();
  }, [resetDismissTimer]);

  const openBookPicker = useCallback(() => {
    setView('book-picker');
    resetDismissTimer();
  }, [resetDismissTimer]);

  const onPickBook = useCallback(
    (bookId: string) => {
      setSelectedBookForReaderPicker(bookId);
      setView('reader-picker');
      resetDismissTimer();
    },
    [resetDismissTimer],
  );

  const onPickReader = useCallback(
    (bookId: string, readerId: string) => {
      enterBook(bookId, readerId);
      setOpen(false);
    },
    [enterBook],
  );

  const onExitBook = useCallback(() => {
    exitBook();
    setOpen(false);
  }, [exitBook]);

  const onChangePlatform = useCallback(
    (p: LockdownPlatform) => {
      setShownPlatform(p);
      resetDismissTimer();
    },
    [resetDismissTimer],
  );

  return (
    <>
      <GestureDetector gesture={longPress}>
        <View style={[styles.hotspot, appMode === 'book' ? styles.hotspotLandscape : styles.hotspotPortrait]} />
      </GestureDetector>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.panel} onTouchStart={resetDismissTimer}>
            {view === 'settings' && (
              <SettingsView
                appMode={appMode}
                mode={mode}
                onChangeMode={onChangeMode}
                themeId={theme.id}
                onJump={onJump}
                onOpenLockdown={openLockdown}
                onOpenBookPicker={openBookPicker}
                onExit={onExit}
                onExitBook={onExitBook}
                confirmExit={confirmExit}
                onClose={() => setOpen(false)}
              />
            )}
            {view === 'lockdown' && (
              <LockdownView
                shownPlatform={shownPlatform}
                onChangePlatform={onChangePlatform}
                onBack={backToSettings}
              />
            )}
            {view === 'book-picker' && (
              <BookPickerView
                onPick={onPickBook}
                onBack={backToSettings}
              />
            )}
            {view === 'reader-picker' && selectedBookForReaderPicker && (
              <ReaderPickerView
                bookId={selectedBookForReaderPicker}
                onPick={onPickReader}
                onBack={() => {
                  setView('book-picker');
                  resetDismissTimer();
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

interface SettingsViewProps {
  appMode: 'play' | 'book';
  mode: AudioMode;
  onChangeMode: (m: AudioMode) => void;
  themeId: string;
  onJump: (id: string) => void;
  onOpenLockdown: () => void;
  onOpenBookPicker: () => void;
  onExit: () => void;
  onExitBook: () => void;
  confirmExit: boolean;
  onClose: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  appMode,
  mode,
  onChangeMode,
  themeId,
  onJump,
  onOpenLockdown,
  onOpenBookPicker,
  onExit,
  onExitBook,
  confirmExit,
  onClose,
}) => (
  <>
    <Text style={styles.title}>Ava's App</Text>
    <Text style={styles.tagline}>Made just for Ava</Text>

    {appMode === 'book' && (
      <Pressable style={styles.exitBook} onPress={onExitBook}>
        <Text style={styles.exitBookText}>Exit book</Text>
      </Pressable>
    )}

    <Text style={styles.label}>Audio</Text>
    <View style={styles.row}>
      {(['silent', 'gentle', 'music', 'full'] as AudioMode[]).map((m) => (
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
          style={[styles.themeBtn, themeId === t.id && styles.themeBtnActive]}
          onPress={() => onJump(t.id)}
        >
          <Text style={styles.radioText}>{t.name}</Text>
        </Pressable>
      ))}
    </View>

    {appMode === 'play' && (
      <Pressable style={styles.booksButton} onPress={onOpenBookPicker}>
        <Text style={styles.booksButtonText}>Read a book to Ava</Text>
        <Text style={styles.booksButtonSubtitle}>Pick a story and a family voice</Text>
      </Pressable>
    )}

    <Pressable style={styles.lockdownButton} onPress={onOpenLockdown}>
      <Text style={styles.lockdownButtonText}>Lock the phone for Ava</Text>
      <Text style={styles.lockdownButtonSubtitle}>
        Pin this app so she can't escape
      </Text>
    </Pressable>

    <Pressable style={styles.exit} onPress={onExit}>
      <Text style={styles.exitText}>
        {confirmExit ? 'Tap again to exit' : 'Exit app'}
      </Text>
    </Pressable>

    <Pressable style={styles.close} onPress={onClose}>
      <Text style={styles.closeText}>Close</Text>
    </Pressable>
  </>
);

interface LockdownViewProps {
  shownPlatform: LockdownPlatform;
  onChangePlatform: (p: LockdownPlatform) => void;
  onBack: () => void;
}

const LockdownView: React.FC<LockdownViewProps> = ({
  shownPlatform,
  onChangePlatform,
  onBack,
}) => {
  const steps = shownPlatform === 'android' ? ANDROID_STEPS : IOS_STEPS;
  const featureName =
    shownPlatform === 'android' ? 'App Pinning' : 'Guided Access';

  return (
    <>
      <Text style={styles.title}>Lock the phone</Text>
      <Text style={styles.tagline}>
        {featureName} stops Ava from leaving this app
      </Text>

      <View style={styles.row}>
        <Pressable
          style={[
            styles.platformBtn,
            shownPlatform === 'android' && styles.platformBtnActive,
          ]}
          onPress={() => onChangePlatform('android')}
        >
          <Text style={styles.radioText}>Android</Text>
        </Pressable>
        <Pressable
          style={[
            styles.platformBtn,
            shownPlatform === 'ios' && styles.platformBtnActive,
          ]}
          onPress={() => onChangePlatform('ios')}
        >
          <Text style={styles.radioText}>iOS</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.steps} contentContainerStyle={styles.stepsContent}>
        {steps.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </ScrollView>

      <Pressable style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>← Back to settings</Text>
      </Pressable>
    </>
  );
};

interface BookPickerViewProps {
  onPick: (bookId: string) => void;
  onBack: () => void;
}

const BookPickerView: React.FC<BookPickerViewProps> = ({ onPick, onBack }) => (
  <>
    <Text style={styles.title}>Pick a book</Text>
    <Text style={styles.tagline}>
      {REGISTRY.titles.length === 0
        ? 'No books yet. Add one with the book import tool.'
        : 'Tap a book, then pick a reader.'}
    </Text>

    <ScrollView style={styles.steps} contentContainerStyle={styles.stepsContent}>
      {REGISTRY.titles.map((t) => {
        const readings = REGISTRY.readingsByTitleId[t.id] ?? [];
        return (
          <Pressable key={t.id} style={styles.bookRow} onPress={() => onPick(t.id)}>
            <Text style={styles.bookRowTitle}>{t.displayName}</Text>
            <Text style={styles.bookRowReaders}>
              {readings.length} {readings.length === 1 ? 'reader' : 'readers'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>

    <Pressable style={styles.back} onPress={onBack}>
      <Text style={styles.backText}>← Back to settings</Text>
    </Pressable>
  </>
);

interface ReaderPickerViewProps {
  bookId: string;
  onPick: (bookId: string, readerId: string) => void;
  onBack: () => void;
}

const ReaderPickerView: React.FC<ReaderPickerViewProps> = ({ bookId, onPick, onBack }) => {
  const title = REGISTRY.titles.find((t) => t.id === bookId);
  const readings = REGISTRY.readingsByTitleId[bookId] ?? [];

  if (!title) {
    return (
      <>
        <Text style={styles.title}>Book missing</Text>
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </>
    );
  }

  return (
    <>
      <Text style={styles.title}>{title.displayName}</Text>
      <Text style={styles.tagline}>Pick a reader</Text>

      <ScrollView style={styles.steps} contentContainerStyle={styles.stepsContent}>
        {readings.map((r) => (
          <Pressable key={r.id} style={styles.bookRow} onPress={() => onPick(bookId, r.id)}>
            <Text style={styles.bookRowTitle}>{r.reader}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>← Back to books</Text>
      </Pressable>
    </>
  );
};

const styles = StyleSheet.create({
  hotspot: {
    position: 'absolute',
    width: 120,
    height: 120,
    backgroundColor: 'transparent',
  },
  hotspotPortrait: { left: 0, top: 0 },
  hotspotLandscape: { left: 0, bottom: 0 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: 340,
    maxHeight: '85%',
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
  platformBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2c2c2e',
    marginTop: 8,
  },
  platformBtnActive: { backgroundColor: '#0a84ff' },
  lockdownButton: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#1f3a4f',
    borderWidth: 1,
    borderColor: '#2f5a78',
  },
  lockdownButtonText: { color: '#7ec8ff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  lockdownButtonSubtitle: { color: '#9fc7e0', fontSize: 12, textAlign: 'center', marginTop: 2 },
  exitBook: {
    marginBottom: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#3a1c1c',
    borderWidth: 1,
    borderColor: '#5a2c2c',
  },
  exitBookText: { color: '#ff453a', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  booksButton: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#1f3f2a',
    borderWidth: 1,
    borderColor: '#2f5a3a',
  },
  booksButtonText: { color: '#8ee0a7', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  booksButtonSubtitle: { color: '#9fd0a8', fontSize: 12, textAlign: 'center', marginTop: 2 },
  bookRow: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#2c2c2e',
    marginBottom: 8,
  },
  bookRowTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bookRowReaders: { color: '#aaa', fontSize: 12, marginTop: 2 },
  steps: { marginTop: 14, maxHeight: 360 },
  stepsContent: { paddingBottom: 8 },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stepText: { color: '#eee', fontSize: 14, lineHeight: 20, flex: 1 },
  back: {
    marginTop: 10,
    padding: 10,
  },
  backText: { color: '#7ec8ff', textAlign: 'center', fontSize: 14 },
  exit: { marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: '#3a1c1c' },
  exitText: { color: '#ff453a', textAlign: 'center' },
  close: { marginTop: 8, padding: 10 },
  closeText: { color: '#999', textAlign: 'center' },
});
