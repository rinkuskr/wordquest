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
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
): Puzzle {
  const words = inputWords.map((word) => word.trim().toUpperCase());
  if (!words.length) throw new Error('Cannot generate a puzzle without words.');
  if (words.some((word) => !/^[A-Z]+$/.test(word))) {
    throw new Error('Puzzle words must contain letters A–Z only.');
  }
  if (new Set(words).size !== words.length) {
    throw new Error('Puzzle word list contains duplicates.');
  }

  const size = getGridSize(words);
  const grid = Array.from({ length: size }, () => Array<string>(size).fill(''));
  const placements: Placement[] = [];
  const orderedWords = [...words].sort((a, b) => b.length - a.length);

  for (const word of orderedWords) {
    if (word.length > size) {
      throw new Error(`"${word}" is longer than the ${size}×${size} puzzle grid.`);
    }
    let placed: Placement | null = null;
    for (let attempt = 0; attempt < 500 && !placed; attempt += 1) {
      const direction = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)];
      const row = Math.floor(random() * size);
      const col = Math.floor(random() * size);
      const cells = Array.from({ length: word.length }, (_, index) => ({
        row: row + direction.row * index,
        col: col + direction.col * index,
      }));
      if (
        cells.some(
          ({ row: r, col: c }) =>
            r < 0 || c < 0 || r >= size || c >= size,
        )
      ) {
        continue;
      }
      if (
        cells.some(({ row: r, col: c }, index) => {
          const existing = grid[r][c];
          return existing !== '' && existing !== word[index];
        })
      ) {
        continue;
      }
      cells.forEach(({ row: r, col: c }, index) => {
        grid[r][c] = word[index];
      });
      placed = { word, cells };
    }
    if (!placed) {
      throw new Error(
        `Could not place "${word}" after 500 attempts. Try a larger or less crowded word list.`,
      );
    }
    placements.push(placed);
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

export function scoreSelection(kind: 'puzzle' | 'bonus'): number {
  return kind === 'puzzle' ? 10 : 5;
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

export function consumeHint(hintsLeft: number, hasAvailableWords: boolean) {
  if (!hasAvailableWords || hintsLeft <= 0) {
    return { hintsLeft, consumed: false };
  }
  return { hintsLeft: hintsLeft - 1, consumed: true };
}

export function isTimeExpired(mode: 'classic' | 'time', elapsedSeconds: number) {
  return mode === 'time' && elapsedSeconds >= 120;
}

export function getTimeBonus(mode: 'classic' | 'time', remainingSeconds: number) {
  return mode === 'time' ? Math.max(0, remainingSeconds) * 2 : 0;
}
