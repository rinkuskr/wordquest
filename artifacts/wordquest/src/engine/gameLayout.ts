const MAX_BOARD_SIZE = 520;
const HORIZONTAL_RESERVE = 34;
const VERTICAL_RESERVE = 350;

export function getGameBoardSize(viewportWidth: number, safeViewportHeight: number): number {
  return Math.max(
    0,
    Math.min(
      viewportWidth - HORIZONTAL_RESERVE,
      MAX_BOARD_SIZE,
      safeViewportHeight - VERTICAL_RESERVE,
    ),
  );
}
