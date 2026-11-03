import { CATEGORIES } from '@/src/data/categories';
import type { CategoryId, SavedProgress } from '@/src/types/game';

const LEGACY_CATEGORY_ORDER: readonly CategoryId[] = [
  'animals',
  'food',
  'sports',
  'countries',
  'colors',
  'fruits',
  'space',
  'ocean-life',
  'music',
  'movies',
  'nature',
  'technology',
  'jobs',
  'clothing',
  'vegetables',
];

export const INITIAL_PROGRESS: SavedProgress = {
  version: 2,
  coins: 300,
  completedLevels: [],
  soundEnabled: true,
  unlockedCategories: ['animals'],
};

function getLegacyUnlockedCategories(completedLevels: readonly CategoryId[]): CategoryId[] {
  const unlocked = new Set<CategoryId>([LEGACY_CATEGORY_ORDER[0], ...completedLevels]);
  LEGACY_CATEGORY_ORDER.forEach((categoryId, index) => {
    if (index > 0 && completedLevels.includes(LEGACY_CATEGORY_ORDER[index - 1])) {
      unlocked.add(categoryId);
    }
  });
  return CATEGORIES
    .map((category) => category.id)
    .filter((categoryId) => unlocked.has(categoryId));
}

export function normalizeProgress(raw: unknown): SavedProgress {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...INITIAL_PROGRESS, completedLevels: [], unlockedCategories: ['animals'] };
  }
  const value = raw as Record<string, unknown> & { version?: number };
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
  const unlockedCategories = value.version === 1
    ? getLegacyUnlockedCategories(completedLevels)
    : Array.isArray(value.unlockedCategories)
      ? [...new Set(value.unlockedCategories.filter((id): id is CategoryId =>
          typeof id === 'string' && validIds.has(id as CategoryId),
        ))]
      : [];
  const unlocked = new Set<CategoryId>([
    'animals',
    ...completedLevels,
    ...unlockedCategories,
  ]);
  return {
    version: 2,
    coins,
    completedLevels,
    soundEnabled:
      typeof value.soundEnabled === 'boolean'
        ? value.soundEnabled
        : INITIAL_PROGRESS.soundEnabled,
    unlockedCategories: CATEGORIES
      .map((category) => category.id)
      .filter((categoryId) => unlocked.has(categoryId)),
  };
}

export function awardFirstCompletion(
  progress: SavedProgress,
  categoryId: CategoryId,
): { progress: SavedProgress; reward: number; isFirstCompletion: boolean } {
  if (progress.completedLevels.includes(categoryId)) {
    return { progress, reward: 0, isFirstCompletion: false };
  }
  const completedLevels = [...progress.completedLevels, categoryId];
  const categoryIndex = CATEGORIES.findIndex((category) => category.id === categoryId);
  const unlockedCategories = new Set<CategoryId>([
    ...progress.unlockedCategories,
    categoryId,
  ]);
  const nextCategory = CATEGORIES[categoryIndex + 1];
  if (nextCategory) unlockedCategories.add(nextCategory.id);
  return {
    progress: {
      ...progress,
      coins: progress.coins + 50,
      completedLevels,
      unlockedCategories: CATEGORIES
        .map((category) => category.id)
        .filter((id) => unlockedCategories.has(id)),
    },
    reward: 50,
    isFirstCompletion: true,
  };
}
