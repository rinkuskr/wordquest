import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyChallengeRecord } from '../src/types/game';
import {
  createDailyChallenge,
  dailyRecordToSummary,
  getDailyChallengeDefinition,
  getUtcDateKey,
  isUtcDateKey,
} from '../src/engine/dailyChallenge';
import { validatePuzzle } from '../src/engine/gameEngine';

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

const HISTORY_KEY = 'wordquest:daily:v1';
const BACKUP_KEY = `${HISTORY_KEY}:recovery-backup`;
let persistence: typeof import('../src/services/dailyChallengePersistence');

beforeEach(async () => {
  storage.values.clear();
  storage.rejectReads = false;
  storage.rejectWrites = false;
  storage.activeWrites = 0;
  storage.maxActiveWrites = 0;
  vi.clearAllMocks();
  vi.resetModules();
  persistence = await import('../src/services/dailyChallengePersistence');
});

describe('deterministic daily challenge generation', () => {
  it('generates an identical category, word list, grid, and placement for the same UTC date', () => {
    const first = createDailyChallenge('2026-11-03');
    const reopened = createDailyChallenge('2026-11-03');

    expect(reopened).toEqual(first);
    expect(first.dateKey).toBe('2026-11-03');
    expect(first.puzzle.words).toEqual(first.targetWords);
    expect(() => validatePuzzle(first.puzzle)).not.toThrow();
  });

  it('keeps 100 daily-date identities deterministic and playable', () => {
    const identities = new Set<string>();
    const seeds = new Set<number>();

    for (let offset = 0; offset < 100; offset += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + offset, 12));
      const first = createDailyChallenge(date);
      const second = createDailyChallenge(date);

      expect(second).toEqual(first);
      expect(isUtcDateKey(first.dateKey)).toBe(true);
      expect(() => validatePuzzle(first.puzzle)).not.toThrow();
      identities.add(first.dateKey);
      seeds.add(first.seed);
    }

    expect(identities.size).toBe(100);
    expect(seeds.size).toBe(100);
  });

  it('uses UTC date boundaries regardless of local timezone', () => {
    expect(getUtcDateKey(new Date('2026-11-03T23:59:59.999Z'))).toBe('2026-11-03');
    expect(getUtcDateKey(new Date('2026-11-04T00:00:00.000Z'))).toBe('2026-11-04');
    expect(getDailyChallengeDefinition('2026-11-03').dateKey)
      .not.toBe(getDailyChallengeDefinition('2026-11-04').dateKey);
  });

  it('restores a completed daily result without coins or category rewards', () => {
    const record: DailyChallengeRecord = {
      dateKey: '2026-11-03',
      categoryId: 'animals',
      bestScore: 140,
      completionTimeSeconds: 87,
      wordsFound: 8,
      totalWords: 8,
    };

    expect(dailyRecordToSummary(record)).toMatchObject({
      categoryId: 'animals',
      mode: 'time',
      score: 140,
      wordsFound: 8,
      totalWords: 8,
      elapsedSeconds: 87,
      earnedCoins: 0,
      completed: true,
      newCategoryReward: false,
      dailyChallenge: {
        dateKey: '2026-11-03',
        isPersonalBest: true,
        bestScore: 140,
      },
    });
  });
});

