import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedProgress } from '../src/types/game';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

import { loadProgress, saveProgress } from '../src/services/persistence';

describe('local progress persistence', () => {
  beforeEach(() => storage.clear());

  it('restores saved coins, completed categories, and sound setting after a reload', async () => {
    const saved: SavedProgress = {
      version: 1,
      coins: 350,
      completedLevels: ['animals'],
      soundEnabled: false,
    };

    await saveProgress(saved);

    // A second load models a fresh provider reading the same persistent store.
    await expect(loadProgress()).resolves.toEqual(saved);
  });

  it('starts with the default balance when the device has no saved progress', async () => {
    await expect(loadProgress()).resolves.toEqual({
      version: 1,
      coins: 300,
      completedLevels: [],
      soundEnabled: true,
    });
  });
});
