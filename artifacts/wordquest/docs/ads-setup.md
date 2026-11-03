# Optional AdMob setup

WordQuest remains free and ad-supported, but the current foundation is test-only
and dormant. No ad placements are mounted, and the app does not initialize the
Mobile Ads SDK at launch. Existing game behavior remains independent of ads.

## Phase 1 foundation

- Expo SDK 57 uses `react-native-google-mobile-ads` 17.4.0 and
  `expo-build-properties` 57.0.22. A custom native build is required; Expo Go
  and Expo Web use the no-op provider.
- `app.json` uses Google's sample Android and iOS App IDs, delays app measurement
  until consent, sets Android min SDK 24, and preserves the UMP ProGuard rule.
- `src/services/ads.android.ts` contains the Android provider. Its `initialize()`
  method gathers UMP consent, checks `canRequestAds`, and only then initializes
  Google Mobile Ads. It is intentionally not called by the app yet, so the
  existing result callbacks and hidden rewarded-hint control remain no-ops.
- `src/services/ads.core.ts` contains Google's sample banner, interstitial, and
  rewarded unit IDs and the mock fallback. Do not replace them with production
  IDs during development.

## Before enabling placements

1. Configure the applicable privacy/consent messages in AdMob. For regulated
   regions, do not initialize the ads SDK until UMP has completed and
   `canRequestAds` is true. Add an in-app privacy-options entry point where
   required before public distribution.
2. Test on an Android development build, not Expo Go. For consent testing, call
   `adProvider.initialize({ debugGeography: 'EEA',
   testDeviceIdentifiers: ['<device-hash>'] })` in a development-only path. Get
   the hashed test-device ID from native Google Mobile Ads logs; reset UMP state
   between repeated tests with `AdsConsent.reset()`.
3. Keep interstitials on eligible between-level transitions only, no more than
   every second eligible trigger and at least 60 seconds apart.
4. Grant an extra hint only from the rewarded-ad completion callback. If loading,
   playback, or reward confirmation fails, leave the hint balance unchanged.

The Google Mobile Ads Android library contributes `INTERNET`, `WAKE_LOCK`, and
`ACCESS_NETWORK_STATE` manifest permissions; it does not require a runtime
permission prompt for these. No production App ID or ad-unit ID is bundled.
