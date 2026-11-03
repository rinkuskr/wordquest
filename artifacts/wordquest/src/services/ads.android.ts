import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  AgeRestrictedTreatment,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';
import {
  DEFAULT_AGE_RESTRICTED_TREATMENT,
  INITIAL_INTERSTITIAL_SCHEDULE,
  INTERSTITIAL_STORAGE_KEY,
  markInterstitialShown,
  nativeAdsConfig,
  recordPuzzleCompletion,
} from './ads.core';
import type {
  AdsInitializationOptions,
  AdsAgeRestrictedTreatment,
  AdsProvider,
  AdResult,
  AdState,
  InterstitialSchedule,
} from './ads.core';

export * from './ads.core';

const REWARDED_AD_TIMEOUT_MS = 30_000;
const INTERSTITIAL_RETRY_DELAY_MS = 30_000;

const GOOGLE_AGE_TREATMENTS: Record<AdsAgeRestrictedTreatment, AgeRestrictedTreatment> = {
  CHILD: AgeRestrictedTreatment.CHILD,
  TEEN: AgeRestrictedTreatment.TEEN,
  UNSPECIFIED: AgeRestrictedTreatment.UNSPECIFIED,
};

/**
 * Android-only Google Mobile Ads provider.
 * Every ad request is gated by a completed UMP check and canRequestAds.
 */
export class AndroidAdProvider implements AdsProvider {
  private currentState: AdState = 'disabled';
  private initialized = false;
  private consentAllowsAds = false;
  private initialization?: Promise<AdState>;
  private readonly listeners = new Set<() => void>();
  private interstitialAd?: InterstitialAd;
  private interstitialLoaded = false;
  private interstitialLoading = false;
  private interstitialShowing = false;
  private interstitialScheduleMarked = false;
  private interstitialSubscriptions: Array<() => void> = [];
  private interstitialRetry?: ReturnType<typeof setTimeout>;
  private lastInterstitialShownAt = 0;
  private rewardedRequestActive = false;
  private ageRestrictedTreatment: AdsAgeRestrictedTreatment = DEFAULT_AGE_RESTRICTED_TREATMENT;

