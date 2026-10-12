# Map Path Dependence & Casual Player Viability — Evaluation Checkpoint

**Date:** 2026-10-12  
**Scope:** World of God Web PoC v2, `feature/opponent-difficulty-profiles-v0.3`, Normal AI (`difficulty=standard`)  
**Status:** Diagnostic observations, not accepted balance parameters or an actual human win-rate study. No physics, Faith or Genesis mechanics were changed for this analysis.

## Questions

1. Does the same map seed predetermine the winner independently of player actions?
2. Does swapping God birth locations transfer the map advantage?
3. Could an ordinary sandbox player who checks only a few visible details and makes occasional suboptimal decisions compete with Normal AI?
4. Once one religion dominates early native villages, can a late casual player recover?

## Experiment setup

The reproducible partial-observation behavioral proxy is `tools/casual-player-evaluation.cjs`, calling the current `src/sim.js`, `config/balance-agriculture-v0.1.json`, `config/religion-propagation-v0.1.json`, `config/divine-powers-v0.1.json`, and `config/opponent-v0.2.json`.

- **Normal AI:** It does not perform a global optimization search. This branch's Normal AI uses sampled regional state and a bounded candidate search, instead of the old fixed exhaustive local preference order.
- **Casual player:** Sessions 75–185 real seconds apart. May inspect one randomly chosen native village, sometimes one nearby resident or current prayer. Can choose to observe without intervention; when it acts, it chooses one intuitive Miracle/Oracle and may fail rather than searching all spells, all targets or exact cooldowns. Own decision randomness is separate from authoritative World RNG.
- **World speed scenarios:** Current 1× = 2 real seconds/simulated day; diagnostic slower scenario = 10 real seconds/simulated day. **The engine/UI speed was not changed.**
- **Score:** Number of living Devotion 20+ believers attributed to player/AI at simulated day 360, not a formal victory condition; core believers are Devotion 40+.

Each of **six fixed map seeds** was run with five independent casual player choices per world speed: 60 player/world trajectories, but only six distinct base maps. All use `style='balanced'`. The session model approximates viewing and a command, **but executes its command instantly at the session checkpoint and does not separately account for each real UI click's latency**; results may therefore overstate player responsiveness.

## Casual results vs Normal AI (day 360)

| Fixed map seed | Current 1×, player ahead out of 5 | Proposed slower world, player ahead out of 5 |
| --- | ---: | ---: |
| `valley-spring-01` | 5 | 5 |
| `opponent-competition-replay` | 0 | 3 |
| `calm-river` | 5 | 5 |
| `dry-stress` | 0 | 1 |
| `remote-origin` | 5 | 5 |
| `adversarial-competition` | 4, one tie | 5 |
| **Total** | **19 ahead, 10 behind, one tie** | **24 ahead, six behind** |

Actual mean human agent sessions were about **5 per 360 days** at 2 sec/day and **27–28 per 360 days** at 10 sec/day. The Normal AI has about 19 opportunities in 360 days.

**Interpretation:** Human pacing substantially changes outcomes on `opponent-competition-replay`, but `dry-stress` remains hard even with a more frequent casual player. The strong clustering by seed indicates a world-generation/early-religion path dependence beyond AI action frequency.

## Baseline, geography and initial Faith controls

Genesis intentionally starts both religions with 12 people and 42 DP, but it does **not** give them identical Faith: player starts with three 40+ devotees, total Devotion 401 / weighted generation 15; AI starts with four 40+ devotees, total Devotion 444 / weighted generation 16. Geography and religious persuasion randomness are additional independent contributors.

In a location-swap diagnostic, all four player/AI starting households were moved to the other God's original campsite (and both campsite references swapped), retaining each person's original religion, Devotion and other properties. Terrain/native village locations remained unchanged. These are **controlled counterfactuals**, not normal playable Genesis profiles.

| Seed | Original location, player:AI | Swapped locations, player:AI | Interpretation |
| --- | --- | --- | --- |
| `valley-spring-01` | 39:12 | 30:21 | Location matters, winner stays |
| `opponent-competition-replay` | 12:39 | 12:39 | Location swap alone does not break AI lead |
| `calm-river` | 39:12 | 21:30 | Leader changes |
| `dry-stress` | 12:39 | 30:21 | Leader changes |

