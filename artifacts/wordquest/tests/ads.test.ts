import { describe, expect, it } from 'vitest';
import {
  COMPLETIONS_PER_INTERSTITIAL,
  INITIAL_INTERSTITIAL_SCHEDULE,
  INTERSTITIAL_MIN_INTERVAL_MS,
  INTERSTITIAL_STORAGE_KEY,
  markInterstitialShown,
  MockAdProvider,
  nativeAdsConfig,
  recordPuzzleCompletion,
} from '../src/services/ads';

describe('native ads foundation', () => {
  it('contains only Google sample app and ad unit IDs', () => {
    expect(nativeAdsConfig).toEqual({
      androidAppId: 'ca-app-pub-3940256099942544~3347511713',
      iosAppId: 'ca-app-pub-3940256099942544~1458002511',
      bannerUnitId: 'ca-app-pub-3940256099942544/6300978111',
      interstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
      rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
    });
  });

  it('keeps the fallback provider disabled and non-rewarding', async () => {
    const provider = new MockAdProvider();
    await expect(provider.initialize()).resolves.toBe('disabled');
    await expect(provider.showPrivacyOptionsForm()).resolves.toBe(false);
    await expect(provider.recordCompletedPuzzleTransition()).resolves.toEqual({
      state: 'disabled',
      rewarded: false,
    });
    await expect(provider.showRewarded()).resolves.toEqual({
      state: 'disabled',
      rewarded: false,
    });
  });

  it('allows an interstitial after three completed puzzles', () => {
    let schedule = { ...INITIAL_INTERSTITIAL_SCHEDULE };
    for (let completed = 1; completed < COMPLETIONS_PER_INTERSTITIAL; completed += 1) {
      const result = recordPuzzleCompletion(schedule, completed * 10_000);
      schedule = result.schedule;
      expect(result.eligible).toBe(false);
    }

    const result = recordPuzzleCompletion(schedule, 30_000);
    expect(result.eligible).toBe(true);
    expect(result.schedule.completedSinceLastShown).toBe(3);
  });

  it('keeps the interval and completion threshold after a cooldown blocks an ad', () => {
    const shownAt = 100_000;
    let schedule = markInterstitialShown(
      { completedSinceLastShown: 3, lastShownAt: 0 },
      shownAt,
    );

    for (let completed = 1; completed <= 3; completed += 1) {
      const result = recordPuzzleCompletion(schedule, shownAt + completed * 20_000);
      schedule = result.schedule;
      expect(result.eligible).toBe(false);
    }

    const stillCoolingDown = recordPuzzleCompletion(
      schedule,
      shownAt + INTERSTITIAL_MIN_INTERVAL_MS - 1,
    );
    expect(stillCoolingDown.eligible).toBe(false);

    const afterCooldown = recordPuzzleCompletion(
      stillCoolingDown.schedule,
      shownAt + INTERSTITIAL_MIN_INTERVAL_MS,
    );
    expect(afterCooldown.eligible).toBe(true);
    expect(afterCooldown.schedule.completedSinceLastShown).toBe(5);
  });

  it('starts a fresh three-completion interval after an ad is shown', () => {
    const afterShown = markInterstitialShown(
      { completedSinceLastShown: 3, lastShownAt: 0 },
      10_000,
    );
    const first = recordPuzzleCompletion(afterShown, 20_000);
    const second = recordPuzzleCompletion(first.schedule, 30_000);
    const third = recordPuzzleCompletion(second.schedule, 40_000);

    expect(first.eligible).toBe(false);
    expect(second.eligible).toBe(false);
    expect(third.eligible).toBe(false);
    expect(third.schedule.completedSinceLastShown).toBe(3);
  });

  it('uses a dedicated persistent schedule key', () => {
    expect(INTERSTITIAL_STORAGE_KEY).toBe('@wordquest/ads/interstitial-schedule');
  });
});