  get state(): AdState {
    return this.currentState;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(state: AdState) {
    if (this.currentState === state) return;
    this.currentState = state;
    this.listeners.forEach((listener) => listener());
  }

  async initialize(options?: AdsInitializationOptions): Promise<AdState> {
    if (this.initialized) return this.currentState;
    if (this.initialization) return this.initialization;
    if (options?.ageRestrictedTreatment) {
      this.ageRestrictedTreatment = options.ageRestrictedTreatment;
    }

    this.setState('loading');
    this.initialization = this.initializeAfterConsent(options).finally(() => {
      this.initialization = undefined;
    });
    return this.initialization;
  }

  private async initializeAfterConsent(options?: AdsInitializationOptions): Promise<AdState> {
    try {
      if (
        options &&
        !__DEV__ &&
        (options.debugGeography || options.testDeviceIdentifiers?.length)
      ) {
        this.setState('failed');
        return this.currentState;
      }

      const consentOptions = __DEV__ && options
        ? {
            ...(options.debugGeography
              ? { debugGeography: AdsConsentDebugGeography[options.debugGeography] }
              : {}),
            ...(options.testDeviceIdentifiers?.length
              ? { testDeviceIdentifiers: options.testDeviceIdentifiers }
              : {}),
          }
        : {};

      const adsSdk = mobileAds();
      await adsSdk.setRequestConfiguration({
        ageRestrictedTreatment: GOOGLE_AGE_TREATMENTS[this.ageRestrictedTreatment],
      });

      let canRequestAds: boolean;
      try {
        const consent = await AdsConsent.gatherConsent(consentOptions);
        canRequestAds = consent.canRequestAds;
      } catch {
        // UMP's cached state is used only when it explicitly permits requests.
        canRequestAds = (await AdsConsent.getConsentInfo()).canRequestAds;
      }

      this.consentAllowsAds = canRequestAds;
      if (!canRequestAds) {
        this.setState('disabled');
        return this.currentState;
      }

      await adsSdk.initialize();
      this.initialized = true;
      this.setState('ready');
      this.preloadInterstitial();
      return this.currentState;
    } catch {
      this.consentAllowsAds = false;
      this.setState('failed');
      return this.currentState;
    }
  }

  async showPrivacyOptionsForm(): Promise<boolean> {
    try {
      const currentConsent = await AdsConsent.getConsentInfo();
      if (
        currentConsent.privacyOptionsRequirementStatus !==
        AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
      ) {
        return false;
      }

      const updatedConsent = await AdsConsent.showPrivacyOptionsForm();
      this.consentAllowsAds = updatedConsent.canRequestAds;

      if (!this.consentAllowsAds) {
        this.setState('disabled');
        this.clearInterstitial(this.interstitialAd);
        return true;
      }

      if (!this.initialized) {
        await this.initialize();
      } else {
        this.setState('ready');
        this.preloadInterstitial();
      }
      return true;
    } catch {
      return false;
    }
  }

  async recordCompletedPuzzleTransition(): Promise<AdResult> {
    if (!this.initialized || !this.consentAllowsAds || this.currentState !== 'ready') {
      return { state: 'disabled', rewarded: false };
    }

    try {
      const currentSchedule = await this.readInterstitialSchedule();
      const now = Date.now();
      const decision = recordPuzzleCompletion(currentSchedule, now);
      await this.writeInterstitialSchedule(decision.schedule);

      if (!decision.eligible || !this.interstitialAd || !this.interstitialLoaded || this.interstitialShowing) {
        return { state: 'ready', rewarded: false };
      }

      const ad = this.interstitialAd;
      this.interstitialLoaded = false;
      this.interstitialShowing = true;
      this.interstitialScheduleMarked = false;
      try {
        await ad.show();
        this.markInterstitialShownNow();
        return { state: 'ready', rewarded: false };
      } catch {
        this.clearInterstitial(ad);
        this.scheduleInterstitialRetry();
        return { state: 'failed', rewarded: false };
      }
    } catch {
      return { state: 'failed', rewarded: false };
    }
  }

  async showRewarded(): Promise<AdResult> {
    if (!this.initialized || !this.consentAllowsAds || this.currentState !== 'ready') {
      return { state: 'disabled', rewarded: false };
    }
    if (this.rewardedRequestActive) {
      return { state: 'loading', rewarded: false };
    }

    this.rewardedRequestActive = true;
    try {
      const ad = RewardedAd.createForAdRequest(nativeAdsConfig.rewardedUnitId);
      return await new Promise<AdResult>((resolve) => {
        let settled = false;
        let rewardEarned = false;
        const subscriptions: Array<() => void> = [];
        const timeout = setTimeout(
          () => finish({ state: 'failed', rewarded: false }),
          REWARDED_AD_TIMEOUT_MS,
        );
        const finish = (result: AdResult) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          subscriptions.forEach((unsubscribe) => unsubscribe());
          resolve(result);
        };

        subscriptions.push(
          ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
            void ad.show().catch(() => finish({ state: 'failed', rewarded: false }));
          }),
          ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
            rewardEarned = true;
          }),
          ad.addAdEventListener(AdEventType.ERROR, () =>
            finish({ state: 'failed', rewarded: false }),
          ),
          ad.addAdEventListener(AdEventType.CLOSED, () =>
            finish({ state: 'ready', rewarded: rewardEarned }),
          ),
        );

