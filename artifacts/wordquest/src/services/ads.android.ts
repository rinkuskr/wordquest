import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentDebugGeography,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';
import {
  AdsInitializationOptions,
  AdsProvider,
  AdResult,
  AdState,
  MockAdProvider,
  nativeAdsConfig,
} from './ads.core';

export * from './ads.core';

/**
 * Native Android provider. It remains dormant until initialize() is called by
 * a later ad-placement phase. That keeps all existing screens ad-free now.
 */
export class AndroidAdProvider implements AdsProvider {
  private currentState: AdState = 'disabled';
  private initialized = false;
  private initialization?: Promise<AdState>;
  private readonly interstitialPolicy = new MockAdProvider();

  get state(): AdState {
    return this.currentState;
  }

  async initialize(options?: AdsInitializationOptions): Promise<AdState> {
    if (this.initialized) return this.currentState;
    if (this.initialization) return this.initialization;

    this.currentState = 'loading';
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
        this.currentState = 'failed';
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

      let canRequestAds = false;
      try {
        const consent = await AdsConsent.gatherConsent(consentOptions);
        canRequestAds = consent.canRequestAds;
      } catch {
        // UMP may fail to refresh; use its cached result only if it still
        // explicitly allows ad requests.
        canRequestAds = (await AdsConsent.getConsentInfo()).canRequestAds;
      }

      if (!canRequestAds) {
        this.currentState = 'disabled';
        return this.currentState;
      }

      await mobileAds().initialize();
      this.initialized = true;
      this.currentState = 'ready';
      return this.currentState;
    } catch {
      this.currentState = 'failed';
      return this.currentState;
    }
  }

  shouldShowInterstitial(now = Date.now(), gestureActive = false): boolean {
    return this.interstitialPolicy.shouldShowInterstitial(now, gestureActive);
  }

  async showInterstitial(now = Date.now()): Promise<AdResult> {
    if (!this.initialized || this.currentState !== 'ready') {
      return { state: 'disabled', rewarded: false };
    }
    if (!this.shouldShowInterstitial(now)) {
      return { state: this.currentState, rewarded: false };
    }

    const ad = InterstitialAd.createForAdRequest(nativeAdsConfig.interstitialUnitId);
    return new Promise((resolve) => {
      let settled = false;
      const subscriptions: Array<() => void> = [];
      const finish = (result: AdResult) => {
        if (settled) return;
        settled = true;
        subscriptions.forEach((unsubscribe) => unsubscribe());
        resolve(result);
      };

      subscriptions.push(
        ad.addAdEventListener(AdEventType.LOADED, () => {
          void ad.show().catch(() => finish({ state: 'failed', rewarded: false }));
        }),
        ad.addAdEventListener(AdEventType.ERROR, () =>
          finish({ state: 'failed', rewarded: false }),
        ),
        ad.addAdEventListener(AdEventType.CLOSED, () =>
          finish({ state: 'ready', rewarded: false }),
        ),
      );

      try {
        ad.load();
      } catch {
        finish({ state: 'failed', rewarded: false });
      }
    });
  }

  async showRewarded(): Promise<AdResult> {
    if (!this.initialized || this.currentState !== 'ready') {
      return { state: 'disabled', rewarded: false };
    }

    const ad = RewardedAd.createForAdRequest(nativeAdsConfig.rewardedUnitId);
    return new Promise((resolve) => {
      let settled = false;
      let rewardEarned = false;
      const subscriptions: Array<() => void> = [];
      const finish = (result: AdResult) => {
        if (settled) return;
        settled = true;
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
  }
}

export const adProvider = new AndroidAdProvider();
