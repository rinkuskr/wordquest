export type AdState = 'disabled' | 'ready' | 'loading' | 'failed';
export type AdResult = { state: AdState; rewarded: boolean };

export type ConsentDebugGeography = 'DISABLED' | 'EEA' | 'OTHER' | 'REGULATED_US_STATE';

export interface AdsInitializationOptions {
  /** UMP debug geography is only accepted in development builds. */
  debugGeography?: ConsentDebugGeography;
  /** Hashed test-device IDs reported by the Google Mobile Ads SDK. */
  testDeviceIdentifiers?: string[];
}

export interface AdsProvider {
  readonly state: AdState;
  initialize(options?: AdsInitializationOptions): Promise<AdState>;
  shouldShowInterstitial(now?: number, gestureActive?: boolean): boolean;
  showInterstitial(now?: number): Promise<AdResult>;
  showRewarded(): Promise<AdResult>;
}

/** Google sample IDs only. Replace only after a separate production review. */
export const nativeAdsConfig = {
  androidAppId: 'ca-app-pub-3940256099942544~3347511713',
  iosAppId: 'ca-app-pub-3940256099942544~1458002511',
  bannerUnitId: 'ca-app-pub-3940256099942544/6300978111',
  interstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
  rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
} as const;

/**
 * Safe no-op provider for web, unsupported platforms, and tests.
 * It intentionally never initializes the native SDK or requests an ad.
 */
export class MockAdProvider implements AdsProvider {
  readonly state: AdState = 'disabled';
  private lastInterstitialAt = 0;
  private eligibleTransitionCount = 0;

  async initialize(): Promise<AdState> {
    return this.state;
  }

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
