import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BONUS_WORDS } from '../src/data/bonusWords';
import type { DailyActiveRunSnapshot, DailyChallengeRecord } from '../src/types/game';
import {
  createDailyChallenge,
  DAILY_CHALLENGE_VERSION,
  dailyRecordToSummary,
  getDailyChallengeDefinition,
  getUtcDateKey,
  hasDailyCompletionForDate,
  isUtcDateKey,
  validateDailyRunSnapshot,
} from '../src/engine/dailyChallenge';
import { resolveWordSelection, scoreSelection, validatePuzzle } from '../src/engine/gameEngine';
import { elapsedMilliseconds } from '../src/engine/gameClock';

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
const RUN_KEY = 'wordquest:daily-run:v1';
const RUN_BACKUP_KEY = `${RUN_KEY}:recovery-backup`;
let persistence: typeof import('../src/services/dailyChallengePersistence');
let runPersistence: typeof import('../src/services/dailyRunPersistence');

beforeEach(async () => {
  storage.values.clear();
  storage.rejectReads = false;
  storage.rejectWrites = false;
  storage.activeWrites = 0;
  storage.maxActiveWrites = 0;
  vi.clearAllMocks();
  vi.resetModules();
  persistence = await import('../src/services/dailyChallengePersistence');
  runPersistence = await import('../src/services/dailyRunPersistence');
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

function makeDailyRunSnapshot(
  dateKey = '2026-11-03',
  overrides: Partial<DailyActiveRunSnapshot> = {},
): DailyActiveRunSnapshot {
  const challenge = createDailyChallenge(dateKey);
  const foundWords = [challenge.puzzle.words[0]];
  return {
    version: 1,
    challengeVersion: DAILY_CHALLENGE_VERSION,
    appVersion: '1.0.0',
    dateKey,
    categoryId: challenge.categoryId,
    seed: challenge.seed,
    gridSize: challenge.gridSize,
    timeLimitSeconds: challenge.timeLimitSeconds,
    foundWords,
    bonusWords: [],
    score: foundWords.length * scoreSelection('puzzle'),
    hintsLeft: 2,
    elapsedMs: 12_500,
    status: 'in-progress',
    ...overrides,
  };
}

describe('daily active-run restoration', () => {
  it('reconstructs the exact deterministic puzzle and restores words, score, hints, and elapsed time', () => {
    const saved = makeDailyRunSnapshot();
    const result = validateDailyRunSnapshot(saved, saved.dateKey, '1.0.0');

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') throw new Error('Expected a valid saved run.');
    expect(result.challenge).toEqual(createDailyChallenge(saved.dateKey));
    expect(result.foundWords).toEqual(saved.foundWords);
    expect(result.score).toBe(saved.score);
    expect(result.hintsLeft).toBe(saved.hintsLeft);
    expect(result.elapsedMs).toBe(saved.elapsedMs);
    expect(result.challenge.puzzle.words).toEqual(result.challenge.targetWords);
    expect(Object.keys(saved)).not.toContain('grid');
    expect(Object.keys(saved)).not.toContain('runningSince');
    expect(resolveWordSelection(
      saved.foundWords[0],
      result.challenge.puzzle.words,
      result.foundWords,
      result.bonusWords,
      BONUS_WORDS,
    ).kind).toBe('duplicate');
  });

  it('restores bonus words and rejects duplicate scoring or an arbitrary saved score', () => {
    const base = makeDailyRunSnapshot();
    const bonusWord = Array.from(BONUS_WORDS).find(
      (word) => !createDailyChallenge(base.dateKey).puzzle.words.includes(word),
    );
    expect(bonusWord).toBeTruthy();
    const withBonus = {
      ...base,
      bonusWords: [bonusWord!],
      score: base.score + scoreSelection('bonus'),
    };
    const restored = validateDailyRunSnapshot(withBonus, base.dateKey, base.appVersion);
    expect(restored.status).toBe('valid');
    if (restored.status !== 'valid') throw new Error('Expected bonus state to restore.');
    expect(restored.bonusWords).toEqual([bonusWord]);

    expect(validateDailyRunSnapshot({
      ...base,
      foundWords: [base.foundWords[0], base.foundWords[0]],
      score: base.score * 2,
    }, base.dateKey, base.appVersion)).toMatchObject({ status: 'invalid', reason: 'words' });
    expect(validateDailyRunSnapshot({
      ...base,
      score: base.score + 1,
    }, base.dateKey, base.appVersion)).toMatchObject({ status: 'invalid', reason: 'score' });
  });

  it('rejects wrong-date, app-version, challenge-version, and configuration snapshots', () => {
    const saved = makeDailyRunSnapshot();
    expect(validateDailyRunSnapshot(saved, '2026-11-04', saved.appVersion))
      .toMatchObject({ status: 'expired', reason: 'date' });
    expect(validateDailyRunSnapshot(saved, saved.dateKey, '1.0.1'))
      .toMatchObject({ status: 'incompatible', reason: 'app-version' });
    expect(validateDailyRunSnapshot({
      ...saved,
      challengeVersion: DAILY_CHALLENGE_VERSION + 1,
    }, saved.dateKey, saved.appVersion))
      .toMatchObject({ status: 'incompatible', reason: 'challenge-version' });
    expect(validateDailyRunSnapshot({
      ...saved,
      seed: saved.seed + 1,
    }, saved.dateKey, saved.appVersion))
      .toMatchObject({ status: 'incompatible', reason: 'challenge-config' });
    expect(validateDailyRunSnapshot({
      ...saved,
      elapsedMs: saved.timeLimitSeconds * 1000,
    }, saved.dateKey, saved.appVersion))
      .toMatchObject({ status: 'expired', reason: 'time-limit' });
  });

  it('lets completed history take precedence over an active snapshot for that date', () => {
    const saved = makeDailyRunSnapshot();
    const completedRecord: DailyChallengeRecord = {
      dateKey: saved.dateKey,
      categoryId: saved.categoryId,
      bestScore: 100,
      completionTimeSeconds: 50,
      wordsFound: 8,
      totalWords: 8,
    };
    expect(hasDailyCompletionForDate([completedRecord], saved.dateKey)).toBe(true);
    expect(hasDailyCompletionForDate([], saved.dateKey)).toBe(false);
  });

  it('restores paused elapsed time without charging time between app sessions', () => {
    const pausedElapsed = elapsedMilliseconds(7_000, 10_000, 15_500);
    const saved = makeDailyRunSnapshot('2026-11-03', { elapsedMs: pausedElapsed });
    const result = validateDailyRunSnapshot(saved, saved.dateKey, saved.appVersion);
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') throw new Error('Expected paused run to restore.');

    const stillPausedAfterRestart = elapsedMilliseconds(result.elapsedMs, null, 900_000);
    expect(stillPausedAfterRestart).toBe(pausedElapsed);
    expect(elapsedMilliseconds(stillPausedAfterRestart, 900_000, 902_000)).toBe(pausedElapsed + 2_000);
  });
});

describe('safe daily active-run storage', () => {
  it('loads an absent run and saves/restores the versioned snapshot', async () => {
    await expect(runPersistence.loadDailyRun()).resolves.toEqual({ status: 'loaded', snapshot: null });
    const saved = makeDailyRunSnapshot();
    await runPersistence.saveDailyRun(saved);
    expect(storage.values.get(RUN_KEY)).toBe(JSON.stringify(saved));

    vi.resetModules();
    runPersistence = await import('../src/services/dailyRunPersistence');
    await expect(runPersistence.loadDailyRun()).resolves.toEqual({ status: 'loaded', snapshot: saved });
  });

  it('does not treat a temporary read failure as an empty run or overwrite the stored attempt', async () => {
    const saved = makeDailyRunSnapshot();
    const original = JSON.stringify(saved);
    storage.values.set(RUN_KEY, original);
    storage.rejectReads = true;

    await expect(runPersistence.loadDailyRun()).resolves.toMatchObject({ status: 'read-error' });
    await expect(runPersistence.saveDailyRun(saved)).rejects.toThrow(/not been safely loaded/);
    expect(storage.values.get(RUN_KEY)).toBe(original);
    expect(storage.setItem).not.toHaveBeenCalled();

    storage.rejectReads = false;
    await expect(runPersistence.loadDailyRun()).resolves.toEqual({ status: 'loaded', snapshot: saved });
  });

  it('keeps the last valid run unchanged when an update write fails', async () => {
    const saved = makeDailyRunSnapshot();
    const original = JSON.stringify(saved);
    storage.values.set(RUN_KEY, original);
    await runPersistence.loadDailyRun();
    storage.rejectWrites = true;

    await expect(runPersistence.saveDailyRun({ ...saved, elapsedMs: saved.elapsedMs + 1_000 }))
      .rejects.toThrow('simulated write failure');
    expect(storage.values.get(RUN_KEY)).toBe(original);
  });

  it('backs up malformed JSON before explicit discard', async () => {
    const malformed = '{"version":1,';
    storage.values.set(RUN_KEY, malformed);

    const result = await runPersistence.loadDailyRun();
    expect(result).toMatchObject({ status: 'recovery-required', backupSaved: true });
    expect(storage.values.get(RUN_KEY)).toBe(malformed);
    expect(JSON.parse(storage.values.get(RUN_BACKUP_KEY) ?? '[]')).toContain(malformed);

    await runPersistence.discardRecoveredDailyRun();
    expect(storage.values.get(RUN_KEY)).toBe('null');
    expect(JSON.parse(storage.values.get(RUN_BACKUP_KEY) ?? '[]')).toContain(malformed);
  });

  it('backs up structurally invalid saved values without replacing the original', async () => {
    const invalid = {
      ...makeDailyRunSnapshot(),
      hintsLeft: 9,
    };
    const raw = JSON.stringify(invalid);
    storage.values.set(RUN_KEY, raw);

    await expect(runPersistence.loadDailyRun()).resolves.toMatchObject({
      status: 'recovery-required',
      backupSaved: true,
    });
    expect(storage.values.get(RUN_KEY)).toBe(raw);
    expect(JSON.parse(storage.values.get(RUN_BACKUP_KEY) ?? '[]')).toContain(raw);
  });

  it('preserves corrupt data if the backup cannot be saved', async () => {
    const malformed = '{"foundWords":';
    storage.values.set(RUN_KEY, malformed);
    storage.rejectWrites = true;

    await expect(runPersistence.loadDailyRun()).resolves.toMatchObject({
      status: 'recovery-required',
      backupSaved: false,
    });
    await expect(runPersistence.discardRecoveredDailyRun()).rejects.toThrow(/backed up/);
    expect(storage.values.get(RUN_KEY)).toBe(malformed);
  });

  it('serializes overlapping run writes so an older write cannot finish last', async () => {
    const first = makeDailyRunSnapshot();
    await runPersistence.loadDailyRun();
    await Promise.all([
      runPersistence.saveDailyRun(first),
      runPersistence.saveDailyRun({ ...first, elapsedMs: first.elapsedMs + 1_000 }),
    ]);

    expect(storage.maxActiveWrites).toBe(1);
    expect(JSON.parse(storage.values.get(RUN_KEY) ?? '{}').elapsedMs).toBe(first.elapsedMs + 1_000);
  });

  it('retains the active snapshot when saving the completed-history record fails', async () => {
    const saved = makeDailyRunSnapshot();
    await runPersistence.loadDailyRun();
    await runPersistence.saveDailyRun(saved);
    await persistence.loadDailyHistory();
    storage.rejectWrites = true;

    await expect(persistence.recordDailyCompletion({
      dateKey: saved.dateKey,
      categoryId: saved.categoryId,
      bestScore: 80,
      completionTimeSeconds: 50,
      wordsFound: 8,
      totalWords: 8,
    })).rejects.toThrow('simulated write failure');
    expect(storage.values.get(RUN_KEY)).toBe(JSON.stringify(saved));
  });
});
