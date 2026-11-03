import { CATEGORY_DIFFICULTY } from '@/src/data/categories';
import type { Category, DifficultyTier } from '@/src/types/game';

export interface CategoryPuzzlePlan {
  tier: DifficultyTier;
  gridSize: 8 | 10 | 12;
  targetWords: string[];
  timeLimitSeconds: number;
  diagonalWordCount: number;
}

const TIER_SETTINGS: Record<
  DifficultyTier,
  { gridSize: 8 | 10 | 12; targetWordCount: number | null }
> = {
  beginner: { gridSize: 8, targetWordCount: 8 },
  easy: { gridSize: 10, targetWordCount: 10 },
  intermediate: { gridSize: 10, targetWordCount: 12 },
  advanced: { gridSize: 12, targetWordCount: null },
};

export function getCategoryPuzzlePlan(category: Category): CategoryPuzzlePlan {
  const tier = CATEGORY_DIFFICULTY[category.id];
  const settings = TIER_SETTINGS[tier];
  const targetCount = settings.targetWordCount ?? category.words.length;
  if (category.words.length < targetCount) {
    throw new Error(
      `${category.name} has ${category.words.length} words; ${tier} requires ${targetCount}.`,
    );
  }
  const targetWords = category.words.slice(0, targetCount);
  const timeLimitSeconds = Math.round((60 + 12 * targetWords.length) / 30) * 30;
  const diagonalWordCount = tier === 'beginner'
    ? 0
    : tier === 'easy'
      ? Math.min(2, targetWords.length)
      : tier === 'intermediate'
        ? Math.min(4, targetWords.length)
        : Math.round(targetWords.length / 3);

  return {
    tier,
    gridSize: settings.gridSize,
    targetWords,
    timeLimitSeconds,
    diagonalWordCount,
  };
}
