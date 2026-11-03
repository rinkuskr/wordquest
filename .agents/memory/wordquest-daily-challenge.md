---
name: WordQuest daily challenge constraints
description: V1 daily challenge identity, local history, and gameplay boundaries.
---

WordQuest V1 has one deterministic Daily Challenge per UTC date, shared across installations running the same app version. It uses existing category words and difficulty rules, stores results locally, awards no coins, and shows no ads during daily gameplay. There are no accounts, backend, streaks, or leaderboards; offline device time cannot be trusted against clock changes.

**Why:** the user set these as product boundaries for the first daily-challenge release.

**How to apply:** preserve UTC date identity and deterministic generation, keep history local and recoverable, and do not add daily monetization or server-dependent rewards without a new product decision.
