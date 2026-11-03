import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getUtcDateKey } from '@/src/engine/dailyChallenge';

export function useUtcDateKey(): string {
  const [dateKey, setDateKey] = useState(() => getUtcDateKey(new Date()));

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const refreshAndSchedule = () => {
      const now = new Date();
      setDateKey(getUtcDateKey(now));
      const nextMidnight = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
      );
      timeout = setTimeout(refreshAndSchedule, Math.max(250, nextMidnight - now.getTime() + 50));
    };

    refreshAndSchedule();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearTimeout(timeout);
        refreshAndSchedule();
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, []);

  return dateKey;
}
