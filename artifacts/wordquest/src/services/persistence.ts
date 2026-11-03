import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATEGORIES } from '@/src/data/categories';
import { INITIAL_PROGRESS, normalizeProgress } from '@/src/engine/progression';
import type { SavedProgress } from '@/src/types/game';

const SAVE_KEY = 'wordquest:progress:v1';
export const RECOVERY_BACKUP_KEY = `${SAVE_KEY}:recovery-backup`;

export type ProgressLoadResult =
  | { status: 'loaded'; progress: SavedProgress }
  | { status: 'read-error'; message: string }
  | {
      status: 'recovery-required';
      reason: 'malformed-json' | 'invalid-values';
      message: string;
      backupSaved: boolean;
      recoveredProgress?: SavedProgress;
    };

type PersistenceAccess = 'unresolved' | 'loaded' | 'read-error' | 'recovery-required';

let access: PersistenceAccess = 'unresolved';
let pendingRecovery: Extract<ProgressLoadResult, { status: 'recovery-required' }> | null = null;
let loadInFlight: Promise<ProgressLoadResult> | null = null;
let operationQueue: Promise<void> = Promise.resolve();
let lastSavedSerialized: string | null = null;

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isValidStoredProgress(raw: unknown): raw is SavedProgress {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const value = raw as Record<string, unknown>;
  const expectedKeys = ['coins', 'completedLevels', 'soundEnabled', 'version'];
  const keys = Object.keys(value).sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    return false;
  }
  if (
    value.version !== 1 ||
    typeof value.coins !== 'number' ||
    !Number.isFinite(value.coins) ||
    !Number.isInteger(value.coins) ||
    value.coins < 0 ||
    typeof value.soundEnabled !== 'boolean' ||
    !Array.isArray(value.completedLevels) ||
    value.completedLevels.length > CATEGORIES.length
  ) {
    return false;
  }
  const validIds = new Set(CATEGORIES.map((category) => category.id));
  const completed = new Set<string>();
  for (const id of value.completedLevels) {
    if (typeof id !== 'string' || !validIds.has(id as SavedProgress['completedLevels'][number]) || completed.has(id)) {
      return false;
    }
    completed.add(id);
  }
  return true;
}

async function preserveRawProgress(raw: string): Promise<boolean> {
  try {
    const existing = await AsyncStorage.getItem(RECOVERY_BACKUP_KEY);
    let snapshots: string[] = [];
    if (existing !== null) {
      const parsed: unknown = JSON.parse(existing);
      if (!Array.isArray(parsed) || parsed.some((snapshot) => typeof snapshot !== 'string')) {
        return false;
      }
      snapshots = parsed;
    }
    if (!snapshots.includes(raw)) snapshots = [...snapshots, raw];
    await AsyncStorage.setItem(RECOVERY_BACKUP_KEY, JSON.stringify(snapshots));
    return true;
  } catch {
    return false;
  }
}

async function loadProgressFromStorage(): Promise<ProgressLoadResult> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(SAVE_KEY);
  } catch {
    access = 'read-error';
    pendingRecovery = null;
    return {
      status: 'read-error',
      message: "We couldn't read your saved progress. Nothing was reset or overwritten. Check device storage and retry.",
    };
  }

  if (raw === null) {
    access = 'loaded';
    pendingRecovery = null;
    lastSavedSerialized = null;
    return { status: 'loaded', progress: { ...INITIAL_PROGRESS } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const backupSaved = await preserveRawProgress(raw);
    const result: Extract<ProgressLoadResult, { status: 'recovery-required' }> = {
      status: 'recovery-required',
      reason: 'malformed-json',
      backupSaved,
      message: backupSaved
        ? "Your saved progress couldn't be read. A copy of the original data was preserved on this device. Retry, or explicitly start fresh."
        : "Your saved progress couldn't be read, and a safety copy could not be confirmed. Nothing was overwritten. Please retry.",
    };
    access = 'recovery-required';
    pendingRecovery = result;
    return result;
  }

  if (!isValidStoredProgress(parsed)) {
    const backupSaved = await preserveRawProgress(raw);
    const result: Extract<ProgressLoadResult, { status: 'recovery-required' }> = {
      status: 'recovery-required',
      reason: 'invalid-values',
      backupSaved,
      ...(backupSaved ? { recoveredProgress: normalizeProgress(parsed) } : {}),
      message: backupSaved
        ? "Some saved progress values need recovery. The original data was preserved. You can use the valid values with safe defaults for invalid fields, or explicitly start fresh."
        : "Some saved progress values are invalid, and a safety copy could not be confirmed. Nothing was overwritten. Please retry.",
    };
    access = 'recovery-required';
    pendingRecovery = result;
    return result;
  }

  const progress = parsed;
  access = 'loaded';
  pendingRecovery = null;
  lastSavedSerialized = raw;
  return { status: 'loaded', progress };
}

export function loadProgress(): Promise<ProgressLoadResult> {
  if (loadInFlight) return loadInFlight;
  const queuedLoad = enqueue(loadProgressFromStorage);
  const sharedLoad = queuedLoad.finally(() => {
    if (loadInFlight === sharedLoad) loadInFlight = null;
  });
  loadInFlight = sharedLoad;
  return sharedLoad;
}

export async function saveProgress(progress: SavedProgress): Promise<void> {
  const serialized = JSON.stringify(progress);
  await enqueue(async () => {
    if (access !== 'loaded') {
      throw new Error('Progress has not been safely loaded. Retry loading before saving.');
    }
    if (lastSavedSerialized === serialized) return;
    await AsyncStorage.setItem(SAVE_KEY, serialized);
    lastSavedSerialized = serialized;
  });
}

export async function acceptRecoveredProgress(): Promise<SavedProgress> {
  return enqueue(async () => {
    if (
      access !== 'recovery-required' ||
      !pendingRecovery?.backupSaved ||
      !pendingRecovery.recoveredProgress
    ) {
      throw new Error('There is no safely backed-up progress to recover.');
    }
    const recovered = pendingRecovery.recoveredProgress;
    const serialized = JSON.stringify(recovered);
    await AsyncStorage.setItem(SAVE_KEY, serialized);
    access = 'loaded';
    pendingRecovery = null;
    lastSavedSerialized = serialized;
    return recovered;
  });
}

export async function startFreshProgress(): Promise<SavedProgress> {
  return enqueue(async () => {
    if (access !== 'recovery-required' || !pendingRecovery?.backupSaved) {
      throw new Error('Fresh progress is unavailable until the original data is backed up.');
    }
    const fresh = { ...INITIAL_PROGRESS };
    const serialized = JSON.stringify(fresh);
    await AsyncStorage.setItem(SAVE_KEY, serialized);
    access = 'loaded';
    pendingRecovery = null;
    lastSavedSerialized = serialized;
    return fresh;
  });
}
