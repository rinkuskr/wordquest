import { CATEGORIES, getCategory } from '@/src/data/categories';
import { BONUS_WORDS } from '@/src/data/bonusWords';
import { getCategoryPuzzlePlan } from '@/src/data/difficulty';
import { generatePuzzle, scoreSelection, seededRandom } from '@/src/engine/gameEngine';
import type {
  DailyActiveRunSnapshot,
  DailyChallengeRecord,
  GameSummary,
  Puzzle,
} from '@/src/types/game';

export const DAILY_CHALLENGE_VERSION = 1;

export interface DailyChallengeDefinition {
  dateKey: string;
  categoryId: DailyChallengeRecord['categoryId'];
  categoryName: string;
  seed: number;
  targetWords: string[];
  gridSize: 8 | 10 | 12;
  timeLimitSeconds: number;
  diagonalWordCount: number;
}

export interface DailyChallenge extends DailyChallengeDefinition {
  puzzle: Puzzle;
}

export type DailyRunValidation =
  | {
      status: 'valid';
      challenge: DailyChallenge;
      foundWords: string[];
      bonusWords: string[];
      score: number;
      hintsLeft: number;
      elapsedMs: number;
      isComplete: boolean;
    }
  | { status: 'expired'; reason: 'date' | 'time-limit' }
  | { status: 'incompatible'; reason: 'app-version' | 'challenge-version' | 'challenge-config' }
  | { status: 'invalid'; reason: 'snapshot' | 'words' | 'score' | 'hints' | 'elapsed-time' };

export function hasDailyCompletionForDate(
  records: readonly DailyChallengeRecord[],
  dateKey: string,
): boolean {
  return records.some((record) => record.dateKey === dateKey);
}

export function getUtcDateKey(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Daily challenge date is invalid.');
  return date.toISOString().slice(0, 10);
}

export function isUtcDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  } catch {
    return false;
  }
}

export function stableDailyHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getDailyChallengeDefinition(
  date: Date | string,
): DailyChallengeDefinition {
  const dateKey = typeof date === 'string' ? date : getUtcDateKey(date);
  if (!isUtcDateKey(dateKey)) {
    throw new Error('Daily challenge date must be a valid UTC date in YYYY-MM-DD format.');
  }

  const categoryHash = stableDailyHash(`wordquest-daily-category:v1:${dateKey}`);
  const layoutSeed = stableDailyHash(`wordquest-daily-layout:v1:${dateKey}`);
  const category = CATEGORIES[categoryHash % CATEGORIES.length];
  const plan = getCategoryPuzzlePlan(category);

  return {
    dateKey,
    categoryId: category.id,
    categoryName: category.name,
    seed: layoutSeed,
    targetWords: plan.targetWords,
    gridSize: plan.gridSize,
    timeLimitSeconds: plan.timeLimitSeconds,
    diagonalWordCount: plan.diagonalWordCount,
  };
}

export function createDailyChallenge(date: Date | string): DailyChallenge {
  const definition = getDailyChallengeDefinition(date);
  const puzzle = generatePuzzle(
    definition.targetWords,
    seededRandom(definition.seed),
    {
      gridSize: definition.gridSize,
      diagonalWordCount: definition.diagonalWordCount,
      allowReducedDiagonalFallback: true,
    },
  );
  return { ...definition, puzzle };
}

export function validateDailyRunSnapshot(
  value: unknown,
  currentDateKey: string,
  appVersion: string,
): DailyRunValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { status: 'invalid', reason: 'snapshot' };
  }
  const snapshot = value as Partial<DailyActiveRunSnapshot>;
  if (
    snapshot.version !== 1 ||
    snapshot.status !== 'in-progress' ||
    typeof snapshot.dateKey !== 'string' ||
    typeof snapshot.appVersion !== 'string' ||
    typeof snapshot.challengeVersion !== 'number' ||
    !Array.isArray(snapshot.foundWords) ||
    !Array.isArray(snapshot.bonusWords)
  ) {
    return { status: 'invalid', reason: 'snapshot' };
  }
  if (snapshot.dateKey !== currentDateKey) return { status: 'expired', reason: 'date' };
  if (snapshot.appVersion !== appVersion) return { status: 'incompatible', reason: 'app-version' };
  if (snapshot.challengeVersion !== DAILY_CHALLENGE_VERSION) {
    return { status: 'incompatible', reason: 'challenge-version' };
  }

  let challenge: DailyChallenge;
  try {
    challenge = createDailyChallenge(currentDateKey);
  } catch {
    return { status: 'incompatible', reason: 'challenge-config' };
  }
  if (
    snapshot.categoryId !== challenge.categoryId ||
    snapshot.seed !== challenge.seed ||
    snapshot.gridSize !== challenge.gridSize ||
    snapshot.timeLimitSeconds !== challenge.timeLimitSeconds
  ) {
    return { status: 'incompatible', reason: 'challenge-config' };
  }

  const foundWords = snapshot.foundWords as string[];
  const bonusWords = snapshot.bonusWords as string[];
  const targetSet = new Set(challenge.puzzle.words);
  const foundSet = new Set(foundWords);
  const bonusSet = new Set(bonusWords);
  if (
    foundWords.some((word) => typeof word !== 'string' || !targetSet.has(word)) ||
    foundSet.size !== foundWords.length ||
    bonusWords.some((word) =>
      typeof word !== 'string' || targetSet.has(word) || !BONUS_WORDS.has(word)
    ) ||
    bonusSet.size !== bonusWords.length ||
    bonusWords.some((word) => foundSet.has(word))
  ) {
    return { status: 'invalid', reason: 'words' };
  }

  const expectedScore =
    foundWords.length * scoreSelection('puzzle') +
    bonusWords.length * scoreSelection('bonus');
  if (!Number.isSafeInteger(snapshot.score) || snapshot.score !== expectedScore) {
    return { status: 'invalid', reason: 'score' };
  }
  if (
    !Number.isInteger(snapshot.hintsLeft) ||
    (snapshot.hintsLeft as number) < 0 ||
    (snapshot.hintsLeft as number) > 3
  ) {
    return { status: 'invalid', reason: 'hints' };
  }
  if (!Number.isFinite(snapshot.elapsedMs) || (snapshot.elapsedMs as number) < 0) {
    return { status: 'invalid', reason: 'elapsed-time' };
  }
  if ((snapshot.elapsedMs as number) >= challenge.timeLimitSeconds * 1000) {
    return { status: 'expired', reason: 'time-limit' };
  }

  return {
    status: 'valid',
    challenge,
    foundWords,
    bonusWords,
    score: expectedScore,
    hintsLeft: snapshot.hintsLeft as number,
    elapsedMs: snapshot.elapsedMs as number,
    isComplete: foundWords.length === challenge.puzzle.words.length,
  };
}

export function dailyRecordToSummary(record: DailyChallengeRecord): GameSummary {
  const category = getCategory(record.categoryId);
  return {
    categoryId: record.categoryId,
    categoryName: category?.name ?? record.categoryId,
    mode: 'time',
    score: record.bestScore,
    wordsFound: record.wordsFound,
    totalWords: record.totalWords,
    bonusWords: 0,
    elapsedSeconds: record.completionTimeSeconds,
    timeBonus: 0,
    earnedCoins: 0,
    completed: true,
    newCategoryReward: false,
    dailyChallenge: {
      dateKey: record.dateKey,
      isPersonalBest: true,
      bestScore: record.bestScore,
    },
  };
}
