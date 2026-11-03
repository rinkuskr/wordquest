import type { Placement, Position, Puzzle } from '@/src/types/game';

const DIRECTIONS: readonly Position[] = [
  { row: -1, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: 1 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];
const AXIS_DIRECTIONS: readonly Position[] = DIRECTIONS.filter(
  ({ row, col }) => row === 0 || col === 0,
);
const DIAGONAL_DIRECTIONS: readonly Position[] = DIRECTIONS.filter(
  ({ row, col }) => row !== 0 && col !== 0,
);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_PLACEMENT_ATTEMPTS = 500;
const MAX_LAYOUT_ATTEMPTS = 25;

export interface PuzzleGenerationOptions {
  gridSize?: 8 | 10 | 12;
  diagonalWordCount?: number;
}

export function getGridSize(words: readonly string[]): 8 | 10 | 12 {
  const normalized = words.map((word) => word.trim().toUpperCase());
  const longest = normalized.reduce((max, word) => Math.max(max, word.length), 0);
  if (normalized.length >= 16 || longest >= 10) return 12;
  if (normalized.length >= 12 || longest >= 7) return 10;
  return 8;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generatePuzzle(
  inputWords: readonly string[],
  random: () => number = Math.random,
  options: PuzzleGenerationOptions = {},
): Puzzle {
  const words = inputWords.map((word) => word.trim().toUpperCase());
  if (!words.length) throw new Error('Cannot generate a puzzle without words.');
  if (words.some((word) => !/^[A-Z]+$/.test(word))) {
    throw new Error('Puzzle words must contain letters A–Z only.');
  }
  if (new Set(words).size !== words.length) {
    throw new Error('Puzzle word list contains duplicates.');
  }

  const size = options.gridSize ?? getGridSize(words);
  const requestedDiagonalCount = options.diagonalWordCount;
  if (
    requestedDiagonalCount !== undefined &&
    (!Number.isInteger(requestedDiagonalCount) ||
      requestedDiagonalCount < 0 ||
      requestedDiagonalCount > words.length)
  ) {
    throw new Error(`Diagonal word count must be an integer between 0 and ${words.length}.`);
  }
  const orderedWords = [...words].sort((a, b) => b.length - a.length);
  if (orderedWords.some((word) => word.length > size)) {
    const word = orderedWords.find((candidate) => candidate.length > size)!;
    throw new Error(`"${word}" is longer than the ${size}×${size} puzzle grid.`);
  }
  const diagonalWords = requestedDiagonalCount === undefined
    ? null
    : new Set(orderedWords.slice(orderedWords.length - requestedDiagonalCount));

  let grid: string[][] | null = null;
  let placements: Placement[] | null = null;
  let lastFailedWord = orderedWords[0];
  for (let layoutAttempt = 0; layoutAttempt < MAX_LAYOUT_ATTEMPTS; layoutAttempt += 1) {
    const candidateGrid = Array.from({ length: size }, () => Array<string>(size).fill(''));
    const candidatePlacements: Placement[] = [];
    let failed = false;

    const layoutWordOrder = diagonalWords === null
      ? orderedWords
      : [
          ...orderedWords.filter((word) => diagonalWords.has(word)),
          ...orderedWords.filter((word) => !diagonalWords.has(word)),
        ];

    for (const word of layoutWordOrder) {
      let placed: Placement | null = null;
        const directions = diagonalWords === null
          ? DIRECTIONS
          : diagonalWords.has(word)
            ? DIAGONAL_DIRECTIONS
            : AXIS_DIRECTIONS;
      for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS && !placed; attempt += 1) {
          const direction = directions[Math.floor(random() * directions.length)];
        const row = Math.floor(random() * size);
        const col = Math.floor(random() * size);
        const cells = Array.from({ length: word.length }, (_, index) => ({
          row: row + direction.row * index,
          col: col + direction.col * index,
        }));
        if (cells.some(({ row: r, col: c }) => r < 0 || c < 0 || r >= size || c >= size)) {
          continue;
        }
        if (cells.some(({ row: r, col: c }, index) => {
          const existing = candidateGrid[r][c];
          return existing !== '' && existing !== word[index];
        })) {
          continue;
        }
        cells.forEach(({ row: r, col: c }, index) => {
          candidateGrid[r][c] = word[index];
        });
        placed = { word, cells };
      }

      if (!placed) {
        lastFailedWord = word;
        failed = true;
        break;
      }
      candidatePlacements.push(placed);
    }

    if (!failed) {
      grid = candidateGrid;
      placements = candidatePlacements;
      break;
    }
  }

  if (!grid || !placements) {
    const distributionMessage = requestedDiagonalCount === undefined
      ? ''
      : ` while placing exactly ${requestedDiagonalCount} diagonal word(s)`;
    throw new Error(
      `Could not place "${lastFailedWord}"${distributionMessage} after ${MAX_LAYOUT_ATTEMPTS} complete layout attempts.`,
    );
  }

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!grid[row][col]) {
        grid[row][col] = LETTERS[Math.floor(random() * LETTERS.length)];
      }
    }
  }
  validatePuzzle({ size, grid, words, placements });
  return { size, grid, words, placements };
}

