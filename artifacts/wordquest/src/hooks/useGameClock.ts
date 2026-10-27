import { useEffect } from 'react';

export function useGameClock({
  active,
  resumeClock,
  pauseClock,
  syncClock,
}: {
  active: boolean;
  resumeClock: () => void;
  pauseClock: () => void;
  syncClock: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    resumeClock();
    const timer = setInterval(syncClock, 250);
    return () => {
      clearInterval(timer);
      pauseClock();
    };
  }, [active, pauseClock, resumeClock, syncClock]);
}
