import { resolveRuntimeAdMobConfig } from '../../config/admobRuntimeConfig';

export type AdState = 'disabled' | 'ready' | 'loading' | 'failed';
export type AdResult = { state: AdState; rewarded: boolean };

export type ConsentDebugGeography = 'DISABLED' | 'EEA' | 'OTHER' | 'REGULATED_US_STATE';
export type AdsAgeRestrictedTreatment = 'CHILD' | 'TEEN' | 'UNSPECIFIED';

export interface AdsInitializationOptions {
  /** UMP debug geography is only accepted in development builds. */
  debugGeography?: ConsentDebugGeography;
  /** Hashed test-device IDs reported by the Google Mobile Ads SDK. */
  testDeviceIdentifiers?: string[];
  /**
   * Treatment selected by an approved age-classification strategy.
   * Android initialization fails closed if no explicit treatment is supplied.
   */
  ageRestrictedTreatment?: AdsAgeRestrictedTreatment;
  /** UMP under-age-of-consent tag resolved by the app's age policy. */
  tagForUnderAgeOfConsent?: boolean;
}

export interface AdsProvider {
  readonly state: AdState;
  subscribe(listener: () => void): () => void;
  initialize(options?: AdsInitializationOptions): Promise<AdState>;
  disableForSession(): void;
  showPrivacyOptionsForm(): Promise<boolean>;
  recordCompletedPuzzleTransition(): Promise<AdResult>;
  showRewarded(): Promise<AdResult>;
}

export const COMPLETIONS_PER_INTERSTITIAL = 3;
export const INTERSTITIAL_MIN_INTERVAL_MS = 3 * 60 * 1000;
export const INTERSTITIAL_STORAGE_KEY = '@wordquest/ads/interstitial-schedule';

export interface InterstitialSchedule {
  completedSinceLastShown: number;
  lastShownAt: number;
}

export const INITIAL_INTERSTITIAL_SCHEDULE: InterstitialSchedule = {
  completedSinceLastShown: 0,
  lastShownAt: 0,
};

export function recordPuzzleCompletion(
  current: InterstitialSchedule,
  now: number,
): { schedule: InterstitialSchedule; eligible: boolean } {
  const schedule = {
    ...current,
    completedSinceLastShown: current.completedSinceLastShown + 1,
  };
  const intervalPassed =
    schedule.lastShownAt === 0 || now - schedule.lastShownAt >= INTERSTITIAL_MIN_INTERVAL_MS;

  return {
    schedule,
    eligible:
      schedule.completedSinceLastShown >= COMPLETIONS_PER_INTERSTITIAL && intervalPassed,
  };
}

export function markInterstitialShown(
  schedule: InterstitialSchedule,
  now: number,
): InterstitialSchedule {
  return { completedSinceLastShown: 0, lastShownAt: now };
}

/**
 * Production values are inlined from the selected EAS environment. Missing or
 * invalid production values fail closed instead of selecting test IDs.
 */
export const nativeAdsConfig = resolveRuntimeAdMobConfig({
  EXPO_PUBLIC_ADMOB_PROFILE: process.env.EXPO_PUBLIC_ADMOB_PROFILE,
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
  EXPO_PUBLIC_ADMOB_IOS_APP_ID: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
  EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID,
  EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID:
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID,
  EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID,
});

/**
 * Safe no-op provider for web, unsupported platforms, and tests.
 * It intentionally never initializes the native SDK or requests an ad.
 */
export class MockAdProvider implements AdsProvider {
  readonly state: AdState = 'disabled';

  subscribe(_listener: () => void): () => void {
    return () => undefined;
  }

  async initialize(): Promise<AdState> {
    return this.state;
  }

  disableForSession(): void {}

  async showPrivacyOptionsForm(): Promise<boolean> {
    return false;
  }

  async recordCompletedPuzzleTransition(): Promise<AdResult> {
    return { state: this.state, rewarded: false };
  }

  async showRewarded(): Promise<AdResult> {
    return { state: this.state, rewarded: false };
  }
}
