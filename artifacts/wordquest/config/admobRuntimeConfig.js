'use strict';

const {
  resolveAdMobProfile,
  validateProductionAdMobConfig,
} = require('./admobValidation');

function resolveRuntimeAdMobConfig(environment = process.env) {
  if (resolveAdMobProfile(environment) === 'production') {
    return validateProductionAdMobConfig(environment);
  }

  return {
    androidAppId: environment.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID?.trim() ?? '',
    iosAppId: environment.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim() ?? '',
    bannerUnitId: environment.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID?.trim() ?? '',
    interstitialUnitId:
      environment.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID?.trim() ?? '',
    rewardedUnitId: environment.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID?.trim() ?? '',
  };
}

module.exports = { resolveRuntimeAdMobConfig };
