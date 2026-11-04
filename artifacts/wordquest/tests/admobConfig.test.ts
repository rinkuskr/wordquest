import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  REQUIRED_PRODUCTION_KEYS,
  TEST_ADMOB_CONFIG,
  resolveAdMobConfig,
} from '../config/admobConfig';
import { resolveRuntimeAdMobConfig } from '../config/admobRuntimeConfig';

const SAMPLE_PRODUCTION_ENV = {
  EXPO_PUBLIC_ADMOB_PROFILE: 'production',
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: TEST_ADMOB_CONFIG.androidAppId,
  EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: TEST_ADMOB_CONFIG.bannerUnitId,
  EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID: TEST_ADMOB_CONFIG.interstitialUnitId,
  EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: TEST_ADMOB_CONFIG.rewardedUnitId,
};

describe('AdMob build configuration', () => {
  it("uses Google's official sample IDs for local development by default", () => {
    expect(resolveAdMobConfig({})).toEqual(TEST_ADMOB_CONFIG);
  });

  it('keeps preview on sample IDs even if production values are present', () => {
    expect(
      resolveAdMobConfig({
        ...SAMPLE_PRODUCTION_ENV,
        EXPO_PUBLIC_ADMOB_PROFILE: 'test',
      }),
    ).toEqual(TEST_ADMOB_CONFIG);
  });

  it('fails a production EAS profile when production IDs are missing', () => {
    const resolve = () => resolveAdMobConfig({ EAS_BUILD_PROFILE: 'production' });

    expect(resolve).toThrow(/Production configuration is incomplete/);
    for (const key of REQUIRED_PRODUCTION_KEYS) {
      expect(resolve).toThrow(key);
    }
    expect(resolve).toThrow(/never fall back to Google test IDs/);
  });

  it('rejects Google sample IDs in production', () => {
    expect(() => resolveAdMobConfig(SAMPLE_PRODUCTION_ENV)).toThrow(
      /Google sample\/test IDs are forbidden in production/,
    );
  });

  it('keeps test IDs out of the runtime resolver and requires IDs through its environment', () => {
    const runtimeSource = readFileSync(
      new URL('../config/admobRuntimeConfig.js', import.meta.url),
      'utf8',
    );
    const validationSource = readFileSync(
      new URL('../config/admobValidation.js', import.meta.url),
      'utf8',
    );
    expect(runtimeSource).not.toContain('ca-app-pub-3940256099942544');
    expect(validationSource).not.toContain('ca-app-pub-3940256099942544');

    expect(
      resolveRuntimeAdMobConfig({ EXPO_PUBLIC_ADMOB_PROFILE: 'test' }),
    ).toMatchObject({
      androidAppId: '',
      bannerUnitId: '',
      interstitialUnitId: '',
      rewardedUnitId: '',
    });
    expect(
      resolveRuntimeAdMobConfig({
        EXPO_PUBLIC_ADMOB_PROFILE: 'test',
        EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: TEST_ADMOB_CONFIG.androidAppId,
        EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: TEST_ADMOB_CONFIG.bannerUnitId,
        EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID: TEST_ADMOB_CONFIG.interstitialUnitId,
        EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: TEST_ADMOB_CONFIG.rewardedUnitId,
      }),
    ).toMatchObject(TEST_ADMOB_CONFIG);
  });

  it('rejects malformed production IDs without printing their values', () => {
    const environment = Object.fromEntries(
      REQUIRED_PRODUCTION_KEYS.map((key) => [key, 'not-an-admob-id']),
    );

    let error: Error | undefined;
    try {
      resolveAdMobConfig({
        ...environment,
        EXPO_PUBLIC_ADMOB_PROFILE: 'production',
      });
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message).toMatch(/Invalid production AdMob ID format/);
    expect(error?.message).not.toContain('not-an-admob-id');
  });

  it('rejects unknown profile values', () => {
    expect(() =>
      resolveAdMobConfig({ EXPO_PUBLIC_ADMOB_PROFILE: 'release' }),
    ).toThrow(/Unsupported ad profile/);
  });

  it('keeps the internal APK profile and adds a production AAB profile', () => {
    const eas = JSON.parse(
      readFileSync(new URL('../eas.json', import.meta.url), 'utf8'),
    );
    const app = JSON.parse(
      readFileSync(new URL('../app.json', import.meta.url), 'utf8'),
    ).expo;

    expect(eas.build.preview).toMatchObject({
      distribution: 'internal',
      environment: 'preview',
      env: {
        EXPO_PUBLIC_ADMOB_PROFILE: 'test',
        EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: TEST_ADMOB_CONFIG.androidAppId,
        EXPO_PUBLIC_ADMOB_IOS_APP_ID: TEST_ADMOB_CONFIG.iosAppId,
        EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: TEST_ADMOB_CONFIG.bannerUnitId,
        EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID: TEST_ADMOB_CONFIG.interstitialUnitId,
        EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: TEST_ADMOB_CONFIG.rewardedUnitId,
      },
      android: { buildType: 'apk', image: 'latest' },
    });
    expect(eas.build.production).toMatchObject({
      distribution: 'store',
      environment: 'production',
      autoIncrement: true,
      env: { EXPO_PUBLIC_ADMOB_PROFILE: 'production' },
      android: { buildType: 'app-bundle', image: 'latest' },
    });

    for (const key of REQUIRED_PRODUCTION_KEYS) {
      expect(eas.build.production.env[key]).toBeUndefined();
    }
    expect(app.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ]),
    );
  });
});
