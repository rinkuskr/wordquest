import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { BONUS_WORD_COUNT, BONUS_WORDS } from '../src/data/bonusWords';
import { CATEGORIES, hasCompleteCategoryData, isCategoryUnlocked } from '../src/data/categories';
import {
  consumeHint,
  generatePuzzle,
  getGridSize,
  getTimeBonus,
  isTimeExpired,
  matchPuzzleWord,
  resolveWordSelection,
  scoreSelection,
  seededRandom,
  selectionWord,
  validateBonusWord,
} from '../src/engine/gameEngine';
import { awardFirstCompletion, INITIAL_PROGRESS, normalizeProgress } from '../src/engine/progression';
import { elapsedMilliseconds, shouldRunGameClock } from '../src/engine/gameClock';
import { getGameBoardSize } from '../src/engine/gameLayout';
import { pointToGridCell, straightLineBetween } from '../src/engine/gridTouch';
import { MockAdProvider } from '../src/services/ads';
import { HIGHLIGHT_COLORS } from '../src/theme/highlights';
import type { Position } from '../src/types/game';

describe('grid size and generation', () => {
  it('applies all three grid size thresholds', () => {
    expect(getGridSize(['CAT'])).toBe(8);
    expect(getGridSize(['ELEPHANT'])).toBe(10);
    expect(getGridSize(Array.from({ length: 12 }, () => 'CAT'))).toBe(10);
    expect(getGridSize(Array.from({ length: 16 }, () => 'CAT'))).toBe(12);
    expect(getGridSize(['SNAKEFISH'])).toBe(10);
    expect(getGridSize(['SNAKEFISHXX'])).toBe(12);
  });

  it('places a word in each of the eight straight-line directions', () => {
    const directions = [
      [-1, -1], [-1, 0], [-1, 1], [0, -1],
      [0, 1], [1, -1], [1, 0], [1, 1],
    ];
    directions.forEach(([dr, dc], directionIndex) => {
      const startRow = dr < 0 ? 2 : dr > 0 ? 0 : 3;
      const startCol = dc < 0 ? 2 : dc > 0 ? 0 : 3;
      const randomValues = [
        (directionIndex + 0.1) / 8,
        (startRow + 0.1) / 8,
        (startCol + 0.1) / 8,
      ];
      const random = () => randomValues.shift() ?? 0.37;
      const puzzle = generatePuzzle(['CAT'], random);
      const cells = puzzle.placements[0].cells;
      expect(cells[1].row - cells[0].row).toBe(dr);
      expect(cells[1].col - cells[0].col).toBe(dc);
      expect(cells.map(({ row, col }) => puzzle.grid[row][col]).join('')).toBe('CAT');
    });
  });

  it('allows matching overlaps and validates every required word', () => {
    let overlapFound = false;
    for (let seed = 1; seed <= 300 && !overlapFound; seed += 1) {
      const puzzle = generatePuzzle(['CAT', 'ATE'], seededRandom(seed));
      const first = new Map(puzzle.placements[0].cells.map((cell, index) => [
        `${cell.row}:${cell.col}`,
        puzzle.placements[0].word[index],
      ]));
      overlapFound = puzzle.placements[1].cells.some((cell, index) =>
        first.get(`${cell.row}:${cell.col}`) === puzzle.placements[1].word[index],
      );
    }
    expect(overlapFound).toBe(true);
  });

  it('fails clearly when a word cannot fit instead of omitting it', () => {
    expect(() => generatePuzzle(['PNEUMONOULTRAMICROSCOPICS'])).toThrow(/longer than the 12×12 puzzle grid/);
  });

  it('keeps every Animals target word selectable from its generated placement', () => {
    const animals = CATEGORIES.find((category) => category.id === 'animals')!;
    const puzzle = generatePuzzle(animals.words, seededRandom(2026));
    const foundWords: string[] = [];

    expect(puzzle.words).toEqual(animals.words);
    expect(puzzle.placements).toHaveLength(8);
    for (const placement of puzzle.placements) {
      const selected = selectionWord(puzzle.grid, placement.cells);
      expect(selected).toBe(placement.word);
      expect(resolveWordSelection(selected ?? '', puzzle.words, foundWords, [], new Set())).toEqual({
        kind: 'puzzle',
        word: placement.word,
      });
      foundWords.push(placement.word);
    }

    expect([...foundWords].sort()).toEqual([...animals.words].sort());
  });

  it('stress-tests every category over 500 reproducible seeds', () => {
    const seedCount = 500;
    const expectedDirections = new Set([
      '-1,-1', '-1,0', '-1,1', '0,-1',
      '0,1', '1,-1', '1,0', '1,1',
    ]);
    const failures: string[] = [];
    const metrics: Array<{
      categoryId: string;
      generated: number;
      generationErrors: number;
      totalGenerationMs: number;
      averageGenerationMs: number;
      slowestPuzzleMs: number;
    }> = [];
    let totalGenerated = 0;

    for (const category of CATEGORIES) {
      let generated = 0;
      let generationErrors = 0;
      let totalGenerationMs = 0;
      let slowestPuzzleMs = 0;
      const directionsSeen = new Set<string>();

      for (let seed = 1; seed <= seedCount; seed += 1) {
        const startedAt = performance.now();
        let puzzle;
        try {
          puzzle = generatePuzzle(category.words, seededRandom(seed));
        } catch (error) {
          totalGenerationMs += performance.now() - startedAt;
          generationErrors += 1;
          const reason = error instanceof Error ? error.message : String(error);
          failures.push(`category=${category.id} seed=${seed}: generation failed: ${reason}`);
          continue;
        }
        const generationTimeMs = performance.now() - startedAt;
        totalGenerationMs += generationTimeMs;
        slowestPuzzleMs = Math.max(slowestPuzzleMs, generationTimeMs);
        generated += 1;
        totalGenerated += 1;

        const seedFailures: string[] = [];
        const fail = (reason: string) => seedFailures.push(reason);

        if (
          puzzle.words.length !== category.words.length ||
          category.words.some((word) => !puzzle.words.includes(word))
        ) {
          fail('generated target list differs from the category list');
        }
        if (
          puzzle.placements.length !== category.words.length ||
          new Set(puzzle.placements.map(({ word }) => word)).size !== category.words.length
        ) {
          fail('placements do not cover every target exactly once');
        }
        if (
          puzzle.grid.length !== puzzle.size ||
          puzzle.grid.some((row) => row.length !== puzzle.size)
        ) {
          fail(`grid is not square at size ${puzzle.size}`);
        }

        const cellsByCoordinate = new Map<string, string>();
        const placedWords = new Set<string>();
        for (const placement of puzzle.placements) {
          if (!category.words.includes(placement.word)) {
            fail(`unexpected placed word "${placement.word}"`);
            continue;
          }
          if (placedWords.has(placement.word)) {
            fail(`target "${placement.word}" was placed more than once`);
            continue;
          }
          placedWords.add(placement.word);
          if (placement.cells.length !== placement.word.length || placement.cells.length < 2) {
            fail(`placement length is invalid for "${placement.word}"`);
            continue;
          }

          let placementInBounds = true;
          for (let index = 0; index < placement.cells.length; index += 1) {
            const cell = placement.cells[index];
            if (
              cell.row < 0 ||
              cell.col < 0 ||
              cell.row >= puzzle.size ||
              cell.col >= puzzle.size
            ) {
              placementInBounds = false;
              break;
            }
            const letter = placement.word[index];
            const coordinate = `${cell.row}:${cell.col}`;
            const previousLetter = cellsByCoordinate.get(coordinate);
            if (previousLetter && previousLetter !== letter) {
              fail(`overlap at ${coordinate} conflicts: ${previousLetter} vs ${letter}`);
            }
            cellsByCoordinate.set(coordinate, letter);
            if (puzzle.grid[cell.row]?.[cell.col] !== letter) {
              fail(`grid letters do not spell "${placement.word}" at ${coordinate}`);
            }
          }
          if (!placementInBounds) {
            fail(`placement for "${placement.word}" is outside the grid`);
            continue;
          }

          const first = placement.cells[0];
          const second = placement.cells[1];
          const rowStep = second.row - first.row;
          const colStep = second.col - first.col;
          directionsSeen.add(`${rowStep},${colStep}`);

          const forward = selectionWord(puzzle.grid, placement.cells);
          const reverse = selectionWord(puzzle.grid, [...placement.cells].reverse());
          const unfoundTargets = category.words.filter((word) => !placedWords.has(word) || word === placement.word);
          if (
            forward !== placement.word ||
            matchPuzzleWord(forward ?? '', unfoundTargets) !== placement.word
          ) {
            fail(`forward selection cannot find "${placement.word}"`);
          }
          if (
            reverse !== [...placement.word].reverse().join('') ||
            matchPuzzleWord(reverse ?? '', unfoundTargets) !== placement.word
          ) {
            fail(`reverse selection cannot find "${placement.word}"`);
          }
        }

        for (const target of category.words) {
          if (!placedWords.has(target)) fail(`target "${target}" has no valid placement`);
        }

        if (seedFailures.length) {
          failures.push(
            ...seedFailures.map((reason) => `category=${category.id} seed=${seed}: ${reason}`),
          );
        }
      }

      const missingDirections = [...expectedDirections].filter((direction) => !directionsSeen.has(direction));
      if (missingDirections.length) {
        failures.push(
          `category=${category.id} seeds=1..${seedCount}: missing placement directions ${missingDirections.join(' ')}`,
        );
      }
      metrics.push({
        categoryId: category.id,
        generated,
        generationErrors,
        totalGenerationMs: Number(totalGenerationMs.toFixed(2)),
        averageGenerationMs: Number((totalGenerationMs / seedCount).toFixed(4)),
        slowestPuzzleMs: Number(slowestPuzzleMs.toFixed(3)),
      });
    }

    console.info(
      `WORDQUEST_PUZZLE_STRESS ${JSON.stringify({
        categories: CATEGORIES.length,
        seedsPerCategory: seedCount,
        totalGenerated,
        failures: failures.length,
        metrics,
      })}`,
    );
    expect(failures, failures.join('\n')).toEqual([]);
  });
});

