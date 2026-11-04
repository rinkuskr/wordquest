'use strict';

const REQUIRED_PRODUCTION_KEYS = Object.freeze([
  'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID',
  'EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID',
  'EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID',
  'EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID',
]);

const PRODUCTION_ID_PATTERNS = Object.freeze({
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: /^ca-app-pub-(\d{16})~\d{10}$/,
  EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: /^ca-app-pub-(\d{16})\/\d{10}$/,
  EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID: /^ca-app-pub-(\d{16})\/\d{10}$/,
  EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: /^ca-app-pub-(\d{16})\/\d{10}$/,
});

const GOOGLE_TEST_PUBLISHER_ID = '3940256099942544';

function resolveAdMobProfile(environment = process.env) {
  const requestedProfile = environment.EXPO_PUBLIC_ADMOB_PROFILE;
  const profile =
    requestedProfile ||
    (environment.EAS_BUILD_PROFILE === 'production' ? 'production' : 'test');

  if (!['test', 'preview', 'development', 'production'].includes(profile)) {
    throw new Error(
      `[WordQuest AdMob] Unsupported ad profile "${profile}". Use test or production.`,
    );
  }
  return profile;
}

function validateProductionAdMobConfig(environment) {
  const missing = REQUIRED_PRODUCTION_KEYS.filter(
    (key) => typeof environment[key] !== 'string' || environment[key].trim() === '',
  );
  if (missing.length > 0) {
    throw new Error(
      `[WordQuest AdMob] Production configuration is incomplete. Set these variables in the Expo project's production environment: ${missing.join(', ')}. Production builds never fall back to Google test IDs.`,
    );
  }

  const normalized = Object.fromEntries(
    REQUIRED_PRODUCTION_KEYS.map((key) => [key, environment[key].trim()]),
  );
  const invalid = REQUIRED_PRODUCTION_KEYS.filter(
    (key) => !PRODUCTION_ID_PATTERNS[key].test(normalized[key]),
  );
  if (invalid.length > 0) {
    throw new Error(
      `[WordQuest AdMob] Invalid production AdMob ID format for: ${invalid.join(', ')}.`,
    );
  }

  const publisherIds = new Set(
    REQUIRED_PRODUCTION_KEYS.map((key) =>
      normalized[key].match(PRODUCTION_ID_PATTERNS[key])[1],
    ),
  );
  if (publisherIds.has(GOOGLE_TEST_PUBLISHER_ID)) {
    throw new Error(
      '[WordQuest AdMob] Google sample/test IDs are forbidden in production.',
    );
  }
  if (publisherIds.size !== 1) {
    throw new Error(
      '[WordQuest AdMob] Production App ID and ad-unit IDs must belong to the same AdMob publisher.',
    );
  }

  return {
    androidAppId: normalized.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
    bannerUnitId: normalized.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID,
    interstitialUnitId: normalized.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID,
    rewardedUnitId: normalized.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID,
  };
}

module.exports = {
  REQUIRED_PRODUCTION_KEYS,
  resolveAdMobProfile,
  validateProductionAdMobConfig,
};
