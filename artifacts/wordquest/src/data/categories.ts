import type { Category, CategoryId, DifficultyTier } from '@/src/types/game';

/**
 * Offline puzzle vocabulary, reconstructed from the 15 category topics in the
 * supplied build spec. Puzzle processing uses uppercase A–Z words.
 */
const CATEGORY_DATA: readonly Category[] = [
  {
    id: 'animals', name: 'Animals', emoji: '🐾',
    words: ['CAT', 'DOG', 'LION', 'TIGER', 'ZEBRA', 'MONKEY', 'RABBIT', 'BEAR'],
  },
  {
    id: 'food', name: 'Food', emoji: '🍕',
    words: ['BREAD', 'CHEESE', 'PASTA', 'PIZZA', 'SALAD', 'SOUP', 'COOKIE', 'PANCAKE', 'BURGER', 'NOODLE', 'SANDWICH', 'OMELET'],
  },
  {
    id: 'sports', name: 'Sports', emoji: '⚽',
    words: ['SOCCER', 'TENNIS', 'CRICKET', 'HOCKEY', 'RUGBY', 'GOLF', 'BOXING', 'SKATING', 'BASEBALL', 'BASKETBALL', 'SWIMMING', 'VOLLEYBALL'],
  },
  {
    id: 'countries', name: 'Countries', emoji: '🌍',
    words: ['ALGERIA', 'ARGENTINA', 'AUSTRALIA', 'BRAZIL', 'CANADA', 'CHINA', 'EGYPT', 'FRANCE', 'GERMANY', 'INDIA', 'JAPAN', 'KENYA', 'MEXICO', 'NEPAL', 'SPAIN', 'THAILAND'],
  },
  {
    id: 'colors', name: 'Colors', emoji: '🎨',
    words: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE', 'PINK', 'BROWN', 'BLACK', 'WHITE', 'CYAN', 'VIOLET'],
  },
  {
    id: 'fruits', name: 'Fruits', emoji: '🍎',
    words: ['APPLE', 'BANANA', 'CHERRY', 'GRAPE', 'LEMON', 'MANGO', 'ORANGE', 'PAPAYA', 'PEACH', 'PEAR', 'PLUM', 'GUAVA'],
  },
  {
    id: 'space', name: 'Space', emoji: '🚀',
    words: ['PLANET', 'COMET', 'GALAXY', 'ORBIT', 'ROCKET', 'STAR', 'MOON', 'NEBULA', 'ASTEROID', 'SATELLITE', 'COSMOS', 'METEOR'],
  },
  {
    id: 'ocean-life', name: 'Ocean Life', emoji: '🌊',
    words: ['DOLPHIN', 'WHALE', 'SHARK', 'OCTOPUS', 'SEAL', 'TURTLE', 'CORAL', 'JELLYFISH', 'SEAHORSE', 'STARFISH', 'CRAB', 'SQUID'],
  },
  {
    id: 'music', name: 'Music', emoji: '🎵',
    words: ['PIANO', 'GUITAR', 'DRUM', 'VIOLIN', 'FLUTE', 'TRUMPET', 'MELODY', 'RHYTHM', 'SINGER', 'CHORUS', 'BASS', 'HARMONY'],
  },
  {
    id: 'movies', name: 'Movies', emoji: '🎬',
    words: ['ACTOR', 'SCENE', 'SCRIPT', 'CAMERA', 'SCREEN', 'COMEDY', 'DRAMA', 'THRILLER', 'DIRECTOR', 'CINEMA', 'HERO', 'SOUNDTRACK'],
  },
  {
    id: 'nature', name: 'Nature', emoji: '🌿',
    words: ['FOREST', 'RIVER', 'MOUNTAIN', 'FLOWER', 'DESERT', 'ISLAND', 'VALLEY', 'MEADOW', 'THUNDER', 'BREEZE', 'SUNSHINE', 'WATERFALL'],
  },
  {
    id: 'technology', name: 'Technology', emoji: '💻',
    words: ['COMPUTER', 'LAPTOP', 'SMARTPHONE', 'TABLET', 'KEYBOARD', 'INTERNET', 'ROBOT', 'SOFTWARE', 'PRINTER', 'CAMERA', 'SCREEN', 'NETWORK'],
  },
  {
    id: 'jobs', name: 'Jobs', emoji: '👔',
    words: ['DOCTOR', 'TEACHER', 'PILOT', 'CHEF', 'FARMER', 'ARTIST', 'NURSE', 'DENTIST', 'ENGINEER', 'LAWYER', 'BAKER', 'FIREFIGHTER'],
  },
  {
    id: 'clothing', name: 'Clothing', emoji: '👗',
    words: ['SHIRT', 'DRESS', 'JACKET', 'SOCKS', 'SHOES', 'HAT', 'SCARF', 'GLOVES', 'SKIRT', 'JEANS', 'SWEATER', 'SANDALS'],
  },
  {
    id: 'vegetables', name: 'Vegetables', emoji: '🥕',
    words: ['CARROT', 'POTATO', 'TOMATO', 'ONION', 'PEPPER', 'SPINACH', 'CABBAGE', 'CELERY', 'RADISH', 'PUMPKIN', 'LETTUCE', 'BROCCOLI'],
  },
];

export const CATEGORY_PROGRESSION_ORDER: readonly CategoryId[] = [
  'animals',
  'colors',
  'fruits',
  'clothing',
  'food',
  'music',
  'space',
  'ocean-life',
  'vegetables',
  'nature',
  'countries',
  'movies',
  'sports',
  'technology',
  'jobs',
];

export const CATEGORY_DIFFICULTY: Record<CategoryId, DifficultyTier> = {
  animals: 'beginner',
  colors: 'beginner',
  fruits: 'beginner',
  clothing: 'easy',
  food: 'easy',
  music: 'easy',
  space: 'easy',
  'ocean-life': 'intermediate',
  vegetables: 'intermediate',
  nature: 'intermediate',
  countries: 'advanced',
  movies: 'advanced',
  sports: 'advanced',
  technology: 'advanced',
  jobs: 'advanced',
};

const categoriesById = new Map(CATEGORY_DATA.map((category) => [category.id, category]));
export const CATEGORIES: readonly Category[] = CATEGORY_PROGRESSION_ORDER.map(
  (id) => categoriesById.get(id)!,
);

export const getCategory = (id: string | undefined) =>
  CATEGORIES.find((category) => category.id === id);

export const hasCompleteCategoryData = CATEGORIES.every(
  (category) => category.words.length > 0,
);

export function isCategoryUnlocked(
  categoryIndex: number,
  completedLevels: readonly string[],
  previouslyUnlocked: readonly string[] = [],
): boolean {
  const current = CATEGORIES[categoryIndex];
  if (!current) return false;
  if (
    categoryIndex === 0 ||
    completedLevels.includes(current.id) ||
    previouslyUnlocked.includes(current.id)
  ) return true;
  const previous = CATEGORIES[categoryIndex - 1];
  return !!previous && completedLevels.includes(previous.id);
}
