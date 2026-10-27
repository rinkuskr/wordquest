import AsyncStorage from '@react-native-async-storage/async-storage';
import { INITIAL_PROGRESS, normalizeProgress } from '@/src/engine/progression';
import type { SavedProgress } from '@/src/types/game';

const SAVE_KEY = 'wordquest:progress:v1';

export async function loadProgress(): Promise<SavedProgress> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    if (!raw) return { ...INITIAL_PROGRESS };
    return normalizeProgress(JSON.parse(raw) as unknown);
  } catch {
    return { ...INITIAL_PROGRESS };
  }
}

export async function saveProgress(progress: SavedProgress): Promise<void> {
  await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(progress));
}
