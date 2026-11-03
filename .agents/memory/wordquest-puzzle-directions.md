---
name: WordQuest puzzle direction placement
description: Best-effort diagonal placement rules for tier-configured puzzles.
---

For tier-configured puzzles, diagonal counts are targets rather than hard generation requirements. Choose start cells from the in-bounds range for each selected direction instead of sampling the whole grid. Keep every target word on the board; if retries still cannot meet the requested count, reduce only the diagonal count and expose requested-versus-actual diagnostics to the player.

**Why:** Dense intermediate-category boards exhausted retries because random start sampling wasted many attempts outside the board or on conflicting letters. Valid-start sampling materially reduces that waste, while a visible fallback still protects gameplay from difficult random layouts.

**How to apply:** When changing category tiers or generation constraints, retain valid-start sampling, overlap validation, fallback diagnostics, the user-visible notice, and deterministic tests that verify all words remain selectable.
