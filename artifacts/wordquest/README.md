# WordQuest

An offline-first Expo / React Native word-search game for Android, written in TypeScript.

## Run in the workspace

- Start the Expo preview with the configured `artifacts/wordquest: expo` workflow.
- Run tests: `pnpm --filter @workspace/wordquest run test`
- Run TypeScript checks: `pnpm --filter @workspace/wordquest run typecheck`
- Check Expo package alignment: `pnpm --filter @workspace/wordquest exec expo install --check`

## Gameplay

Choose a category, then Classic or Time Mode. Drag across the letter grid in a
straight horizontal, vertical, or diagonal line to find listed words. Puzzles,
bonus-word checks, hints, scoring, sounds, and progress are local; gameplay does
not call the API or require internet access. Animals is the first unlocked
category. Completing a category unlocks the next and awards 50 coins once.

The attached specification provides category names and order but does not
contain per-category word arrays. The bundled category vocabulary is therefore
reconstructed from those topics; it is playable, but cannot be verified as an
exact transcription of arrays absent from the supplied file.

## Local data and ads

Progress is saved with AsyncStorage. The initial balance is 300 coins. The
bonus-word set is bundled locally and is a curated vocabulary, not a complete
English dictionary.

Google's official test App ID and test ad-unit IDs are currently configured.
Ad requests are gated by UMP consent, and production AdMob IDs have not been
configured. Native ads require an Android EAS build; they cannot run in Expo Go
or Expo Web.
See `docs/ads-setup.md` before enabling ads.

## Android build status

The Android package ID is `com.wordquest.puzzle`, version `1.0.0`, version code
`1`. The Expo preview and app source are configured, but this project has not
produced an APK/AAB. Replit's supported on-device development path is Expo Go:

1. Install **Expo Go** from Google Play on the Android phone.
2. Open the WordQuest preview in Replit and use **Open in Expo Go** from the
   Preview panel to show its QR code.
3. Scan that QR code with the phone while both devices have network access.
4. Test category selection, dragging, game completion, and saved progress. After
   completing a category, fully close and reopen WordQuest to check that the
   coin balance and unlock remain.

This loads the app in Expo Go, not as a standalone APK. The workspace has no
Android SDK, Gradle wrapper, or native Android project, and Replit's Expo mobile
workflow does not provide a supported Android APK build step. No signed
production build has been created. Gesture Handler is included in the native
Expo Go runtime, but touch behavior still needs confirmation on a physical
Android phone.

## Service

Gameplay is entirely local. The current workspace health endpoint is served by
the existing shared Express API service; it is not a separate NestJS service.
