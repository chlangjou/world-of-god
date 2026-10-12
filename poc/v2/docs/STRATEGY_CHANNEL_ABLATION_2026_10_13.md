# Miracle / Oracle Channel Ablation — Core-Faith Evaluation

**Date:** 2026-10-13 (Asia/Taipei)  
**Status:** Small, bounded mechanism isolation completed. **No Faith balance, AI behavior, initial conditions, or game speed was modified.** No P2 (day-240 comeback simulation) was performed.

## Motivation: core Faith, not fluctuating casual affiliation

Earlier P1 analysis compared Day-180 **20+ believers** and described winning 39:12 or 29:21 as a religious victory. That was overly strong. Many newly converted 20–39 believers can change affiliations, while the enduring growth of `Devotion >= 40` is the more credible criterion for strategic victory. 80+ devotion and weighted Divine Power contribution give independent indicators of depth/quality.

**Primary measure:** living 40+ players vs AI, with a core lead/tie.  
**Secondary:** living 80+, total weighted devotion contribution (`faithfulWeight`, not stored DP), and core 40+ in individual native villages.  
**Diagnostic only:** 20+ believers, Oracle activity, new believers, and concrete action success.

## Method and resource budget

The P1 runner now accepts `channels=both|miracle-only|oracle-only|none`. The same hard-coded player strategy starts at Day 0 of each world; Miracle and Oracle action schedules are independently enabled or disabled. The opponent remains **Normal AI** under the current unmerged difficulty feature branch.

- Two previously selected hard seeds: `dry-stress`, `opponent-competition-replay`.
- Two differentiated player strategies: `missionary` and `development`; these were more informative than repeating the already-insufficient aggressive attempt at high cost.
- Both channels: 8 possible Miracle slots (days 21, 42, ..., 168) plus 2 Oracle slots (days 15, 105). Single-channel interventions use only their own slots; no extra action budget compensates for removing another channel.
- `none` is equivalent to the no-player-action passive baseline, shared by the two strategies within each Seed. **14 unique scenarios** rather than 16 redundant runs: two baselines + two seeds × two strategies × three nonempty channel choices.
- Each simulation runs exactly 180 simulated days = 540 ticks. No per-Tick AI/LLM call for the player, no optimal map targeting, and no fallback cast search.
- Source `tools/strategy-reversal-evaluation.cjs` remains reusable; JSON output now includes independent `coreLead`, `playerDevout80`, `aiDevout80`, `playerPowerWeight`, `aiPowerWeight`, and native-village 40+ counts, plus a compact Oracle and propagation summary.
- Executed actual `src/sim.js` in bounded V8-isolate calls; each full case ~5.3–5.9 seconds, all under 12 seconds, all `valid=true` and `aborted=false`. **14 × 540 = 7,560 ticks.** No native Node.js RSS was measured.
- [Machine-readable 14-case end-state dataset](../reports/strategy-channel-ablation-2026-10-13.json) is intentionally compact. No full-world JSON or per-tick history is saved for AI interpretation.

## A. Primary result: 40+ core believers at day 180

Each cell is **player:Normal AI**.

| Map | Player strategy | No intervention | Miracle only | Oracle only | Both |
| --- | --- | ---: | ---: | ---: | ---: |
| `dry-stress` | Missionary | 6:12 | 5:12 | 7:12 | 7:12 |
| `dry-stress` | Development | 6:12 | 11:12 | 11:12 | **12:12** |
| `opponent-competition-replay` | Missionary | 4:12 | 4:12 | 6:12 | 6:12 |
| `opponent-competition-replay` | Development | 4:12 | **12:12** | 10:12 | **12:12** |

**No intervention policy achieved a player lead in 40+ core believers.** Three non-baseline cases reached **12:12 parity**, and the remaining eleven cases retained an AI core lead. Thus **the previous "P1 showed the player winning" conclusion does not survive this more stable primary metric.** P1 demonstrated sensitivity/short-term territorial spread, not a convincing durable religious reversal.

## B. 80+ devotees and Divine Power contribution strength

Weighted Devotion uses the simulation's `0:1:2:4:8` contribution economy (high-devotion values matter more than sheer 40+ count).

| Map | Strategy / channel | 80+ Player:AI | Faith-power weight Player:AI |
| --- | --- | ---: | ---: |
| `dry-stress` | Passive | 0:4 | 18:73 |
| `dry-stress` | Missionary / Oracle only | 0:4 | 20:74 |
| `dry-stress` | Development / Miracle only | 2:4 | 35:75 |
| `dry-stress` | Development / Oracle only | 1:4 | 25:75 |
| `dry-stress` | Development / Both | **3:4** | **59:57** |
| `opponent-competition-replay` | Passive | 0:4 | 19:69 |
| `opponent-competition-replay` | Missionary / Oracle only | 0:4 | 45:48 |
| `opponent-competition-replay` | Development / Miracle only | 2:4 | 44:66 |
| `opponent-competition-replay` | Development / Oracle only | 1:4 | 36:58 |
| `opponent-competition-replay` | Development / Both | **3:4** | 50:66 |