        try {
          ad.load();
        } catch {
          finish({ state: 'failed', rewarded: false });
        }
      });
    } catch {
      return { state: 'failed', rewarded: false };
    } finally {
      this.rewardedRequestActive = false;
    }
  }

  private async readInterstitialSchedule(): Promise<InterstitialSchedule> {
    const raw = await AsyncStorage.getItem(INTERSTITIAL_STORAGE_KEY);
    if (!raw) return { ...INITIAL_INTERSTITIAL_SCHEDULE, lastShownAt: this.lastInterstitialShownAt };

    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'completedSinceLastShown' in parsed &&
        'lastShownAt' in parsed &&
        typeof parsed.completedSinceLastShown === 'number' &&
        Number.isFinite(parsed.completedSinceLastShown) &&
        parsed.completedSinceLastShown >= 0 &&
        typeof parsed.lastShownAt === 'number' &&
        Number.isFinite(parsed.lastShownAt) &&
        parsed.lastShownAt >= 0
      ) {
        return {
          completedSinceLastShown: Math.floor(parsed.completedSinceLastShown),
          lastShownAt: Math.max(parsed.lastShownAt, this.lastInterstitialShownAt),
        };
      }
    } catch {
      // Corrupt local scheduling state fails closed below.
    }

    return {
      completedSinceLastShown: 0,
      lastShownAt: Math.max(Date.now(), this.lastInterstitialShownAt),
    };
  }

  private async writeInterstitialSchedule(schedule: InterstitialSchedule): Promise<void> {
    await AsyncStorage.setItem(INTERSTITIAL_STORAGE_KEY, JSON.stringify(schedule));
  }

  private markInterstitialShownNow() {
    if (this.interstitialScheduleMarked) return;
    this.interstitialScheduleMarked = true;
    const now = Date.now();
    this.lastInterstitialShownAt = now;
    void (async () => {
      try {
        const schedule = await this.readInterstitialSchedule();
        await this.writeInterstitialSchedule(markInterstitialShown(schedule, now));
      } catch {
        // The in-memory timestamp still enforces the cooldown during this run.
      }
    })();
  }

  private preloadInterstitial() {
    if (
      !this.initialized ||
      !this.consentAllowsAds ||
      this.currentState !== 'ready' ||
      this.interstitialAd ||
      this.interstitialLoading
    ) {
      return;
    }

    if (this.interstitialRetry) {
      clearTimeout(this.interstitialRetry);
      this.interstitialRetry = undefined;
    }

    const ad = InterstitialAd.createForAdRequest(nativeAdsConfig.interstitialUnitId);
    this.interstitialAd = ad;
    this.interstitialLoading = true;
    this.interstitialSubscriptions = [
      ad.addAdEventListener(AdEventType.LOADED, () => {
        if (this.interstitialAd !== ad) return;
        this.interstitialLoading = false;
        this.interstitialLoaded = true;
      }),
      ad.addAdEventListener(AdEventType.OPENED, () => {
        this.markInterstitialShownNow();
      }),
      ad.addAdEventListener(AdEventType.ERROR, () => {
        this.clearInterstitial(ad);
        this.scheduleInterstitialRetry();
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.clearInterstitial(ad);
        this.preloadInterstitial();
      }),
    ];

    try {
      ad.load();
    } catch {
      this.clearInterstitial(ad);
      this.scheduleInterstitialRetry();
    }
  }

  private clearInterstitial(ad?: InterstitialAd) {
    if (!ad || this.interstitialAd !== ad) return;
    this.interstitialSubscriptions.forEach((unsubscribe) => unsubscribe());
    this.interstitialSubscriptions = [];
    this.interstitialAd = undefined;
    this.interstitialLoaded = false;
    this.interstitialLoading = false;
    this.interstitialShowing = false;
    this.interstitialScheduleMarked = false;
  }

  private scheduleInterstitialRetry() {
    if (this.interstitialRetry) clearTimeout(this.interstitialRetry);
    if (!this.initialized || !this.consentAllowsAds) return;
    this.interstitialRetry = setTimeout(() => {
      this.interstitialRetry = undefined;
      this.preloadInterstitial();
    }, INTERSTITIAL_RETRY_DELAY_MS);
  }
}

export const adProvider = new AndroidAdProvider();
