import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioMode } from '../themes/types';

const KEY_AUDIO_MODE = 'aviebaby.audioMode';
const VALID: ReadonlySet<AudioMode> = new Set(['silent', 'gentle', 'full']);

export async function loadAudioMode(): Promise<AudioMode> {
  const raw = await AsyncStorage.getItem(KEY_AUDIO_MODE);
  if (raw && VALID.has(raw as AudioMode)) return raw as AudioMode;
  return 'silent';
}

export async function saveAudioMode(mode: AudioMode): Promise<void> {
  await AsyncStorage.setItem(KEY_AUDIO_MODE, mode);
}
