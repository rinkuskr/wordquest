import AsyncStorage from '@react-native-async-storage/async-storage';
import appConfig from '../../app.json';
import { CATEGORIES } from '@/src/data/categories';
import { isUtcDateKey } from '@/src/engine/dailyChallenge';
import type { CategoryId, DailyActiveRunSnapshot } from '@/src/types/game';

export const DAILY_RUN_KEY = 'wordquest:daily-run:v1';
export const DAILY_RUN_BACKUP_KEY = `${DAILY_RUN_KEY}:recovery-backup`;
export const DAILY_RUN_APP_VERSION = appConfig.expo.version;

export type DailyRunLoadResult =
  | { status: 'loaded'; snapshot: DailyActiveRunSnapshot | null }
  | { status: 'read-error'; message: string }
  | { status: 'recovery-required'; message: string; backupSaved: boolean };

type Access = 'unresolved' | 'loaded' | 'read-error' | 'recovery-required';

let access: Access = 'unresolved';
let pendingRecovery: Extract<DailyRunLoadResult, { status: 'recovery-required' }> | null = null;
let loadInFlight: Promise<DailyRunLoadResult> | null = null;
let operationQueue: Promise<void> = Promise.resolve();
let lastSavedSerialized: string | null = null;
let lastRawSnapshot: string | null = null;

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && CATEGORIES.some((category) => category.id === value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isDailyActiveRunSnapshot(value: unknown): value is DailyActiveRunSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  const keys = Object.keys(snapshot).sort();
  const expected = [
    'appVersion',
    'bonusWords',
    'categoryId',
    'challengeVersion',
    'dateKey',
    'elapsedMs',
    'foundWords',
    'gridSize',
    'hintsLeft',
    'score',
    'seed',
    'status',
    'timeLimitSeconds',
    'version',
  ];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return false;
  return (
    snapshot.version === 1 &&
    Number.isInteger(snapshot.challengeVersion) &&
    typeof snapshot.appVersion === 'string' &&
    isUtcDateKey(snapshot.dateKey) &&
    isCategoryId(snapshot.categoryId) &&
    Number.isSafeInteger(snapshot.seed) &&
    [8, 10, 12].includes(snapshot.gridSize as number) &&
    Number.isInteger(snapshot.timeLimitSeconds) &&
    (snapshot.timeLimitSeconds as number) > 0 &&
    isStringArray(snapshot.foundWords) &&
    isStringArray(snapshot.bonusWords) &&
    Number.isSafeInteger(snapshot.score) &&
    (snapshot.score as number) >= 0 &&
    Number.isInteger(snapshot.hintsLeft) &&
    (snapshot.hintsLeft as number) >= 0 &&
    (snapshot.hintsLeft as number) <= 3 &&
    typeof snapshot.elapsedMs === 'number' &&
    Number.isFinite(snapshot.elapsedMs) &&
    snapshot.elapsedMs >= 0 &&
    snapshot.status === 'in-progress'
  );
}

async function preserveRawSnapshot(raw: string): Promise<boolean> {
  try {
    const existing = await AsyncStorage.getItem(DAILY_RUN_BACKUP_KEY);
    let snapshots: string[] = [];
    if (existing !== null) {
      const parsed: unknown = JSON.parse(existing);
      if (!Array.isArray(parsed) || parsed.some((snapshot) => typeof snapshot !== 'string')) {
        return false;
      }
      snapshots = parsed;
    }
    if (!snapshots.includes(raw)) snapshots = [...snapshots, raw];
    await AsyncStorage.setItem(DAILY_RUN_BACKUP_KEY, JSON.stringify(snapshots));
    return true;
  } catch {
    return false;
  }
}

async function loadDailyRunFromStorage(): Promise<DailyRunLoadResult> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(DAILY_RUN_KEY);
  } catch {
    access = 'read-error';
    pendingRecovery = null;
    lastRawSnapshot = null;
    return {
      status: 'read-error',
      message: "Your saved Daily Challenge attempt couldn't be read. Nothing was reset or overwritten. Retry before starting another attempt.",
    };
  }

  if (raw === null) {
    access = 'loaded';
    pendingRecovery = null;
    lastSavedSerialized = null;
    lastRawSnapshot = null;
    return { status: 'loaded', snapshot: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const backupSaved = await preserveRawSnapshot(raw);
    const result = {
      status: 'recovery-required' as const,
      backupSaved,
      message: backupSaved
        ? 'The saved Daily Challenge attempt is damaged. Its original data was backed up; discard it explicitly to start again.'
        : 'The saved attempt is damaged, but a safety copy could not be confirmed. Nothing was overwritten. Retry recovery.',
    };
    access = 'recovery-required';
    pendingRecovery = result;
    lastRawSnapshot = raw;
    return result;
  }

  if (parsed === null) {
    access = 'loaded';
    pendingRecovery = null;
    lastSavedSerialized = raw;
    lastRawSnapshot = raw;
    return { status: 'loaded', snapshot: null };
  }

  if (isDailyActiveRunSnapshot(parsed)) {
    access = 'loaded';
    pendingRecovery = null;
    lastSavedSerialized = raw;
    lastRawSnapshot = raw;
    return { status: 'loaded', snapshot: parsed };
  }

  const backupSaved = await preserveRawSnapshot(raw);
  const result = {
    status: 'recovery-required' as const,
    backupSaved,
    message: backupSaved
      ? 'The saved Daily Challenge attempt has invalid data. Its original snapshot was backed up; discard it explicitly to continue.'
      : 'The saved attempt has invalid data, but a safety copy could not be confirmed. Nothing was overwritten. Retry recovery.',
  };
  access = 'recovery-required';
  pendingRecovery = result;
  lastRawSnapshot = raw;
  return result;
}