`dry-stress` Development/Both is the only case here that slightly **overtook the AI in weighted devotion contribution** (59:57), despite 12:12 core count and 3:4 highly devout individuals. That is promising for future resource competition, **not** an already-confirmed winning religion. `opponent-competition-replay` Development/Both has equal core headcount but still much lower weighted contribution (50:66).

## C. Why the earlier 20+ metric was misleading

| Map/strategy | Miracle only (20+) | Oracle only (20+) | Both (20+) |
| --- | ---: | ---: | ---: |
| `dry-stress` / Missionary | 12:37 | 13:38 | 12:38 |
| `dry-stress` / Development | 12:39 | 12:39 | **29:21** |
| `opponent-competition-replay` / Missionary | 17:32 | **39:12** | **39:12** |
| `opponent-competition-replay` / Development | 20:30 | 24:22 | 20:30 |

- **Missionary on `opponent-competition-replay`:** `religion.spread` Oracle alone produces the same 39:12 low-threshold affiliation as combining Oracle with eight Miracles. Its two Oracles recorded **562 affected sermon opportunities** and **10 recorded rival conversions**, but yielded only **6:12 core**. Adding Miracles does not make its newly claimed villages stable within 180 days.
- **Development on `dry-stress`:** Each isolated channel yields only 12:39 ordinary believers, while the combination yields 29:21, 12:12 core and 59:57 contribution weight. This is strong observed **nonlinear path dependence**, not evidence that any one action directly converts 17 extra people.
- **All 14 final states have exactly zero 40+ believers inside the three native villages**, even in scenarios where all nine residents of a village have adopted one religion. A "native village acquired" result at day 180 is a provisional claim, not an established religious stronghold.

## D. Mechanism isolation cautions

The original miracle-specific direct-adoption counter is `0` across these cases. This **does not mean Miracle is causally ineffective**: Miracle evidence may raise Devotion, impact real farming/health and later sermon reach, and ultimately alter downstream autonomous religious decisions. Direct `Miracle` conversion and longer-term indirect impact are different.

Likewise, one strategy can change how simulation RNG is consumed. Two worlds have the same initial Seed and same config, but interventions alter state, decision timing, and subsequent RNG draws. Therefore differences between `both` and `miracle-only` or `oracle-only` reveal intervention sensitivity **including nonlinear social/random feedback**. They do not estimate a clean isolated marginal treatment effect with shared identical person-level stochastic outcomes.

The P1 time horizon also introduces a **measurement mismatch**: 180 days is enough for rapid 20–39 affiliation changes, but apparently not for newly converted native residents to reach the 40+ tier. The test should not claim stable capture on that horizon.

## E. Decision

**Small ablation completed; do not expand the matrix yet.** It demonstrates the prior 20+ "win" conclusion was overstated and distinguishes:

1. **Fast affiliation acquisition:** Spread Oracle can win low-devotion followers without producing comparable established core faith.
2. **Core / divine economy strengthening:** Development can grow 40+ devotees and sometimes approach weighted DP parity; requires genuine downstream life/work improvements.
3. **Unresolved durability:** Native villages remain at 0 core believers after 180 days in every scenario, so neither early "conquest" nor practical late comeback has been established.

Recommended next *small separate experiment*, after explicit approval: take just the most revealing paired cases (e.g. `dry-stress` Development/Both vs Passive; `opponent-competition-replay` Missionary/Oracle-only vs Passive) and extend from Day 180 to Day 360, in separate 30-day bounded child runs. **Do not add more Seed samples until durable village-core conversion is observable.** Evaluate at most two paired worlds at a time; if 40+ growth still fails despite hundreds of low-devotion converts, prioritize Faith Contest and maturation dynamics over balance parameter tuning.

**Follow-up completed (P1.1, same date):** Four independently bounded **360-day** replays of the recommended matched pairs now show that initially low-devotion followers can mature into 40+ native-village cores. Development/Both on `dry-stress` reaches **23:16** Player:AI core at Day 360 versus **9:25** for Passive; Missionary/Oracle-only on `opponent-competition-replay` reaches **21:12** versus **8:24** for Passive. This corrects the earlier *time-horizon* uncertainty, but still does not test a late strategy switch against an already entrenched 40+ opponent. See [Strategy Maturation P1.1](STRATEGY_MATURATION_P1_1_2026_10_13.md).

## How to reproduce a single isolation

In a checked-out repository, from `poc/v2`:

```sh
npm run evaluate:strategy -- --seed dry-stress --strategy development --days 180 --channels miracle-only --budget-ms 12000
npm run evaluate:strategy -- --seed dry-stress --strategy development --days 180 --channels oracle-only --budget-ms 12000
npm run evaluate:strategy -- --seed dry-stress --strategy development --days 180 --channels both --budget-ms 12000
```

The `none` channel is the passive baseline. The result is one short JSON line, primarily the final state and bounded checkpoints. The script validates its channel name and rejects study horizons longer than 180 days. Unit regression `tests/strategy-reversal-evaluation.test.cjs` verifies independent channel slots, matching passive baselines, and stable core/devout/weight metrics.
