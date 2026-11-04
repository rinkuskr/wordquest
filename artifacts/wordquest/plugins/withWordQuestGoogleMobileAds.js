'use strict';

const googleMobileAdsPlugin =
  require('react-native-google-mobile-ads/app.plugin').default;
const { resolveAdMobConfig } = require('../config/admobConfig');

module.exports = function withWordQuestGoogleMobileAds(config) {
  const adConfig = resolveAdMobConfig(process.env);

  return googleMobileAdsPlugin(config, {
    androidAppId: adConfig.androidAppId,
    iosAppId: adConfig.iosAppId,
    delayAppMeasurementInit: true,
  });
};
