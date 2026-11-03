---
name: WordQuest daily challenge constraints
description: V1 daily challenge identity, local history, and gameplay boundaries.
---

WordQuest V1 has one deterministic Daily Challenge per UTC date, shared across installations running the same app version. It uses existing category words and difficulty rules, stores results locally, awards no coins, and shows no ads during daily gameplay. There are no accounts, backend, streaks, or leaderboards; offline device time cannot be trusted against clock changes.

An incomplete Daily Challenge can resume only on the same UTC date with a compatible app and challenge version. Recreate its board deterministically, restore found words, bonus words, score, hints, and accumulated foreground elapsed time, then resume with the clock paused. Completed history is authoritative; keep the active attempt until that history save succeeds.

**Why:** the user set these as V1 boundaries; background time must remain uncharged, and a failed completion save must not erase the player's final attempt.

**How to apply:** preserve UTC date identity and deterministic generation, keep history local and recoverable, and do not add daily monetization or server-dependent rewards without a new product decision.
