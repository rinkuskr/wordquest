import { describe, expect, it } from 'vitest';
import { MockAdProvider, nativeAdsConfig } from '../src/services/ads';

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
    await expect(provider.showInterstitial()).resolves.toEqual({
      state: 'disabled',
      rewarded: false,
    });
    await expect(provider.showRewarded()).resolves.toEqual({
      state: 'disabled',
      rewarded: false,
    });
  });
});