describe('safe local daily history', () => {
  const attempt: DailyChallengeRecord = {
    dateKey: '2026-11-03',
    categoryId: 'animals',
    bestScore: 100,
    completionTimeSeconds: 90,
    wordsFound: 8,
    totalWords: 8,
  };

  it('records one result per UTC date and updates only the best score', async () => {
    await persistence.loadDailyHistory();

    const first = await persistence.recordDailyCompletion(attempt);
    const lower = await persistence.recordDailyCompletion({
      ...attempt,
      bestScore: 80,
      completionTimeSeconds: 75,
    });
    const higher = await persistence.recordDailyCompletion({
      ...attempt,
      bestScore: 130,
      completionTimeSeconds: 70,
    });

    expect(first.isPersonalBest).toBe(true);
    expect(lower.isPersonalBest).toBe(false);
    expect(higher.isPersonalBest).toBe(true);
    expect(higher.history.records).toHaveLength(1);
    expect(higher.record).toMatchObject({ bestScore: 130, completionTimeSeconds: 70 });
  });

  it('restores saved challenge results after reloading the persistence service', async () => {
    await persistence.loadDailyHistory();
    await persistence.recordDailyCompletion(attempt);
    vi.resetModules();
    persistence = await import('../src/services/dailyChallengePersistence');

    const restored = await persistence.loadDailyHistory();
    expect(restored).toMatchObject({
      status: 'loaded',
      history: { version: 1, records: [attempt] },
    });
    if (restored.status !== 'loaded') throw new Error('Expected daily history to reload.');
    expect(dailyRecordToSummary(restored.history.records[0])).toMatchObject({
      dailyChallenge: { dateKey: attempt.dateKey, bestScore: attempt.bestScore },
      score: attempt.bestScore,
      elapsedSeconds: attempt.completionTimeSeconds,
    });
  });

  it('does not write after a temporary read failure and retries without replacing history', async () => {
    const existing = JSON.stringify({ version: 1, records: [attempt] });
    storage.values.set(HISTORY_KEY, existing);
    storage.rejectReads = true;

    await expect(persistence.loadDailyHistory()).resolves.toMatchObject({ status: 'read-error' });
    await expect(persistence.recordDailyCompletion(attempt)).rejects.toThrow(/not been safely loaded/);
    expect(storage.values.get(HISTORY_KEY)).toBe(existing);
    expect(storage.setItem).not.toHaveBeenCalled();

    storage.rejectReads = false;
    await expect(persistence.loadDailyHistory()).resolves.toMatchObject({
      status: 'loaded',
      history: { records: [attempt] },
    });
  });

  it('keeps existing daily history unchanged when a write fails', async () => {
    const existingRecord = { ...attempt, bestScore: 120 };
    const existing = JSON.stringify({ version: 1, records: [existingRecord] });
    storage.values.set(HISTORY_KEY, existing);
    await persistence.loadDailyHistory();
    storage.rejectWrites = true;

    await expect(persistence.recordDailyCompletion({
      ...attempt,
      bestScore: 200,
    })).rejects.toThrow('simulated write failure');
    expect(storage.values.get(HISTORY_KEY)).toBe(existing);
  });

  it('preserves malformed JSON and requires an explicit fresh-history choice', async () => {
    const malformed = '{"version":1,';
    storage.values.set(HISTORY_KEY, malformed);

    const result = await persistence.loadDailyHistory();
    expect(result).toMatchObject({
      status: 'recovery-required',
      reason: 'malformed-json',
      backupSaved: true,
    });
    expect(storage.values.get(HISTORY_KEY)).toBe(malformed);
    expect(JSON.parse(storage.values.get(BACKUP_KEY) ?? '[]')).toContain(malformed);
    await expect(persistence.recordDailyCompletion(attempt)).rejects.toThrow(/not been safely loaded/);
    expect(storage.values.get(HISTORY_KEY)).toBe(malformed);

    await persistence.startFreshDailyHistory();
    expect(storage.values.get(HISTORY_KEY)).toBe(JSON.stringify({ version: 1, records: [] }));
    expect(JSON.parse(storage.values.get(BACKUP_KEY) ?? '[]')).toContain(malformed);
  });

  it('backs up invalid values and only restores valid entries after explicit approval', async () => {
    const validRecord = { ...attempt };
    const raw = JSON.stringify({
      version: 2,
      records: [validRecord, { ...attempt, dateKey: 'not-a-date' }],
    });
    storage.values.set(HISTORY_KEY, raw);

    const result = await persistence.loadDailyHistory();
    expect(result).toMatchObject({
      status: 'recovery-required',
      reason: 'invalid-values',
      backupSaved: true,
      recoveredHistory: { version: 1, records: [validRecord] },
    });
    expect(storage.values.get(HISTORY_KEY)).toBe(raw);

    await persistence.acceptRecoveredDailyHistory();
    expect(storage.values.get(HISTORY_KEY)).toBe(JSON.stringify({ version: 1, records: [validRecord] }));
    expect(JSON.parse(storage.values.get(BACKUP_KEY) ?? '[]')).toContain(raw);
  });

  it('does not offer destructive recovery when the original history backup fails', async () => {
    const malformed = '{"records":';
    storage.values.set(HISTORY_KEY, malformed);
    storage.rejectWrites = true;

    await expect(persistence.loadDailyHistory()).resolves.toMatchObject({
      status: 'recovery-required',
      reason: 'malformed-json',
      backupSaved: false,
    });
    await expect(persistence.startFreshDailyHistory()).rejects.toThrow(/until the original data is backed up/);
    expect(storage.values.get(HISTORY_KEY)).toBe(malformed);
  });

  it('serializes overlapping daily history writes', async () => {
    await persistence.loadDailyHistory();
    await Promise.all([
      persistence.recordDailyCompletion(attempt),
      persistence.recordDailyCompletion({ ...attempt, bestScore: 140 }),
    ]);

    expect(storage.maxActiveWrites).toBe(1);
    expect(JSON.parse(storage.values.get(HISTORY_KEY) ?? '{}').records).toHaveLength(1);
  });
});
