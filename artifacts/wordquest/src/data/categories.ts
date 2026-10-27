import type { Category } from '@/src/types/game';

/**
 * Word arrays intentionally remain empty until the exact user-supplied lists arrive.
 * Do not replace these with guessed words; the app surfaces this missing content.
 */
export const CATEGORIES: readonly Category[] = [
  { id: 'animals', name: 'Animals', emoji: '🐾', words: [] },
  { id: 'food', name: 'Food', emoji: '🍕', words: [] },
  { id: 'sports', name: 'Sports', emoji: '⚽', words: [] },
  { id: 'countries', name: 'Countries', emoji: '🌍', words: [] },
  { id: 'colors', name: 'Colors', emoji: '🎨', words: [] },
  { id: 'fruits', name: 'Fruits', emoji: '🍎', words: [] },
  { id: 'space', name: 'Space', emoji: '🚀', words: [] },
  { id: 'ocean-life', name: 'Ocean Life', emoji: '🌊', words: [] },
  { id: 'music', name: 'Music', emoji: '🎵', words: [] },
  { id: 'movies', name: 'Movies', emoji: '🎬', words: [] },
  { id: 'nature', name: 'Nature', emoji: '🌿', words: [] },
  { id: 'technology', name: 'Technology', emoji: '💻', words: [] },
  { id: 'jobs', name: 'Jobs', emoji: '👔', words: [] },
  { id: 'clothing', name: 'Clothing', emoji: '👗', words: [] },
  { id: 'vegetables', name: 'Vegetables', emoji: '🥕', words: [] },
];

export const getCategory = (id: string | undefined) =>
  CATEGORIES.find((category) => category.id === id);

export const hasCompleteCategoryData = CATEGORIES.every(
  (category) => category.words.length > 0,
);

export function isCategoryUnlocked(
  categoryIndex: number,
  completedLevels: readonly string[],
): boolean {
  if (categoryIndex <= 0) return true;
  const previous = CATEGORIES[categoryIndex - 1];
  return !!previous && completedLevels.includes(previous.id);
}
