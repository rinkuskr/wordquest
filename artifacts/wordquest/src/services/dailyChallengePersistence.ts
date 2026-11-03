import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATEGORIES } from '@/src/data/categories';
import { isUtcDateKey } from '@/src/engine/dailyChallenge';
import type {
  CategoryId,
  DailyChallengeHistory,
  DailyChallengeRecord,
} from '@/src/types/game';

export const DAILY_HISTORY_KEY = 'wordquest:daily:v1';
export const DAILY_HISTORY_BACKUP_KEY = `${DAILY_HISTORY_KEY}:recovery-backup`;
export const INITIAL_DAILY_HISTORY: DailyChallengeHistory = { version: 1, records: [] };

export type DailyHistoryLoadResult =
  | { status: 'loaded'; history: DailyChallengeHistory }
  | { status: 'read-error'; message: string }
  | {
      status: 'recovery-required';
      reason: 'malformed-json' | 'invalid-values';
      message: string;
      backupSaved: boolean;
      recoveredHistory?: DailyChallengeHistory;
    };

type Access = 'unresolved' | 'loaded' | 'read-error' | 'recovery-required';
type Recovery = Extract<DailyHistoryLoadResult, { status: 'recovery-required' }>;

let access: Access = 'unresolved';
let pendingRecovery: Recovery | null = null;
let loadInFlight: Promise<DailyHistoryLoadResult> | null = null;
let operationQueue: Promise<void> = Promise.resolve();
let lastSavedSerialized: string | null = null;
let lastKnownHistory: DailyChallengeHistory = INITIAL_DAILY_HISTORY;

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isValidCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && CATEGORIES.some((category) => category.id === value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isValidDailyRecord(value: unknown): value is DailyChallengeRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = [
    'bestScore',
    'categoryId',
    'completionTimeSeconds',
    'dateKey',
    'totalWords',
    'wordsFound',
  ];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return false;
  return (
    isUtcDateKey(record.dateKey) &&
    isValidCategoryId(record.categoryId) &&
    isNonNegativeInteger(record.bestScore) &&
    isNonNegativeInteger(record.completionTimeSeconds) &&
    isNonNegativeInteger(record.wordsFound) &&
    isNonNegativeInteger(record.totalWords) &&
    record.totalWords > 0 &&
    record.wordsFound === record.totalWords
  );
}

export function isValidDailyHistory(value: unknown): value is DailyChallengeHistory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const history = value as Record<string, unknown>;
  const keys = Object.keys(history).sort();
  if (keys.length !== 2 || keys[0] !== 'records' || keys[1] !== 'version') return false;
  if (history.version !== 1 || !Array.isArray(history.records)) return false;
  const dates = new Set<string>();
  for (const record of history.records) {
    if (!isValidDailyRecord(record) || dates.has(record.dateKey)) return false;
    dates.add(record.dateKey);
  }
  return true;
}

function extractRecoverableHistory(value: unknown): DailyChallengeHistory | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const recordsValue = (value as Record<string, unknown>).records;
  if (!Array.isArray(recordsValue)) return undefined;
  const records: DailyChallengeRecord[] = [];
  const dates = new Set<string>();
  for (const record of recordsValue) {
    if (isValidDailyRecord(record) && !dates.has(record.dateKey)) {
      records.push(record);
      dates.add(record.dateKey);
    }
  }
  return {
    version: 1,
    records: records.sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
  };
}

async function preserveRawDailyHistory(raw: string): Promise<boolean> {
  try {
    const existing = await AsyncStorage.getItem(DAILY_HISTORY_BACKUP_KEY);
    let snapshots: string[] = [];
    if (existing !== null) {
      const parsed: unknown = JSON.parse(existing);
      if (!Array.isArray(parsed) || parsed.some((snapshot) => typeof snapshot !== 'string')) {
        return false;
      }
      snapshots = parsed;
    }
    if (!snapshots.includes(raw)) snapshots = [...snapshots, raw];
    await AsyncStorage.setItem(DAILY_HISTORY_BACKUP_KEY, JSON.stringify(snapshots));
    return true;
  } catch {
    return false;
  }
}

