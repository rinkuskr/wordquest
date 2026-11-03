import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => {
  const events: string[] = [];
  const configurations: unknown[] = [];
  let consentAllowsAds = true;
  const storageValues = new Map<string, string>();

  return {
    events,
    configurations,
    setConsentAllowed: (allowed: boolean) => {
      consentAllowsAds = allowed;
    },
    bannerState: 'disabled',
    interstitial: null as any,
    rewarded: null as any,
    setRequestConfiguration: vi.fn(async (configuration: unknown) => {
      events.push('request-configuration');
      configurations.push(configuration);
    }),
    initializeSdk: vi.fn(async () => {
      events.push('sdk-initialize');
    }),
    gatherConsent: vi.fn(async () => {
      events.push('ump-gather');
      return { canRequestAds: consentAllowsAds };
    }),
    showPrivacyOptionsForm: vi.fn(async () => ({ canRequestAds: consentAllowsAds })),
    getConsentInfo: vi.fn(async () => ({
      canRequestAds: consentAllowsAds,
      privacyOptionsRequirementStatus: 'required',
    })),
  };
});

const storage = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: storage.getItem,
    setItem: storage.setItem,
  },
}));

vi.mock('react-native-google-mobile-ads', async () => {
  const ReactModule = await import('react');

  const createAd = (kind: 'interstitial' | 'rewarded') => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const ad = {
      addAdEventListener: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
        return () => listeners.delete(event);
      }),
      load: vi.fn(() => {
        native.events.push(`${kind}-load`);
      }),
      show: vi.fn(async () => {
        native.events.push(`${kind}-show`);
      }),
      emit: (event: string, ...args: unknown[]) => listeners.get(event)?.(...args),
    };
    native[kind] = ad;
    native.events.push(`${kind}-create`);
    return ad;
  };

  const sdk = {
    setRequestConfiguration: native.setRequestConfiguration,
    initialize: native.initializeSdk,
  };

  return {
    default: vi.fn(() => sdk),
    AgeRestrictedTreatment: {
      CHILD: 'child',
      TEEN: 'teen',
      UNSPECIFIED: 'unspecified',
    },
    AdEventType: {
      LOADED: 'loaded',
      OPENED: 'opened',
      ERROR: 'error',
      CLOSED: 'closed',
    },
    AdsConsent: {
      gatherConsent: native.gatherConsent,
      getConsentInfo: native.getConsentInfo,
      showPrivacyOptionsForm: native.showPrivacyOptionsForm,
    },
    AdsConsentDebugGeography: {
      DISABLED: 'disabled',
      EEA: 'eea',
      OTHER: 'other',
      REGULATED_US_STATE: 'regulated-us-state',
    },
    AdsConsentPrivacyOptionsRequirementStatus: {
      REQUIRED: 'required',
    },
    BannerAd: (props: { unitId: string }) =>
      ReactModule.createElement('span', { 'data-banner-id': props.unitId }),
    BannerAdSize: {
      ANCHORED_ADAPTIVE_BANNER: 'anchored-adaptive-banner',
    },
    InterstitialAd: {
      createForAdRequest: vi.fn(() => createAd('interstitial')),
    },
    RewardedAd: {
      createForAdRequest: vi.fn(() => createAd('rewarded')),
    },
    RewardedAdEventType: {
      LOADED: 'loaded',
      EARNED_REWARD: 'earned-reward',
    },
  };
});

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  return {
    StyleSheet: { create: (styles: unknown) => styles },
    View: ({
      children,
      accessibilityLabel,
    }: {
      children: React.ReactNode;
      accessibilityLabel?: string;
    }) =>
      ReactModule.createElement(
        'div',
        { 'aria-label': accessibilityLabel },
        children,
      ),
  };
});

vi.mock('@/hooks/useColors', () => ({
  useColors: () => ({ background: '#ffffff' }),
}));

vi.mock('@/src/services/useAdsState', () => ({
  useAdsState: () => native.bannerState,
}));

let AndroidAdProvider: typeof import('../src/services/ads.android').AndroidAdProvider;
let AdBannerSlot: typeof import('../src/components/AdBannerSlot.android').default;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('__DEV__', true);
  native.events.length = 0;
  native.configurations.length = 0;
  native.bannerState = 'disabled';
  native.interstitial = null;
  native.rewarded = null;
  native.setConsentAllowed(true);
  storage.values.clear();

  const [adsModule, bannerModule] = await Promise.all([
    import('../src/services/ads.android'),
    import('../src/components/AdBannerSlot.android'),
  ]);
  AndroidAdProvider = adsModule.AndroidAdProvider;
  AdBannerSlot = bannerModule.default;
});

