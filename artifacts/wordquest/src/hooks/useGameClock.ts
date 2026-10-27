import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { shouldRunGameClock } from '@/src/engine/gameClock';

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
  const screenFocused = useIsFocused();
  const [appForegrounded, setAppForegrounded] = useState(
    AppState.currentState === 'active',
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pauseClock();
      setAppForegrounded(state === 'active');
    });
    return () => subscription.remove();
  }, [pauseClock]);

  useEffect(() => {
    if (!shouldRunGameClock(active, screenFocused, appForegrounded)) {
      pauseClock();
      return;
    }

    resumeClock();
    const timer = setInterval(syncClock, 250);
    return () => {
      clearInterval(timer);
      pauseClock();
    };
  }, [active, screenFocused, appForegrounded, pauseClock, resumeClock, syncClock]);
}
