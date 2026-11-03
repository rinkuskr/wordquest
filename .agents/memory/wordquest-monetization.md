---
name: WordQuest monetization
description: Product model and consent constraints for future AdMob work.
---

WordQuest is a completely free Android game supported by Google AdMob. Use Google's test App IDs and ad-unit IDs during development. Where consent is required, gather UMP consent and check `canRequestAds` before initializing or requesting ads.

WordQuest's intended Google Play positioning is a general puzzle game for ages 13+, not designed, developed, or marketed specifically for children, with a global audience including India, the US, the UK, Canada, and Australia.

**Why:** the user specified this audience and positioning for launch.

**How to apply:** assess target-age declarations and advertising requirements against this positioning, while still accounting for Google's guidance that 13–17-year-olds may be children in some locales.

WordQuest uses a neutral first-launch age choice (under 13, 13–17, 18+) with a decline path. Unknown/declined and under-13 users do not initialize Google Mobile Ads; adults receive explicit UNSPECIFIED treatment; teens receive TEEN only after ad eligibility and UMP age-of-consent handling are explicitly approved. Until regional teen requirements are verified, teen ad eligibility remains unknown and ads stay off. Never infer adult status from the 13+ store position, geography, or consent state.

**Why:** the user approved age classification with fail-closed behavior and explicitly prohibited inventing a country-age policy matrix.

**How to apply:** load the locally stored age band before UMP or GMA. Pass an explicit age treatment and under-age-of-consent flag before initialization; if classification is unknown or regional teen eligibility is unverified, do not initialize ads. Age changes block requests for the rest of the session and take effect on the next app launch.

Wait until the ad placements phase is complete before asking to start the first EAS preview APK build.

**Why:** the user defined the game as free and ad-supported, and explicitly restricted Phase 1 to test ads.

**How to apply:** future monetization phases must preserve the free model, keep development traffic on Google's test IDs, and respect the UMP consent gate before enabling ad placements. After placements are complete, report the implementation and request approval before starting EAS.