async function loadDailyHistoryFromStorage(): Promise<DailyHistoryLoadResult> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(DAILY_HISTORY_KEY);
  } catch {
    access = 'read-error';
    pendingRecovery = null;
    return {
      status: 'read-error',
      message: "Daily challenge history couldn't be read. Nothing was reset or overwritten. Check device storage and retry.",
    };
  }

  if (raw === null) {
    access = 'loaded';
    pendingRecovery = null;
    lastSavedSerialized = null;
    lastKnownHistory = INITIAL_DAILY_HISTORY;
    return { status: 'loaded', history: INITIAL_DAILY_HISTORY };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const backupSaved = await preserveRawDailyHistory(raw);
    const result: Recovery = {
      status: 'recovery-required',
      reason: 'malformed-json',
      backupSaved,
      message: backupSaved
        ? 'Daily challenge history could not be read. A copy of the original data was preserved on this device. Choose a recovery option to continue.'
        : 'Daily challenge history could not be read, and a safety copy could not be confirmed. Nothing was overwritten. Retry when storage is available.',
    };
    access = 'recovery-required';
    pendingRecovery = result;
    return result;
  }

  if (isValidDailyHistory(parsed)) {
    const history = {
      version: 1 as const,
      records: [...parsed.records].sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    };
    access = 'loaded';
    pendingRecovery = null;
    lastSavedSerialized = raw;
    lastKnownHistory = history;
    return { status: 'loaded', history };
  }

  const backupSaved = await preserveRawDailyHistory(raw);
  const recoveredHistory = backupSaved ? extractRecoverableHistory(parsed) : undefined;
  const result: Recovery = {
    status: 'recovery-required',
    reason: 'invalid-values',
    backupSaved,
    ...(recoveredHistory ? { recoveredHistory } : {}),
    message: backupSaved
      ? 'Some daily challenge history needs recovery. The original data was preserved. Restore the valid entries or explicitly start a new daily history.'
      : 'Daily challenge history contains invalid values, and a safety copy could not be confirmed. Nothing was overwritten. Retry when storage is available.',
  };
  access = 'recovery-required';
  pendingRecovery = result;
  return result;
}

export function loadDailyHistory(): Promise<DailyHistoryLoadResult> {
  if (loadInFlight) return loadInFlight;
  const queuedLoad = enqueue(loadDailyHistoryFromStorage);
  const sharedLoad = queuedLoad.finally(() => {
    if (loadInFlight === sharedLoad) loadInFlight = null;
  });
  loadInFlight = sharedLoad;
  return sharedLoad;
}

export async function recordDailyCompletion(
  attempt: DailyChallengeRecord,
): Promise<{ history: DailyChallengeHistory; record: DailyChallengeRecord; isPersonalBest: boolean }> {
  if (!isValidDailyRecord(attempt)) throw new Error('Daily challenge result is invalid.');
  return enqueue(async () => {
    if (access !== 'loaded') {
      throw new Error('Daily challenge history has not been safely loaded. Retry loading before saving.');
    }

    const existing = lastKnownHistory.records.find((record) => record.dateKey === attempt.dateKey);
    const isPersonalBest = !existing || attempt.bestScore > existing.bestScore;
    const record = isPersonalBest ? attempt : existing;
    const records = existing
      ? lastKnownHistory.records.map((item) => item.dateKey === attempt.dateKey ? record : item)
      : [...lastKnownHistory.records, record];
    const history: DailyChallengeHistory = {
      version: 1,
      records: records.sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    };
    const serialized = JSON.stringify(history);
    if (serialized !== lastSavedSerialized) {
      await AsyncStorage.setItem(DAILY_HISTORY_KEY, serialized);
      lastSavedSerialized = serialized;
    }
    lastKnownHistory = history;
    return { history, record, isPersonalBest };
  });
}

export async function acceptRecoveredDailyHistory(): Promise<DailyChallengeHistory> {
  return enqueue(async () => {
    if (
      access !== 'recovery-required' ||
      !pendingRecovery?.backupSaved ||
      !pendingRecovery.recoveredHistory
    ) {
      throw new Error('There is no safely backed-up daily history to restore.');
    }
    const history = pendingRecovery.recoveredHistory;
    const serialized = JSON.stringify(history);
    await AsyncStorage.setItem(DAILY_HISTORY_KEY, serialized);
    access = 'loaded';
    pendingRecovery = null;
    lastSavedSerialized = serialized;
    lastKnownHistory = history;
    return history;
  });
}

export async function startFreshDailyHistory(): Promise<DailyChallengeHistory> {
  return enqueue(async () => {
    if (access !== 'recovery-required' || !pendingRecovery?.backupSaved) {
      throw new Error('A new daily history is unavailable until the original data is backed up.');
    }
    const history = INITIAL_DAILY_HISTORY;
    const serialized = JSON.stringify(history);
    await AsyncStorage.setItem(DAILY_HISTORY_KEY, serialized);
    access = 'loaded';
    pendingRecovery = null;
    lastSavedSerialized = serialized;
    lastKnownHistory = history;
    return history;
  });
}
