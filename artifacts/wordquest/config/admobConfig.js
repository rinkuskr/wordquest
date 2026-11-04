'use strict';

const {
  REQUIRED_PRODUCTION_KEYS,
  resolveAdMobProfile,
  validateProductionAdMobConfig,
} = require('./admobValidation');

const TEST_ADMOB_CONFIG = Object.freeze({
  androidAppId: 'ca-app-pub-3940256099942544~3347511713',
  iosAppId: 'ca-app-pub-3940256099942544~1458002511',
  bannerUnitId: 'ca-app-pub-3940256099942544/6300978111',
  interstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
  rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
});

function resolveAdMobConfig(environment = process.env) {
  if (resolveAdMobProfile(environment) !== 'production') {
    return { ...TEST_ADMOB_CONFIG };
  }

  const productionConfig = validateProductionAdMobConfig(environment);
  if (
    Object.values(productionConfig).some((value) =>
      Object.values(TEST_ADMOB_CONFIG).includes(value),
    )
  ) {
    throw new Error(
      '[WordQuest AdMob] Google sample/test IDs are forbidden in production.',
    );
  }
  return productionConfig;
}

module.exports = {
  REQUIRED_PRODUCTION_KEYS,
  TEST_ADMOB_CONFIG,
  resolveAdMobConfig,
};