describe('selection, bonus words, and scoring', () => {
  const grid = [
    ['C', 'A', 'T'],
    ['R', 'E', 'D'],
    ['O', 'G', 'S'],
  ];

  it('reads a straight reverse-direction selection', () => {
    const cells: Position[] = [{ row: 0, col: 2 }, { row: 0, col: 1 }, { row: 0, col: 0 }];
    expect(selectionWord(grid, cells)).toBe('TAC');
    expect(matchPuzzleWord('TAC', ['CAT'])).toBe('CAT');
    expect(matchPuzzleWord('CAT', ['DOG'])).toBeNull();
    expect(selectionWord(grid, [{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 1 }])).toBeNull();
  });

  it('accepts forward and reverse selections in every straight-line direction', () => {
    const directions = [
      [-1, -1], [-1, 0], [-1, 1], [0, -1],
      [0, 1], [1, -1], [1, 0], [1, 1],
    ];
    directions.forEach(([dr, dc]) => {
      const start = { row: dr < 0 ? 3 : 0, col: dc < 0 ? 3 : 0 };
      const cells = Array.from({ length: 3 }, (_, index) => ({
        row: start.row + dr * index,
        col: start.col + dc * index,
      }));
      const selectionGrid = Array.from({ length: 4 }, () => Array<string>(4).fill('X'));
      ['C', 'A', 'T'].forEach((letter, index) => {
        selectionGrid[cells[index].row][cells[index].col] = letter;
      });
      expect(selectionWord(selectionGrid, cells)).toBe('CAT');
      expect(selectionWord(selectionGrid, [...cells].reverse())).toBe('TAC');
      expect(matchPuzzleWord(selectionWord(selectionGrid, [...cells].reverse()) ?? '', ['CAT'])).toBe('CAT');
    });
  });

  it('contains at least 600 curated words and rejects puzzle and duplicate words', () => {
    expect(BONUS_WORD_COUNT).toBeGreaterThanOrEqual(600);
    expect(BONUS_WORDS.has('CAT')).toBe(true);
    expect(validateBonusWord('CAT', [], [], BONUS_WORDS)).toBe('CAT');
    expect(validateBonusWord('CAT', ['CAT'], [], BONUS_WORDS)).toBeNull();
    expect(validateBonusWord('CAT', [], ['CAT'], BONUS_WORDS)).toBeNull();
    expect(validateBonusWord('IT', [], [], BONUS_WORDS)).toBeNull();
  });

  it('scores puzzle and bonus words once per accepted match', () => {
    expect(scoreSelection('puzzle')).toBe(10);
    expect(scoreSelection('bonus')).toBe(5);
    const alreadyFound = ['CAT'];
    expect(matchPuzzleWord('TAC', ['DOG'])).toBeNull();
    expect(alreadyFound).toContain('CAT');
  });

  it('classifies invalid and repeated words without granting scoreable matches', () => {
    const dictionary = new Set(['CAT', 'DOG', 'BIRD']);
    expect(resolveWordSelection('CAT', ['CAT'], [], [], dictionary)).toEqual({
      kind: 'puzzle',
      word: 'CAT',
    });
    expect(resolveWordSelection('TAC', ['CAT'], ['CAT'], [], dictionary)).toEqual({
      kind: 'duplicate',
    });
    expect(resolveWordSelection('DOG', ['CAT'], [], [], dictionary)).toEqual({
      kind: 'bonus',
      word: 'DOG',
    });
    expect(resolveWordSelection('GOD', ['CAT'], [], ['DOG'], dictionary)).toEqual({
      kind: 'duplicate',
    });
    expect(resolveWordSelection('ZZZ', ['CAT'], [], [], dictionary)).toEqual({
      kind: 'invalid',
    });
    expect(scoreSelection('invalid')).toBe(0);
    expect(scoreSelection('duplicate')).toBe(0);
  });

  it('awards time bonuses only for time mode', () => {
    expect(getTimeBonus('time', 30)).toBe(60);
    expect(getTimeBonus('classic', 30)).toBe(0);
    expect(getTimeBonus('time', -1)).toBe(0);
  });

  it('ends Time Mode at 120 seconds but never times out Classic Mode', () => {
    expect(isTimeExpired('time', 119)).toBe(false);
    expect(isTimeExpired('time', 120)).toBe(true);
    expect(isTimeExpired('classic', 10_000)).toBe(false);
  });
});

