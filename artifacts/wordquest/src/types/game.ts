export type CategoryId =
  | 'animals'
  | 'food'
  | 'sports'
  | 'countries'
  | 'colors'
  | 'fruits'
  | 'space'
  | 'ocean-life'
  | 'music'
  | 'movies'
  | 'nature'
  | 'technology'
  | 'jobs'
  | 'clothing'
  | 'vegetables';

export interface Category {
  id: CategoryId;
  name: string;
  emoji: string;
  words: readonly string[];
}

export type GameMode = 'classic' | 'time';
export type DifficultyTier = 'beginner' | 'easy' | 'intermediate' | 'advanced';
export type Position = { row: number; col: number };
export type Placement = { word: string; cells: Position[] };
export interface Puzzle {
  size: 8 | 10 | 12;
  grid: string[][];
  words: string[];
  placements: Placement[];
}

export interface GameSummary {
  categoryId: CategoryId;
  categoryName: string;
  mode: GameMode;
  score: number;
  wordsFound: number;
  totalWords: number;
  bonusWords: number;
  elapsedSeconds: number;
  timeBonus: number;
  earnedCoins: number;
  completed: boolean;
  newCategoryReward: boolean;
}

export interface SavedProgress {
  version: 2;
  coins: number;
  completedLevels: CategoryId[];
  soundEnabled: boolean;
  unlockedCategories: CategoryId[];
}
