# Strategy Maturation P1.1 — Bounded 360-Day Core-Faith Replays

**Executed:** 2026-10-13 (Taipei)  
**Branch:** `feature/opponent-difficulty-profiles-v0.3`  
**Status:** Four bounded, independent 360-day scenarios completed, valid, no aborts. **Late-game recovery P2 has not been tested.**

## Why extend the horizon?

The prior [180-day channel ablation](STRATEGY_CHANNEL_ABLATION_2026_10_13.md) found that provisional **Devotion 20+ affiliation** often reversed rapidly, yet no strategy exceeded the rival in **40+ core believers**. At day 180 all three original neutral villages had zero 40+ residents, regardless of their 20+ religion majority.

Source review explains a plausible maturation delay: ordinary conversion starts at Devotion **20–23**, and gradual faith consolidation usually gains **at most +1** on each **seven-day** social pulse when there is contact and its probability test succeeds. An already affiliated new native resident can therefore need substantial time before joining the 40+ core. This does **not** establish that every conversion will mature: the outcome still depends on actual people, contact and world events.

## Method / bounded execution

- Reuse the **actual** Web PoC v2 kernel, default Agriculture/Religion/Divine profiles, and the Normal (`standard`) AI opponent.
- Start from **Genesis** for all four independently replayed worlds. These are **not** divergent branches loaded from the same Day-300 save; that separate P2 question is still open.
- Compare only two matched pairs: `dry-stress` Passive vs Development/Both, and `opponent-competition-replay` Passive vs Missionary/Oracle-only.
- Extend the existing hard-coded [P1 runner](../tools/strategy-reversal-evaluation.cjs) only by explicitly setting `--extended true`. The original default **180-day ceiling remains unchanged**.
- For 360 days, use fixed Miracle slots at multiples of 21 (up to **17** attempts); Oracle slots at days **15, 105, 195, 285** (up to **four** attempts), preserving the rate. A disabled channel gets no compensating actions.
- Collect only Day 0, 30, 90, 180, 240, 300, 360 checkpoints, action and adoption counters, final validation; no per-person timeline or full world state transmitted.
- Four worlds × 360 days × 3 ticks/day = **4,320 ticks**. Each isolated V8 execution took **9.95–10.48 s**; combined observed time **41.06 s** across separate runs. Each passed `valid=true`, `aborted=false`.
- The source ran in the **V8 isolate**, not a native Node.js child process. Native Node RSS has **not** been measured. The standalone Node entrypoint enforces a **512-MB V8 heap** via the npm script and checks its in-process wall budget every 30 simulation days. This **is not a strict OS memory or external timeout guarantee**.

## A. Primary outcome: 40+ core believers

Every cell is **Player:AI**. A bold result indicates a player core lead.

| Seed | Player strategy | Day 180 | Day 240 | Day 300 | Day 360 |
| --- | --- | ---: | ---: | ---: | ---: |
| `dry-stress` | Passive | 6:12 | 7:14 | 8:20 | 9:25 |
| `dry-stress` | Development / Both | 12:12 | **14:12** | **21:12** | **23:16** |
| `opponent-competition-replay` | Passive | 4:12 | 4:14 | 6:17 | 8:24 |
| `opponent-competition-replay` | Missionary / Oracle-only | 6:12 | 10:12 | **15:12** | **21:12** |

The Day-180 snapshots reproduce the earlier core-faith ablation in each matching scenario. Both actively played cases eventually show a core lead, while the no-action matched worlds become AI-dominated. Thus the 180-day failure to establish core control was **at least partly a measurement-horizon limitation**, not sufficient evidence of a broken progression mechanism.

The table shows the **first checkpoint** at which a player lead is recorded. Exact crossing days between checkpoints were not saved.

## B. Distinct strategies produce different faith depth

| Day-360 indicator (Player:AI) | Dry / Passive | Dry / Development + Both | Competition / Passive | Competition / Missionary + Oracle |
| --- | ---: | ---: | ---: | ---: |
| 20+ affiliation | 12:39 | 30:21 | 12:39 | 39:12 |
| 40+ core | 9:25 | **23:16** | 8:24 | **21:12** |
| 80+ devotees | 0:4 | **12:4** | 0:5 | 0:5 |
| Faith-power contribution weight | 21:88 | **117:61** | 20:89 | **60:50** |
| 40+ core inside the three native villages | 0:13 | **11:4** | 0:12 | **13:0** |

The **Development** strategy strengthens core Faith *and* generates significantly more 80+ devotees and Faith-contribution weight, consistent with repeated attributed welfare effects. The **Missionary/Oracle-only** strategy recruits 20+ adherents early, and many mature to 40+ by Day 360, but still produces **zero player 80+ devotees**.

These patterns support **distinct early-to-mid-game strategies**. They do not prove the individual Miracle or Oracle channels have a clean additive causal effect: interventions also shift real world events, interactions, and religion RNG consumption.

## C. What is and is not established

**Supported within these two selected seeds:**

1. A change of human God strategy from the beginning can eventually reverse a **40+ core-faith** disadvantage, not only transient 20+ affiliation.
2. Native village 40+ religious majorities take materially longer to mature than initial religious acquisition.
3. Development and Missionary can be differentiated by **faith depth and Divine Power economy**, not merely population count.

**Not established:**

- Population win rates, general balance across random maps, or a universal strongest strategy.
- True comeback against an **already entrenched rival core**, since each strategy started at Genesis rather than branching from the same mature save.
- Whether opponent AI archetypes counter one another strategically; opponent policy remained Normal.
- A clean mechanism-specific causal effect, as the histories and PRNG consumption differ between player action arms.

## D. Decision

**P1.1 passes a limited core-faith maturation demonstration. Do not increase the seed matrix or change core Faith numeric balance yet.**

The next high-information, low-cost P2 should start from **one identical, saved Day-300 world** in which the AI already has several established 40+ core believers in neutral settlements. Compare (a) no further player action and (b) a bounded, fixed late-player strategy over the following **120 days**, preserving all state and PRNG at the branch point. If nothing can dislodge established 40+ followers despite actual opposing miracles, evaluate whether a localized **Faith Contest / conversion-pressure** mechanism is needed, rather than tuning overall faith acquisition blindly.

## Reproduce individual 360-day cases

From `poc/v2` on this feature branch, run **one case at a time**:

```sh
npm run evaluate:strategy -- --seed dry-stress --strategy passive --channels none --days 360 --extended true --budget-ms 25000
npm run evaluate:strategy -- --seed dry-stress --strategy development --channels both --days 360 --extended true --budget-ms 25000
npm run evaluate:strategy -- --seed opponent-competition-replay --strategy passive --channels none --days 360 --extended true --budget-ms 25000
npm run evaluate:strategy -- --seed opponent-competition-replay --strategy missionary --channels oracle-only --days 360 --extended true --budget-ms 25000
```

The in-script time guard is checked every 30-day block; for a hard process deadline impose a separate external timeout when running locally. The 180-day P0/P1 interface still rejects requests longer than 180 days **unless `--extended true` is explicit**.

- [Compact four-case 180–360 data](../reports/strategy-maturation-p1.1-2026-10-13.json)
- [Original 180-day channel ablation](STRATEGY_CHANNEL_ABLATION_2026_10_13.md)
