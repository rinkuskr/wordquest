---
name: WordQuest monetization
description: Product model and consent constraints for future AdMob work.
---

WordQuest is a completely free Android game supported by Google AdMob. Use Google's test App IDs and ad-unit IDs during development. Where consent is required, gather UMP consent and check `canRequestAds` before initializing or requesting ads.

Wait until the ad placements phase is complete before asking to start the first EAS preview APK build.

**Why:** the user defined the game as free and ad-supported, and explicitly restricted Phase 1 to test ads.

**How to apply:** future monetization phases must preserve the free model, keep development traffic on Google's test IDs, and respect the UMP consent gate before enabling ad placements. After placements are complete, report the implementation and request approval before starting EAS.
