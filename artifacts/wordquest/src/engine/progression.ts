import { CATEGORIES } from '@/src/data/categories';
import type { CategoryId, SavedProgress } from '@/src/types/game';

export const INITIAL_PROGRESS: SavedProgress = {
  version: 1,
  coins: 300,
  completedLevels: [],
  soundEnabled: true,
};

export function normalizeProgress(raw: unknown): SavedProgress {
  if (!raw || typeof raw !== 'object') return { ...INITIAL_PROGRESS };
  const value = raw as Partial<SavedProgress>;
  const validIds = new Set(CATEGORIES.map((category) => category.id));
  const completedLevels = Array.isArray(value.completedLevels)
    ? [...new Set(value.completedLevels.filter((id): id is CategoryId =>
        typeof id === 'string' && validIds.has(id as CategoryId),
      ))]
    : [];
  const coins =
    typeof value.coins === 'number' && Number.isFinite(value.coins)
      ? Math.max(0, Math.floor(value.coins))
      : INITIAL_PROGRESS.coins;
  return {
    version: 1,
    coins,
    completedLevels,
    soundEnabled:
      typeof value.soundEnabled === 'boolean'
        ? value.soundEnabled
        : INITIAL_PROGRESS.soundEnabled,
  };
}

export function awardFirstCompletion(
  progress: SavedProgress,
  categoryId: CategoryId,
): { progress: SavedProgress; reward: number; isFirstCompletion: boolean } {
  if (progress.completedLevels.includes(categoryId)) {
    return { progress, reward: 0, isFirstCompletion: false };
  }
  return {
    progress: {
      ...progress,
      coins: progress.coins + 50,
      completedLevels: [...progress.completedLevels, categoryId],
    },
    reward: 50,
    isFirstCompletion: true,
  };
}