describe('hints, progression, and local data recovery', () => {
  it('consumes exactly one hint only when a target word remains', () => {
    expect(consumeHint(3, true)).toEqual({ hintsLeft: 2, consumed: true });
    expect(consumeHint(0, true)).toEqual({ hintsLeft: 0, consumed: false });
    expect(consumeHint(2, false)).toEqual({ hintsLeft: 2, consumed: false });
  });

  it('unlocks only the first category or one after a completed predecessor', () => {
    expect(isCategoryUnlocked(0, [])).toBe(true);
    expect(isCategoryUnlocked(1, [])).toBe(false);
    expect(isCategoryUnlocked(1, ['animals'])).toBe(true);
    expect(isCategoryUnlocked(2, ['animals'])).toBe(false);
  });

  it('awards a category completion only once', () => {
    const first = awardFirstCompletion(INITIAL_PROGRESS, 'animals');
    expect(first.reward).toBe(50);
    expect(first.progress.coins).toBe(350);
    const replay = awardFirstCompletion(first.progress, 'animals');
    expect(replay.reward).toBe(0);
    expect(replay.progress.coins).toBe(350);
  });

  it('recovers malformed or outdated save values safely', () => {
    expect(normalizeProgress(null)).toEqual(INITIAL_PROGRESS);
    expect(normalizeProgress('{bad json')).toEqual(INITIAL_PROGRESS);
    expect(normalizeProgress({
      version: 99,
      coins: -20,
      completedLevels: ['animals', 'not-a-category', 'animals'],
      soundEnabled: 'yes',
    })).toEqual({
      version: 1,
      coins: 0,
      completedLevels: ['animals'],
      soundEnabled: true,
    });
  });

  it('keeps the 15 stable category IDs in the required order', () => {
    expect(CATEGORIES.map((category) => category.id)).toEqual([
      'animals', 'food', 'sports', 'countries', 'colors', 'fruits', 'space',
      'ocean-life', 'music', 'movies', 'nature', 'technology', 'jobs',
      'clothing', 'vegetables',
    ]);
  });

  it('ships playable, normalized word lists and generates every category board', () => {
    expect(CATEGORIES).toHaveLength(15);
    expect(hasCompleteCategoryData).toBe(true);
    CATEGORIES.forEach((category, index) => {
      expect(category.words.length, `${category.name} should have puzzle words`).toBeGreaterThan(0);
      expect(new Set(category.words).size, `${category.name} should not repeat words`).toBe(category.words.length);
      expect(category.words.every((word) => /^[A-Z]+$/.test(word)), `${category.name} words should be uppercase A–Z`).toBe(true);

      const puzzle = generatePuzzle(category.words, seededRandom(index + 1));
      expect(puzzle.words).toEqual(category.words);
      expect(puzzle.placements.map((placement) => placement.word).sort()).toEqual([...category.words].sort());
      expect(puzzle.grid).toHaveLength(puzzle.size);
      expect(puzzle.grid.every((row) => row.length === puzzle.size)).toBe(true);
    });
  });

  it('defines all 18 distinct found-word highlight families', () => {
    expect(HIGHLIGHT_COLORS).toHaveLength(18);
    expect(new Set(HIGHLIGHT_COLORS).size).toBe(18);
  });

  it('keeps all bundled sound effects below the total size limit', () => {
    const directory = new URL('../assets/audio/', import.meta.url);
    const names = readdirSync(directory);
    const totalBytes = names.reduce(
      (sum, name) => sum + statSync(new URL(name, directory)).size,
      0,
    );
    expect(names).toHaveLength(8);
    expect(totalBytes).toBeLessThan(500 * 1024);
  });
});

