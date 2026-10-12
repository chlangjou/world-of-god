# Strategic Reversal P0/P1 — First Bounded Evaluation

**Executed:** 2026-10-13 (Taipei)  
**Git branch:** `feature/opponent-difficulty-profiles-v0.3`  
**Code:** `tools/strategy-reversal-evaluation.cjs` (hard-coded strategies), `tools/strategy-reversal-suite.cjs` (optional local isolated-subprocess runner)  
**Status:** P0 passed, all eight P1 cases completed and validated. **P2 not executed.**

**IMPORTANT CORRECTION (same-day channel ablation):** The P1 descriptions of strategy
"reversing" AI advantage refer **only to the more volatile Devotion 20+ affiliation
counts**, not to durable core faith. Subsequent [Miracle/Oracle isolation testing](STRATEGY_CHANNEL_ABLATION_2026_10_13.md)
used **40+ core believers as the primary victory metric**: none of the 14 end
states overtook AI in core followers; Development/Both on `dry-stress` and
Development/Miracle-only or Both on `opponent-competition-replay` reached 12:12
core parity. All three native villages still had zero 40+ core devotees at day 180.
Treat all 20+ "victory" language in the original data tables below as provisional
affiliation gains, not durable territorial conquest.

## Intent and resource guardrails

Test whether different *deliberate but nonoptimizing* God strategies actually change religion competition outcomes without funding an expensive sandbox-graphics PoC, and avoid any monolithic long-running simulation.

- All cases run the **same actual PoC v2 kernel** and `opponent-v0.2.json` with `difficulty='standard'`, not a sketch/alternative faith simulator.
- Controlled two hard seeds: `dry-stress` and `opponent-competition-replay`. Each case starts with the same initial conditions for that seed.
- Strategies are fixed Node.js functions. No LLM or optimizer is consulted per Tick. A God gets at most **one Miracle attempt every 21 simulated days** (eight in 180 days) and one Oracle attempt on **days 15 and 105** (two); invalid casts are recorded **without an automatic backup choice**.
- All map targets are derived **once at Genesis** from three native villages: own-side `n1`, evenly contested `n3`, and AI-side `n2`. These identify the *relative* geographic advantage, not an every-tick search for the highest marginal Faith return.
- Only days 0, 30, 90 and 180, action counts, final population/DP/conversion totals, and failures are output. No large per-person timeline or tile output is transmitted for analysis.
- Each standalone Node child process has a suggested `12000ms` wall timeout in the suite wrapper and a `--max-old-space-size=512` **V8 heap limit (not a strict overall OS RSS limit)**. In-script budget is also checked after each 30-day chunk. The batch wrapper writes successful case results to JSONL immediately and stops on the first abnormal exit.

**Execution-environment caveat:** These actual source files were executed in a V8 isolate using the connected GitHub source. Native Node.js execution and process RSS measurement were **not** available in that environment. The committed Node entrypoints and child-process controls are prepared for reproduction on a checked-out repository; the measured elapsed times below are V8-isolate wall times, not promises about Windows/Node runtime performance.

## Hard-coded strategies

| Key | Strategy | Miracle policy | Oracle policy |
| --- | --- | --- | --- |
| `passive` | No player intervention | None | None |
| `missionary` | Outreach / early expansion | Alternating fixed own-side/frontier locations, Rain and Ripening | `religion.spread` |
| `development` | Stable settlement growth | At founding camp, rotate Ripening, Efficiency, Rain | `food.produce` |
| `intervention` | Contested-region Miracle pressure | Alternate frontier and AI-side, cycle Heal, Rain, Confusion, Ripening, Harvest | `religion.spread` |

These are *not* three fully implemented technology trees. They differ in intended actions and Miracle locations, while using the existing identical DP, cooldown, faith, eligibility, citizen-autonomy and AI mechanics.

## P0 performance calibration (no player interventions)

| Field | Measurement |
| --- | ---: |
| Seed | `dry-stress` |
| Duration | 90 simulated days |
| Actual simulation steps | **270 Ticks** |
| Elapsed V8 wall time | **~3.2 s** |
| World JSON size at day 90 | **903,769 bytes** |
| Valid state | Yes |
| Player / AI believers at day 90 | 13 / 28 |

An earlier direct-kernel calibration (separate from the committed runner) took ~2.9 s, with each 30-day chunk ~0.9–1.0 s. The difference is expected instrumentation/environment noise, **not** a Node performance claim.

## P1 strategy matrix (180 days, Normal opponent)

| Seed | Player strategy | Player 20+ | AI 20+ | Player 40+ | AI 40+ | Miracle success / attempt | Oracle success / attempt | Measured V8 elapsed |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `dry-stress` | Passive | 12 | 37 | 6 | 12 | 0 / 0 | 0 / 0 | 5.79 s |
| `dry-stress` | Missionary | 12 | 38 | 7 | 12 | 8 / 8 | 2 / 2 | 5.57 s |
| `dry-stress` | Development | **29** | **21** | 12 | 12 | 8 / 8 | 2 / 2 | 6.31 s |
| `dry-stress` | Intervention | 13 | 38 | 7 | 12 | 4 / 8 | 2 / 2 | 5.54 s |
| `opponent-competition-replay` | Passive | 15 | 33 | 4 | 12 | 0 / 0 | 0 / 0 | 5.31 s |
| `opponent-competition-replay` | Missionary | **39** | **12** | 6 | 12 | 8 / 8 | 2 / 2 | 5.70 s |
| `opponent-competition-replay` | Development | 20 | 30 | 12 | 12 | 8 / 8 | 2 / 2 | 5.82 s |
| `opponent-competition-replay` | Intervention | **37** | **12** | 6 | 12 | 5 / 8 | 2 / 2 | 5.76 s |

