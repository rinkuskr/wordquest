# Optional AdMob setup

Ads are disabled by default. Gameplay, local saves, puzzle completion, and hints
do not depend on an ad response.

To enable native ads in a later compatible Android build:

1. Provide the AdMob App ID and separate interstitial and rewarded unit IDs.
2. Add the maintained native ads package and its Expo config plugin. A custom
   native build is required; Expo Go remains ad-free.
3. Use Google test IDs during development and verify consent/privacy handling
   against current Google Play and AdMob policies.
4. Keep interstitials on eligible between-level transitions only, no more than
   every second eligible trigger and at least 60 seconds apart.
5. Grant an extra hint only from the rewarded-ad completion callback. If loading,
   playback, or reward confirmation fails, leave the hint balance unchanged.

No production IDs are bundled in this project.
