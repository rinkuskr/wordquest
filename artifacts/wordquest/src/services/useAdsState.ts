import { useSyncExternalStore } from 'react';
import { adProvider } from './ads';

const subscribe = (listener: () => void) => adProvider.subscribe(listener);
const getSnapshot = () => adProvider.state;
const getServerSnapshot = () => 'disabled' as const;

export function useAdsState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