describe('Android age-restricted ad treatment', () => {
  it.each([
    ['CHILD', 'child'],
    ['TEEN', 'teen'],
    ['UNSPECIFIED', 'unspecified'],
  ] as const)('sets %s before UMP, initialization, and ad loading', async (selected, sdkValue) => {
    const provider = new AndroidAdProvider();

    await expect(
      provider.initialize({ ageRestrictedTreatment: selected }),
    ).resolves.toBe('ready');

    expect(native.configurations).toEqual([{ ageRestrictedTreatment: sdkValue }]);
    expect(native.events.slice(0, 5)).toEqual([
      'request-configuration',
      'ump-gather',
      'sdk-initialize',
      'interstitial-create',
      'interstitial-load',
    ]);
  });

  it('keeps the current default behavior as explicit UNSPECIFIED treatment', async () => {
    const provider = new AndroidAdProvider();

    await expect(provider.initialize()).resolves.toBe('ready');

    expect(native.configurations).toEqual([{ ageRestrictedTreatment: 'unspecified' }]);
    expect(native.gatherConsent).toHaveBeenCalledWith({});
    expect(native.events.indexOf('request-configuration')).toBeLessThan(
      native.events.indexOf('ump-gather'),
    );
  });

  it('does not initialize or request ads when UMP does not permit requests', async () => {
    native.setConsentAllowed(false);
    const provider = new AndroidAdProvider();

    await expect(
      provider.initialize({ ageRestrictedTreatment: 'TEEN' }),
    ).resolves.toBe('disabled');

    expect(native.configurations).toEqual([{ ageRestrictedTreatment: 'teen' }]);
    expect(native.events).toEqual(['request-configuration', 'ump-gather']);
    expect(provider.state).toBe('disabled');
  });

  it('retains the selected treatment when consent is granted later through privacy options', async () => {
    native.setConsentAllowed(false);
    const provider = new AndroidAdProvider();
    await expect(
      provider.initialize({ ageRestrictedTreatment: 'CHILD' }),
    ).resolves.toBe('disabled');

    native.setConsentAllowed(true);
    await expect(provider.showPrivacyOptionsForm()).resolves.toBe(true);

    expect(native.configurations).toEqual([
      { ageRestrictedTreatment: 'child' },
      { ageRestrictedTreatment: 'child' },
    ]);
    expect(provider.state).toBe('ready');
  });

  it('fails closed if request configuration cannot be applied', async () => {
    native.setRequestConfiguration.mockRejectedValueOnce(
      new Error('simulated configuration failure'),
    );
    const provider = new AndroidAdProvider();

    await expect(
      provider.initialize({ ageRestrictedTreatment: 'TEEN' }),
    ).resolves.toBe('failed');

    expect(native.gatherConsent).not.toHaveBeenCalled();
    expect(native.initializeSdk).not.toHaveBeenCalled();
    expect(native.interstitial).toBeNull();
  });

  it('does not request any ad format before configuration, consent, and SDK initialization', async () => {
    const provider = new AndroidAdProvider();
    const disabledBanner = renderToStaticMarkup(createElement(AdBannerSlot));

    await expect(provider.showRewarded()).resolves.toEqual({
      state: 'disabled',
      rewarded: false,
    });
    await expect(provider.recordCompletedPuzzleTransition()).resolves.toEqual({
      state: 'disabled',
      rewarded: false,
    });

    expect(disabledBanner).toBe('');
    expect(native.events).toEqual([]);
  });

  it('applies the one global treatment before banner, rewarded, and interstitial requests', async () => {
    const provider = new AndroidAdProvider();
    await provider.initialize({ ageRestrictedTreatment: 'TEEN' });

    native.bannerState = provider.state;
    const bannerMarkup = renderToStaticMarkup(createElement(AdBannerSlot));
    expect(bannerMarkup).toContain('data-banner-id="ca-app-pub-3940256099942544/6300978111"');

    native.interstitial.emit('loaded');
    const first = await provider.recordCompletedPuzzleTransition();
    const second = await provider.recordCompletedPuzzleTransition();
    const third = await provider.recordCompletedPuzzleTransition();
    expect([first.state, second.state, third.state]).toEqual(['ready', 'ready', 'ready']);

    const rewardPromise = provider.showRewarded();
    native.rewarded.emit('loaded');
    native.rewarded.emit('earned-reward');
    native.rewarded.emit('closed');
    await expect(rewardPromise).resolves.toEqual({ state: 'ready', rewarded: true });

    expect(native.configurations).toEqual([{ ageRestrictedTreatment: 'teen' }]);
    expect(native.events.indexOf('request-configuration')).toBeLessThan(
      native.events.indexOf('interstitial-create'),
    );
    expect(native.events.indexOf('request-configuration')).toBeLessThan(
      native.events.indexOf('interstitial-show'),
    );
    expect(native.events.indexOf('request-configuration')).toBeLessThan(
      native.events.indexOf('rewarded-create'),
    );
    expect(native.events.indexOf('request-configuration')).toBeLessThan(
      native.events.indexOf('rewarded-load'),
    );
    expect(native.events.indexOf('request-configuration')).toBeLessThan(
      native.events.indexOf('rewarded-show'),
    );
  });
});