A separate test **kept locations and people fixed**, but replaced only the two independent religion RNG streams. In `opponent-competition-replay`, several resampled streams reversed the original 12:39 result (e.g. 30:20 and 39:12). Some resamples of `dry-stress` still favored AI, whereas other previously tested stream swaps produced a player lead. Therefore the same terrain is **not mathematically an inevitable winner**; early persuasion stochasticity materially changes the path.

A third diagnostic equalized player founding-family Devotion distribution to the AI's four 53-Devotion champions plus 29-Devotion family members. The `dry-stress` original AI lead flipped to player 23:19; `opponent-competition-replay` flipped to player 39:12. This is a controlled artificial counterfactual, **not** a recommendation to adopt those exact values.

These three interventions are not a full factorial causal study: moves alter later encounters/PRNG consumption and equalizing Faith itself changes contribution and preacher opportunities. Interpret them as **sensitivity evidence**, not numerical attribution of win percentage to a factor.

## Entrenchment and late intervention

For four seeds with original and swapped camps (eight cases), day 360 and day 720 **had unchanged counts of existing 20+ believers** on each side. Population and births continued, so this is religion-alignment stagnation, not a frozen world.

Additional matched experiments held the same map and behavioral agent, running the slower 10-sec/day hypothetical pacing to day 720:

| Map / agent choices | Interventions begin | Day 720 player:AI | Successful Miracle / Oracle |
| --- | --- | --- | --- |
| `dry-stress`, playerSeed 4 | Early | **30:20** | 28 / 5 |
| `dry-stress`, playerSeed 4 | Day 240 | **12:39** | 22 / 2 |
| `opponent-competition-replay`, playerSeed 2 | Early | **39:12** | 36 / 4 |
| `opponent-competition-replay`, playerSeed 2 | Day 240 | **12:39** | 24 / 4 |

Early intervention can change the dominant faith and retain it, but once almost every founding native village has committed to the dominant side, many late support miracles leave the territorial faith division unchanged.

This matches the known **Faith Contest deficit**: the ordinary sermon channel protects rival Devotion 40+, while current Miracle evidence needs attribution, actual beneficiary, and repeated credibility. There is no robust, generic, attractive late game nonmilitary route for a casual player to actively challenge 80–100 Devotion core followers. Charm is not implemented in this branch.

## Design conclusion

**Reject both simplistic hypotheses**: (a) every map seed has a literally fixed winner, and (b) AI decision cadence alone explains the difficulty. Instead the current PoC amplifies small differences in geography, initial Faith and persuasion RNG through a fast native-village adoption phase. The subsequent high-Devotion boundary then makes outcomes **highly path-dependent and difficult to reverse**, especially for people who make sparse, intuitive choices.

Prioritize separate capabilities rather than brute-force AI handicaps:

1. **Genesis fairness instrumentation:** benchmark paired birth-location and initial-Devotion variants to identify the part of early advantage the world itself injects.
2. **Strategic recoverability:** Faith Contest v0.4 / attributable positive rival Miracle and an expensive, bounded Charm-like route should offer a real (not guaranteed) way to contest entrenched followers late, without forced instant adoption. This is the core antidote to sandbox stalemate.
3. **Human-paced playtesting:** review the 1× clock and reduce the need for residents-by-resident UI inspection; do not assume routine pausing is how most casual players play.
4. **Bounded local AI:** preserve distinguishable low/normal/historical modes by imperfectly informed behavior and thematic priorities, rather than an optimal choice every turn.

## Suggested acceptance checks for the next feature

- A paired-seed baseline tracks player/AI 20+, 40+, territory, Native Village ownership and religious origins at days 30, 90, 180, 360 and 720.
- Once a faction is **at least nine believers behind after day 240**, meaningful, costly, human-credible nonmilitary intervention can still produce **visible contest progress** by day 720 on some replicated paths (e.g. capture part of a rival-affiliated village), without claiming a guaranteed victory.
- No unconditional reversal via a single low-cost button and no preservation of a hard 40+ wall for all normal Miracle evidence.
- Evaluate an actual UI interaction model (per-click/reaction delays), as well as behavioral proxy simulations. Both need to distinguish fresh maps from repeated behavioral samples on one map.