export function loadDailyRun(): Promise<DailyRunLoadResult> {
  if (loadInFlight) return loadInFlight;
  const queuedLoad = enqueue(loadDailyRunFromStorage);
  const sharedLoad = queuedLoad.finally(() => {
    if (loadInFlight === sharedLoad) loadInFlight = null;
  });
  loadInFlight = sharedLoad;
  return sharedLoad;
}

export async function saveDailyRun(snapshot: DailyActiveRunSnapshot): Promise<void> {
  if (!isDailyActiveRunSnapshot(snapshot)) throw new Error('Daily Challenge attempt is invalid.');
  const serialized = JSON.stringify(snapshot);
  await enqueue(async () => {
    if (access !== 'loaded') {
      throw new Error('Daily Challenge attempt storage has not been safely loaded. Retry before saving.');
    }
    if (serialized === lastSavedSerialized) return;
    await AsyncStorage.setItem(DAILY_RUN_KEY, serialized);
    lastSavedSerialized = serialized;
    lastRawSnapshot = serialized;
  });
}

export async function clearDailyRun(): Promise<void> {
  await enqueue(async () => {
    if (access !== 'loaded') {
      throw new Error('Daily Challenge attempt storage has not been safely loaded. Retry before clearing.');
    }
    const serialized = 'null';
    if (serialized !== lastSavedSerialized) {
      await AsyncStorage.setItem(DAILY_RUN_KEY, serialized);
    }
    lastSavedSerialized = serialized;
    lastRawSnapshot = serialized;
  });
}

export async function clearDailyRunForDate(dateKey: string): Promise<void> {
  await enqueue(async () => {
    if (access !== 'loaded') {
      throw new Error('Daily Challenge attempt storage has not been safely loaded. Retry before clearing.');
    }
    if (!isUtcDateKey(dateKey)) {
      throw new Error('Daily Challenge cleanup date is invalid.');
    }

    const raw = await AsyncStorage.getItem(DAILY_RUN_KEY);
    if (raw === null || raw === 'null') {
      lastSavedSerialized = 'null';
      lastRawSnapshot = 'null';
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('The saved Daily Challenge attempt is not valid JSON and was preserved.');
    }
    if (!isDailyActiveRunSnapshot(parsed)) {
      throw new Error('The saved Daily Challenge attempt is invalid and was preserved.');
    }
    if (parsed.dateKey !== dateKey) {
      // A newer attempt replaced the stale snapshot while cleanup was pending.
      lastSavedSerialized = raw;
      lastRawSnapshot = raw;
      return;
    }

    await AsyncStorage.setItem(DAILY_RUN_KEY, 'null');
    lastSavedSerialized = 'null';
    lastRawSnapshot = 'null';
  });
}

export async function archiveAndClearDailyRun(): Promise<boolean> {
  return enqueue(async () => {
    if (access !== 'loaded') return false;
    if (lastRawSnapshot && lastRawSnapshot !== 'null') {
      const backupSaved = await preserveRawSnapshot(lastRawSnapshot);
      if (!backupSaved) return false;
    }
    try {
      await AsyncStorage.setItem(DAILY_RUN_KEY, 'null');
      lastSavedSerialized = 'null';
      lastRawSnapshot = 'null';
      return true;
    } catch {
      return false;
    }
  });
}

export async function discardRecoveredDailyRun(): Promise<void> {
  await enqueue(async () => {
    if (access !== 'recovery-required' || !pendingRecovery?.backupSaved) {
      throw new Error('The original attempt must be backed up before it can be discarded.');
    }
    await AsyncStorage.setItem(DAILY_RUN_KEY, 'null');
    access = 'loaded';
    pendingRecovery = null;
    lastSavedSerialized = 'null';
    lastRawSnapshot = 'null';
  });
}
