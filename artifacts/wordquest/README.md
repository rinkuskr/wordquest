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

AdMob is behind an optional service interface and is disabled until real App ID
and ad-unit IDs are supplied and a compatible native Android build is configured.
No production IDs are fabricated, and ads do not block gameplay or completion.
See `docs/ads-setup.md` before enabling ads.

## Android build status

The Android package ID is `com.wordquest.puzzle`, version `1.0.0`, version code
`1`. The Expo preview and app source are configured, but this project has not
produced or signed a release APK/AAB. Test on a device through the workspace's
Expo phone preview. A release build requires an Android native build toolchain
and signing configuration.

## Service

Gameplay is entirely local. The current workspace health endpoint is served by
the existing shared Express API service; it is not a separate NestJS service.
