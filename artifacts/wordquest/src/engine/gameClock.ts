export function shouldRunGameClock(
  gameActive: boolean,
  screenFocused: boolean,
  appForegrounded: boolean,
): boolean {
  return gameActive && screenFocused && appForegrounded;
}

export function elapsedMilliseconds(
  accumulatedMs: number,
  runningSince: number | null,
  now: number,
): number {
  return accumulatedMs + (
    runningSince === null ? 0 : Math.max(0, now - runningSince)
  );
}

export function monotonicNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}