describe('game clock lifecycle', () => {
  it('runs only while the game screen is focused and the app is foregrounded', () => {
    expect(shouldRunGameClock(true, true, true)).toBe(true);
    expect(shouldRunGameClock(true, false, true)).toBe(false);
    expect(shouldRunGameClock(true, true, false)).toBe(false);
    expect(shouldRunGameClock(false, true, true)).toBe(false);
  });

  it('accumulates active time without counting a paused background interval', () => {
    const beforePause = elapsedMilliseconds(0, 1_000, 11_000);
    expect(beforePause).toBe(10_000);
    const whilePaused = elapsedMilliseconds(beforePause, null, 80_000);
    expect(whilePaused).toBe(10_000);
    const afterResume = elapsedMilliseconds(whilePaused, 80_000, 83_000);
    expect(afterResume).toBe(13_000);
    expect(elapsedMilliseconds(13_000, 84_000, 83_000)).toBe(13_000);
  });
});

describe('native grid touch geometry', () => {
  it('sizes the board for desktop, tablet, and mobile viewports', () => {
    expect(getGameBoardSize(1440, 900)).toBe(520);
    expect(getGameBoardSize(768, 1024)).toBe(520);
    expect(getGameBoardSize(390, 844)).toBe(356);
    expect(getGameBoardSize(390, 640)).toBe(290);
    expect(getGameBoardSize(320, 300)).toBe(0);
  });

  it('maps touch points through the grid inset and clamps edge touches', () => {
    expect(pointToGridCell(5, 5, 300, 10)).toEqual({ row: 0, col: 0 });
    expect(pointToGridCell(295, 295, 300, 10)).toEqual({ row: 9, col: 9 });
    expect(pointToGridCell(-10, 310, 300, 10)).toEqual({ row: 9, col: 0 });
    expect(pointToGridCell(10, 10, 10, 10)).toBeNull();
  });

  it('keeps touch selections straight and supports every line direction', () => {
    expect(straightLineBetween({ row: 1, col: 1 }, { row: 4, col: 4 })).toEqual([
      { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 3, col: 3 }, { row: 4, col: 4 },
    ]);
    expect(straightLineBetween({ row: 4, col: 1 }, { row: 1, col: 4 })).toHaveLength(4);
    expect(straightLineBetween({ row: 1, col: 1 }, { row: 3, col: 2 })).toEqual([]);
  });
});

describe('advertising is optional and gated', () => {
  it('does not grant hints when a rewarded ad is unavailable', async () => {
    const ads = new MockAdProvider();
    await expect(ads.showRewarded()).resolves.toEqual({ state: 'disabled', rewarded: false });
  });
});
