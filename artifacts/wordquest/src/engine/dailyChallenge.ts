import { CATEGORIES, getCategory } from '@/src/data/categories';
import { getCategoryPuzzlePlan } from '@/src/data/difficulty';
import { generatePuzzle, seededRandom } from '@/src/engine/gameEngine';
import type {
  DailyChallengeRecord,
  GameSummary,
  Puzzle,
} from '@/src/types/game';

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
