import type { Position } from '@/src/types/game';

export function pointToGridCell(
  x: number,
  y: number,
  boardSize: number,
  gridSize: number,
  inset = 5,
): Position | null {
  if (boardSize <= inset * 2 || gridSize <= 0) return null;
  const contentSize = boardSize - inset * 2;
  const col = Math.max(0, Math.min(gridSize - 1, Math.floor(((x - inset) / contentSize) * gridSize)));
  const row = Math.max(0, Math.min(gridSize - 1, Math.floor(((y - inset) / contentSize) * gridSize)));
  return { row, col };
}

export function straightLineBetween(start: Position, end: Position): Position[] {
  const rowDelta = end.row - start.row;
  const colDelta = end.col - start.col;
  const length = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
  if (
    length === 0 ||
    !(rowDelta === 0 || colDelta === 0 || Math.abs(rowDelta) === Math.abs(colDelta))
  ) {
    return [];
  }

  const rowStep = Math.sign(rowDelta);
  const colStep = Math.sign(colDelta);
  return Array.from({ length: length + 1 }, (_, index) => ({
    row: start.row + rowStep * index,
    col: start.col + colStep * index,
  }));
}