**Resource totals:** P1 = 8 isolated cases × 180 days × 3 ticks/day = **4,320 Ticks**. Total observed V8 wall time **~45.8 s** across multiple short invocations; slowest single case **~6.31 s**, below 12 s. P0 + P1 = **4,590 Ticks**. All eight P1 cases returned `valid=true`, `aborted=false`, `completedDays=180`. World state serialized sizes were roughly 0.87–0.90 MB each; **no actual Node process RSS measurement was made**.

## When the paths diverged

| Seed | Strategy | Day 30 player:AI | Day 90 player:AI | Day 180 player:AI |
| --- | --- | --- | --- | --- |
| `dry-stress` | Passive | 12:13 | 13:28 | 12:37 |
| `dry-stress` | Missionary | 12:13 | 16:26 | 12:38 |
| `dry-stress` | Development | 12:13 | 19:25 | **29:21** |
| `dry-stress` | Intervention | 12:13 | 13:26 | 13:38 |
| `opponent-competition-replay` | Passive | 14:16 | 18:27 | 15:33 |
| `opponent-competition-replay` | Missionary | 14:16 | **26:19** | **39:12** |
| `opponent-competition-replay` | Development | 14:16 | 21:25 | 20:30 |
| `opponent-competition-replay` | Intervention | 14:16 | **26:19** | **37:12** |

At Genesis, no native village belongs to either God. By day 180:

- `dry-stress` passive: native villages `n1` **AI 9**, `n2` **AI 7**, `n3` **AI 9**; Development: `n1` **player 8**, `n2` **AI 9**, `n3` **player 9**.
- `opponent-competition-replay` passive: all three native villages have AI majorities; Missionary: all three have player majorities.

**Important:** `playerFaithFromMiracles=0` in all eight cases. Large Faith differences cannot be simplistically attributed to direct permanent Miracle conversion. Oracle effects, environmental outcomes, separate propagation RNG consumption and positive feedback in the weekly social conversion model may jointly explain divergence. Controlled per-mechanism ablations are required to isolate causality.

## Spell rejection signal

Intervention on `dry-stress`: only four of eight Miracle attempts succeeded. Two Heal casts had no injured target; two Confusion casts failed the **Local Divine Presence** gate. On `opponent-competition-replay`, five succeeded; two Heal attempts lacked targets and one Confusion lacked presence. No rejected cast spent DP.

A poorly matched aggressive plan can fail through world prerequisites, which is a real strategy weakness, not an arbitrary debuff.

## Conclusion / acceptance

- **P1 demonstrates different strategies can change early outcomes** on identical seeds, including reversals of two AI-favored worlds: Development works on `dry-stress`, Missionary and Intervention on `opponent-competition-replay`.
- **P1 does not demonstrate a globally strongest strategy.** Which strategy matters is map-dependent in this two-seed sample.
- Both seeds displayed meaningful religious population or native-village changes; the predefined material-difference acceptance threshold was exceeded.
- This **does not yet validate counterplay** between strategic AI archetypes: the opponent's Normal decision policy was unchanged. Nor does it demonstrate ability to flip an already-entrenched game after day 240. Those are P2 and later experiments.
- With just two fixed seeds and one deterministic strategy plan per seed, these are **sensitivity examples, not win-rate estimates**. Their large swing warrants replay across additional controlled Faith/RNG variants before adopting new numerical balance.

The upcoming discussion should decide whether to approve P2 (same saved day-240 state branching into late actions) or first introduce a *bounded explicit rival-Faith/Charm mechanism* so a mature faith can be challenged without busywork. Neither was undertaken here.

## Reproduce in checked-out Node.js

From `poc/v2`, run one case at a time:

```sh
npm run evaluate:strategy -- --seed dry-stress --strategy passive --days 90 --budget-ms 12000
npm run evaluate:strategy -- --seed dry-stress --strategy development --days 180 --budget-ms 12000
npm run evaluate:strategy -- --seed opponent-competition-replay --strategy missionary --days 180 --budget-ms 12000
```

Or, for a safe sequential matrix with an **external per-child deadline** and incremental JSONL persistence:

```sh
node tools/strategy-reversal-suite.cjs
```

Each child writes only end/checkpoint summaries. An aborted run leaves completed rows under `reports/strategy-reversal-p0-p1.jsonl`; no giant in-memory batch is required. The suite code exists for independent user-side reproduction and **was not executed as one long batch in this ChatGPT session**.

Tests: `tests/strategy-reversal-evaluation.test.cjs` checks input bounds, distinct Genesis target groups, baseline correctness and the preprogrammed action budget.
