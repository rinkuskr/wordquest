# Optional AdMob setup

WordQuest remains free and ad-supported. Ad placements use Google's official
test IDs only; gameplay, local saves, puzzle completion, and hints remain
independent of ad availability.

## Current placements and gating

- Home and category screens mount an anchored adaptive banner in a reserved
  bottom slot after UMP permits ad requests. The puzzle and results screens have
  no banner.
- The existing extra-hint action requests a rewarded ad. A hint is granted only
  after the rewarded SDK emits its earned-reward callback; failure, no fill,
  timeout, or early close grants nothing.
- Interstitial eligibility is counted from successful puzzle completions and
  evaluated only when the user taps a results-screen transition. It requires at
  least three completions since the previous shown ad and a three-minute
  minimum interval. An unavailable ad never delays navigation.
- The Android provider persists the interstitial schedule locally. Web and
  unsupported platforms use the no-op provider.

## Consent and development

The app calls `AdsConsent.gatherConsent()` at launch and checks
`canRequestAds` before initializing Google Mobile Ads or mounting banners. If
consent gathering fails, the provider checks UMP's cached consent result and
fails closed if it cannot confirm requests are allowed. The home screen exposes
a privacy-options entry point; UMP presents its form when the current message
requires it.

To test UMP, configure the relevant consent messages in AdMob and use an Android
development build, not Expo Go. A development-only test can call
`adProvider.initialize({ debugGeography: 'EEA',
testDeviceIdentifiers: ['<device-hash>'] })`; get the hashed device ID from
native Google Mobile Ads logs. `AdsConsent.reset()` resets UMP state between
tests. Use only the Google sample App IDs and unit IDs in `src/services/ads.core.ts`.

Expo SDK 57 uses `react-native-google-mobile-ads` 17.4.0 and
`expo-build-properties` 57.0.22. Android min SDK is 24, and the UMP ProGuard
keep rule is configured. A custom native build is required; Expo Go and Expo Web
use the no-op provider. The ads library contributes `INTERNET`, `WAKE_LOCK`,
and `ACCESS_NETWORK_STATE`; these do not trigger runtime permission prompts.
No production ID is bundled.