export function validatePuzzle(puzzle: Puzzle): void {
  for (const placement of puzzle.placements) {
    const actual = placement.cells
      .map(({ row, col }) => puzzle.grid[row]?.[col] ?? '')
      .join('');
    if (actual !== placement.word) {
      throw new Error(`Generated board failed validation for "${placement.word}".`);
    }
  }
  if (puzzle.placements.length !== puzzle.words.length) {
    throw new Error('Generated board is missing one or more required words.');
  }
}

export function selectionWord(
  grid: readonly string[][],
  cells: readonly Position[],
): string | null {
  if (cells.length < 2) return null;
  const start = cells[0];
  const end = cells[cells.length - 1];
  const rowDelta = end.row - start.row;
  const colDelta = end.col - start.col;
  const steps = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
  if (
    steps !== cells.length - 1 ||
    !(
      rowDelta === 0 ||
      colDelta === 0 ||
      Math.abs(rowDelta) === Math.abs(colDelta)
    )
  ) {
    return null;
  }
  const rowStep = Math.sign(rowDelta);
  const colStep = Math.sign(colDelta);
  for (let index = 0; index < cells.length; index += 1) {
    if (
      cells[index].row !== start.row + rowStep * index ||
      cells[index].col !== start.col + colStep * index
    ) {
      return null;
    }
  }
  return cells.map(({ row, col }) => grid[row]?.[col] ?? '').join('');
}

export function matchPuzzleWord(
  value: string,
  unfoundWords: readonly string[],
): string | null {
  const forward = value.toUpperCase();
  const backward = [...forward].reverse().join('');
  return unfoundWords.find(
    (word) => word === forward || word === backward,
  ) ?? null;
}

export function scoreSelection(kind: 'puzzle' | 'bonus' | 'duplicate' | 'invalid'): number {
  if (kind === 'puzzle') return 10;
  if (kind === 'bonus') return 5;
  return 0;
}

export function validateBonusWord(
  value: string,
  puzzleWords: readonly string[],
  alreadyFound: readonly string[],
  dictionary: ReadonlySet<string>,
): string | null {
  const word = value.toUpperCase();
  const reversed = [...word].reverse().join('');
  const candidate = dictionary.has(word) ? word : reversed;
  if (
    candidate.length < 3 ||
    !dictionary.has(candidate) ||
    puzzleWords.includes(candidate) ||
    alreadyFound.includes(candidate)
  ) {
    return null;
  }
  return candidate;
}

export type SelectionResolution =
  | { kind: 'puzzle'; word: string }
  | { kind: 'bonus'; word: string }
  | { kind: 'duplicate' }
  | { kind: 'invalid' };

export function resolveWordSelection(
  value: string,
  puzzleWords: readonly string[],
  foundWords: readonly string[],
  bonusWords: readonly string[],
  dictionary: ReadonlySet<string>,
): SelectionResolution {
  const unfoundWords = puzzleWords.filter((word) => !foundWords.includes(word));
  const puzzleWord = matchPuzzleWord(value, unfoundWords);
  if (puzzleWord) return { kind: 'puzzle', word: puzzleWord };

  const bonusWord = validateBonusWord(value, puzzleWords, bonusWords, dictionary);
  if (bonusWord) return { kind: 'bonus', word: bonusWord };

  const forward = value.toUpperCase();
  const backward = [...forward].reverse().join('');
  const isFoundPuzzleWord = puzzleWords.some(
    (word) => foundWords.includes(word) && (word === forward || word === backward),
  );
  const isFoundBonusWord = bonusWords.includes(forward) || bonusWords.includes(backward);
  return isFoundPuzzleWord || isFoundBonusWord
    ? { kind: 'duplicate' }
    : { kind: 'invalid' };
}

export function consumeHint(hintsLeft: number, hasAvailableWords: boolean) {
  if (!hasAvailableWords || hintsLeft <= 0) {
    return { hintsLeft, consumed: false };
  }
  return { hintsLeft: hintsLeft - 1, consumed: true };
}

export function isTimeExpired(
  mode: 'classic' | 'time',
  elapsedSeconds: number,
  timeLimitSeconds = 120,
) {
  return mode === 'time' && elapsedSeconds >= timeLimitSeconds;
}

export function getTimeBonus(mode: 'classic' | 'time', remainingSeconds: number) {
  return mode === 'time' ? Math.max(0, remainingSeconds) * 2 : 0;
}
