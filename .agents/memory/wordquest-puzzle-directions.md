---
name: WordQuest puzzle direction placement
description: Best-effort diagonal placement rules for tier-configured puzzles.
---

For tier-configured puzzles, diagonal counts are targets rather than hard generation requirements. Keep every target word on the board; if retries cannot meet the requested count, reduce only the diagonal count and expose requested-versus-actual diagnostics to the player.

**Why:** Dense intermediate-category boards produced reproducible generation failures when the diagonal quota was forced. Preserving every word and surfacing the adjustment keeps gameplay available without concealing the distribution mismatch.

**How to apply:** When changing category tiers or generation constraints, retain fallback diagnostics, user-visible notice, and deterministic tests that verify all words remain selectable.
