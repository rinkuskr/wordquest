import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedProgress } from '../src/types/game';

const storage = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    rejectReads: false,
    rejectWrites: false,
    activeWrites: 0,
    maxActiveWrites: 0,
    getItem: vi.fn(async (key: string) => {
      if (storage.rejectReads) throw new Error('simulated read failure');
      return values.get(key) ?? null;
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.activeWrites += 1;
      storage.maxActiveWrites = Math.max(storage.maxActiveWrites, storage.activeWrites);
      await Promise.resolve();
      storage.activeWrites -= 1;
      if (storage.rejectWrites) throw new Error('simulated write failure');
      values.set(key, value);
    }),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: storage.getItem,
    setItem: storage.setItem,
  },
}));

const SAVE_KEY = 'wordquest:progress:v1';
const BACKUP_KEY = `${SAVE_KEY}:recovery-backup`;
let persistence: typeof import('../src/services/persistence');

beforeEach(async () => {
  storage.values.clear();
  storage.rejectReads = false;
  storage.rejectWrites = false;
  storage.activeWrites = 0;
  storage.maxActiveWrites = 0;
  vi.clearAllMocks();
  vi.resetModules();
  persistence = await import('../src/services/persistence');
});

describe('non-destructive local progress persistence', () => {
  const saved: SavedProgress = {
    version: 1,
    coins: 350,
    completedLevels: ['animals'],
    soundEnabled: false,
  };

  it('loads valid progress successfully', async () => {
    storage.values.set(SAVE_KEY, JSON.stringify(saved));

    await expect(persistence.loadProgress()).resolves.toEqual({
      status: 'loaded',
      progress: saved,
    });
  });

  it('saves progress after storage has loaded successfully', async () => {
    await persistence.loadProgress();
    await persistence.saveProgress(saved);

    expect(storage.values.get(SAVE_KEY)).toBe(JSON.stringify(saved));
  });

  it('does not mark a failed storage read as loaded or overwrite existing data with defaults', async () => {
    const original = JSON.stringify(saved);
    storage.values.set(SAVE_KEY, original);
    storage.rejectReads = true;

    await expect(persistence.loadProgress()).resolves.toMatchObject({
      status: 'read-error',
    });
    await expect(persistence.saveProgress({
      version: 1,
      coins: 300,
      completedLevels: [],
      soundEnabled: true,
    })).rejects.toThrow(/not been safely loaded/);

    expect(storage.values.get(SAVE_KEY)).toBe(original);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('keeps existing progress unchanged when a save is rejected', async () => {
    const original = JSON.stringify(saved);
    storage.values.set(SAVE_KEY, original);
    await persistence.loadProgress();
    storage.rejectWrites = true;

    await expect(persistence.saveProgress({
      ...saved,
      coins: 400,
    })).rejects.toThrow('simulated write failure');

    expect(storage.values.get(SAVE_KEY)).toBe(original);
  });

  it('backs up malformed JSON and does not replace it automatically', async () => {
    const malformed = '{"coins":350,';
    storage.values.set(SAVE_KEY, malformed);

    const result = await persistence.loadProgress();
    expect(result).toMatchObject({
      status: 'recovery-required',
      reason: 'malformed-json',
      backupSaved: true,
    });
    expect(storage.values.get(SAVE_KEY)).toBe(malformed);
    expect(JSON.parse(storage.values.get(BACKUP_KEY) ?? '[]')).toContain(malformed);
    await expect(persistence.saveProgress(saved)).rejects.toThrow(/not been safely loaded/);
    expect(storage.values.get(SAVE_KEY)).toBe(malformed);
  });

  it('requires an explicit fresh-start choice and keeps the malformed source backup', async () => {
    const malformed = '{not-json';
    storage.values.set(SAVE_KEY, malformed);
    await persistence.loadProgress();

    await expect(persistence.startFreshProgress()).resolves.toEqual({
      version: 1,
      coins: 300,
      completedLevels: [],
      soundEnabled: true,
    });
    expect(storage.values.get(SAVE_KEY)).toBe(JSON.stringify({
      version: 1,
      coins: 300,
      completedLevels: [],
      soundEnabled: true,
    }));
    expect(JSON.parse(storage.values.get(BACKUP_KEY) ?? '[]')).toContain(malformed);
  });

  it('backs up invalid values and waits for explicit approval before applying normalized values', async () => {
    const invalidRaw = JSON.stringify({
      version: 1,
      coins: 'not-a-number',
      completedLevels: ['animals', 'unknown', 'animals'],
      soundEnabled: false,
    });
    storage.values.set(SAVE_KEY, invalidRaw);

    const result = await persistence.loadProgress();
    expect(result).toMatchObject({
      status: 'recovery-required',
      reason: 'invalid-values',
      backupSaved: true,
      recoveredProgress: {
        version: 1,
        coins: 300,
        completedLevels: ['animals'],
        soundEnabled: false,
      },
    });
    expect(storage.values.get(SAVE_KEY)).toBe(invalidRaw);

    await expect(persistence.acceptRecoveredProgress()).resolves.toEqual({
      version: 1,
      coins: 300,
      completedLevels: ['animals'],
      soundEnabled: false,
    });
    expect(storage.values.get(SAVE_KEY)).not.toBe(invalidRaw);
    expect(JSON.parse(storage.values.get(BACKUP_KEY) ?? '[]')).toContain(invalidRaw);
  });

  it('retries successfully after a temporary read failure without losing saved values', async () => {
    const original = JSON.stringify(saved);
    storage.values.set(SAVE_KEY, original);
    storage.rejectReads = true;
    await expect(persistence.loadProgress()).resolves.toMatchObject({ status: 'read-error' });

    storage.rejectReads = false;
    await expect(persistence.loadProgress()).resolves.toEqual({
      status: 'loaded',
      progress: saved,
    });

    expect(storage.values.get(SAVE_KEY)).toBe(original);
  });

  it('shares one in-flight load and serializes duplicate saves', async () => {
    const [firstLoad, secondLoad] = await Promise.all([
      persistence.loadProgress(),
      persistence.loadProgress(),
    ]);
    expect(firstLoad).toEqual(secondLoad);
    expect(storage.getItem).toHaveBeenCalledTimes(1);

    await Promise.all([
      persistence.saveProgress(saved),
      persistence.saveProgress(saved),
    ]);
    expect(storage.maxActiveWrites).toBe(1);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('does not allow replacing the original data when the backup cannot be saved', async () => {
    const malformed = '{"coins":';
    storage.values.set(SAVE_KEY, malformed);
    storage.rejectWrites = true;

    const result = await persistence.loadProgress();
    expect(result).toMatchObject({
      status: 'recovery-required',
      reason: 'malformed-json',
      backupSaved: false,
    });
    expect(storage.values.get(SAVE_KEY)).toBe(malformed);
    await expect(persistence.startFreshProgress()).rejects.toThrow(/original data is backed up/);
  });
});
