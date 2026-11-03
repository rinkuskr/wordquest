---
name: WordQuest monetization
description: Product model and consent constraints for future AdMob work.
---

WordQuest is a completely free Android game supported by Google AdMob. Use Google's test App IDs and ad-unit IDs during development. Where consent is required, gather UMP consent and check `canRequestAds` before initializing or requesting ads.

WordQuest's intended Google Play positioning is a general puzzle game for ages 13+, not designed, developed, or marketed specifically for children, with a global audience including India, the US, the UK, Canada, and Australia.

**Why:** the user specified this audience and positioning for launch.

**How to apply:** assess target-age declarations and advertising requirements against this positioning, while still accounting for Google's guidance that 13–17-year-olds may be children in some locales.

The Android ads provider accepts explicit CHILD, TEEN, or UNSPECIFIED age-restricted treatment, configures it before UMP and SDK initialization, and defaults to UNSPECIFIED. Do not infer a treatment from the 13+ store position, geography, or consent state.

**Why:** the user requested treatment support without an age screen or country mapping and asked to retain existing behavior until an age-classification strategy is approved.

**How to apply:** keep startup at UNSPECIFIED until that strategy is approved; only then pass an explicit treatment before ad initialization.

Wait until the ad placements phase is complete before asking to start the first EAS preview APK build.

**Why:** the user defined the game as free and ad-supported, and explicitly restricted Phase 1 to test ads.

**How to apply:** future monetization phases must preserve the free model, keep development traffic on Google's test IDs, and respect the UMP consent gate before enabling ad placements. After placements are complete, report the implementation and request approval before starting EAS.
