# Opponent Difficulty v0.3 — Human-Paced AI, Historical Ceiling

**Status:** Experimental Web PoC v2, 2026-10-12. Difficulty controls are part of the existing `opponent-v0.2` profile; no authoritative root design contract changes.

## Rationale

Even the original simple AI has a practical user-interface advantage: it can read actual local state, pick a Priest/Saint, inspect nearby farmland and actual wounded followers without moving a cursor, switching tabs or paging through several petitions. This does **not** mean it has a globally optimal map-wide planner. Its current action center is a real local believer/Priest, and it checks fields around that center; nevertheless its local observations and action preparation are immediate and cost no human attention.

A stronger-than-original fourth-difficulty-style AI would intensify this asymmetry. **The maximum selectable policy therefore exactly matches the previous v0.2 default AI**, rather than accelerating it or giving it extra off-screen actions.

## Presets

| Mode | Name in UI | Decision cadence, from existing 12 days | Initial AI decision | Spread Oracle | Hostile attempts | Forced cooldown casts |
| --- | --- | --- | --- | --- | --- | --- |
| `relaxed` | 輕鬆 | 24 simulation days | ~day 48 | May begin ~day 72 | Disabled | Does not force a cooling Miracle |
| `standard` | 標準 (new-world default) | 18 simulation days | ~day 36 | May begin ~day 36 | Original opportunity rate (once per 4 turns) | Up to 2× DP, if affordable |
| `challenging` | 原版 AI | **12 simulation days (historical)** | ~day 24 | As historically available | Original opportunity rate (once per 4 turns) | Same current rules as historical AI; no extra benefit |

The dates follow the existing `day % interval === 0` schedule and base `startDay=14`, with separate configured activation delays. The actual ability to transmit a specific Oracle still depends on having a living Saint, valid quota, and previous active assignments. **The AI still chooses at most one successful Miracle per decision turn**.

Values are editable through `config/opponent-v0.2.json` → `difficultyProfiles`:
`intervalMultiplier`, `startDelayDays`, `oracleDelayDays`, `offensiveEveryTurns`, `maxForcedMultiplier`.

No level changes the actual Divine Power pool, initial population or faith, Miracle price, cooldown formula, Mastery progression, agriculture, mortality, conversion probabilities, Miracle attribution, or other world simulations. Switching to `challenging` is not an irreversible commitment; there are no difficulty trophies in the PoC.

## Interaction / save compatibility

- The compact header's `AI 對手難度` selector is enabled only in a world with a rival God. The player can change difficulty **during a running or paused game, without creating a new world**; the next eligible AI decision follows the selected policy.
- New games use the currently selected difficulty. `standard` is the default.
- The selector is preserved in JSON saves and when saving/loading from the file menu.
- Worlds created **before** this feature, with no `difficulty` field, are restored at `challenging` (the historical AI) so their established opponent is not silently altered. Historical `opponent-v0.1` mixed-mode creation also retains that original policy unless explicitly overridden.
- Switching the difficulty modifies the existing `opponent.difficulty` field only; no free resources, no automatic conversions, no renaming/repositioning, no independent PRNG reset.

## Results / interpretation

At day 360, three representative seeded nonintervention runs showed 14 / 19 / 29 AI decision turns for relaxed / standard / original, with the same initial 51 people and both Gods' initial DP of 42. The original top tier was compared directly against the pre-difficulty simulator for three seeds; population Faith, physical world, God DP, actual decisions, events, seeded PRNG, skill state were **identical at 360 days**.

This is a **decision-pressure scale**, not a promised monotonic win-rate scale. In the same seed, a weaker policy may incidentally cause different conversion outcomes due to timing. Terrain and in-world social preaching remain influential independently of AI interventions. The religious core stalemate and future Charm / Faith Contest are separate features.

## Follow-up observation

The current UI already has localized prayer cards, Priest prayer bubbles, per-Miracle retained settings, and fast-forward interruption. Future player-assistance improvements (e.g. a map-highlighted priority-need shortlist, not automatically casting) may be more appropriate than any faster AI. If we implement an AI observation model later, it should bound available **knowledge**, not simply add a random failure roll. Avoid claiming simulated human reaction parity based only on fixed decision intervals.

## Tests

`tests/opponent-difficulty.test.cjs` checks exact Genesis parity, policy timing and original ceiling, live reversible switching, identical save replay, migration of old saves, old mixed profile, and numeric tuning. The existing opponent, religion, native-world, Miracle and UI tests continue to apply.

## Bounded P0/P1 strategy reversal study (2026-10-13)

The decision-quality tier and human-facing pacing are not themselves strategic balance proof. A separate [P0/P1 strategy reversal evaluation](STRATEGY_REVERSAL_P0_P1_2026_10_13.md) exercises `passive`, `missionary`, `development`, and `intervention` for two matched seeds, with equal action slots and limited information. In each seed at least one player policy reversed the baseline AI lead by simulated day 180. Causality of conversions and late game recoverability remain unresolved. The separate Node scripts enforce bounded, resumable-by-case execution instead of a single huge batch.
