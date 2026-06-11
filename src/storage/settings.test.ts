import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAudioMode, saveAudioMode } from './settings';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mocked = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('settings.audioMode', () => {
  beforeEach(() => jest.clearAllMocks());

  test('loadAudioMode returns "silent" when nothing stored', async () => {
    mocked.getItem.mockResolvedValueOnce(null);
    await expect(loadAudioMode()).resolves.toBe('silent');
  });

  test('loadAudioMode returns stored value when valid', async () => {
    mocked.getItem.mockResolvedValueOnce('full');
    await expect(loadAudioMode()).resolves.toBe('full');
  });

  test('loadAudioMode falls back to "silent" on corrupted value', async () => {
    mocked.getItem.mockResolvedValueOnce('garbage');
    await expect(loadAudioMode()).resolves.toBe('silent');
  });

  test('saveAudioMode writes to storage', async () => {
    await saveAudioMode('gentle');
    expect(mocked.setItem).toHaveBeenCalledWith('aviebaby.audioMode', 'gentle');
  });
});
