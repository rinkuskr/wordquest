export type AdState = 'disabled' | 'ready' | 'loading' | 'failed';
export type AdResult = { state: AdState; rewarded: boolean };

export const nativeAdsConfig = {
  appId: '',
  interstitialUnitId: '',
  rewardedUnitId: '',
} as const;

/**
 * AdMob stays disabled until real IDs and a native ads build are configured.
 * No core game action relies on an ad result.
 */
export class MockAdProvider {
  readonly state: AdState = 'disabled';
  private lastInterstitialAt = 0;
  private eligibleTransitionCount = 0;

  shouldShowInterstitial(now = Date.now(), gestureActive = false): boolean {
    if (gestureActive) return false;
    this.eligibleTransitionCount += 1;
    const everySecondEligible = this.eligibleTransitionCount % 2 === 0;
    if (!everySecondEligible || now - this.lastInterstitialAt < 60_000) return false;
    this.lastInterstitialAt = now;
    return true;
  }

  async showInterstitial(now = Date.now()): Promise<AdResult> {
    this.shouldShowInterstitial(now);
    return { state: this.state, rewarded: false };
  }

  async showRewarded(): Promise<AdResult> {
    return { state: this.state, rewarded: false };
  }
}

export const adProvider = new MockAdProvider();
