# Oracle 30-person core-only ratio sweep — 2026-10-14

**Branch:** `feature/opponent-difficulty-profiles-v0.3` (main untouched).  
**Question:** Starting with 30 equal core believers at Devotion 60 (15 vs 15), can modifying only the Nurture : Food faith-defense coefficients between 1.6:0.4 and 5.5:0.2 breach the established 40+ protection within 100 game days?

## 1. Why the earlier matrix could not answer the high-range question

The deployed v0.1 profile used defense coefficients bounded to **0.25–2.0**, and the initial 0.45/defense probability was capped at 0.90. Thus strong ratios, such as 5.5:0.2, would silently clamp/saturate. The new **optional diagnostic** `faithDefenseModel='odds-scaled'` accepts 0.15–6, without changing the shipped `linear-clamped` semantics.

For a genuine, attributable challenge, `p0=0.45`, `d=defender faith resistance`:

```text
p(earned doubt contact) = p0 / (p0 + d*(1-p0))
```

No actual outcome, no contact, or no credible source still means zero eligible challenge. Ordinary preaching does not cross Devotion 40. The model changes **per-evidence contact probability**, not Devotion threshold or automatic per-Tick Faith loss. The existing doubt impact is **8 devotion points**, with **10-day** repeat restriction, fixed across this sweep. A verified below-40 encounter retains the finite 75-day live-preacher follow-up process.

## 2. Controlled fixture and isolation

This is an explicitly *constructed diagnostic* (not an organically generated 30-person gameplay proof). Begin with real `dry-stress` procedural land and real individuals; retain five complete original households per side (10 households = 30 people), make two camps with equally established existing housing and communal food (45 per camp), keep the citizens' generated age/skills/family/occupation but initialize each person's religion and **Devotion exactly 60**. Each camp has a coherent settlement with genuine member assignments, 5 households, and normal farm resources nearby. No fake Miracle or fabricated conversion is ever applied.

Run normal simulation through Day 10 to allow **natural Saint and Priest emergence**. Require all 30 residents still at 60 before the Day-10 snapshot. Fork identical saves, issue one legal `family.nurture` (player) and one `food.produce` (AI) Oracle. Both sides keep their original choices; the AI replanner/Miracles are suppressed until Day 360, so no extra AI actions confound the comparison. The world still applies its existing rule that a Saint losing qualification ends the Oracle. The runner **does not restore a failed Saint's authority**; that termination is reported because it partially interrupts the intended fixed-policy period.

Six 100-day replay branches share the identical Day-10 serialized fingerprint **`663ff1ac`**. All are bounded and individually validated. Their initial Faith defense and per-person Devotion are identical; only the two opposing matrix entries differ.

## 3. Results (same seed, 100 days)

| Defense: 育兒 : 存糧 | Event chance against 存糧 | Event chance against 育兒 | Original 15 Food core ever <40 | Original 15 Food core ever <20 | Original Food core converted | AI Oracle lost on day |
|---|---:|---:|---:|---:|---:|---|
| **1.0 : 1.0** | 45.0% | 45.0% | 11 | 3 | 1 | — |
| **1.6 : 0.4** | 67.2% | 33.8% | **14** | 5 | 1 | 82 |
| **2.2 : 0.35** | 70.0% | 27.1% | 12 | 6 | 3 | 75 |
| **3.0 : 0.30** | 73.2% | 21.4% | 11 | 6 | 2 | 68 |
| **4.0 : 0.25** | 76.6% | 17.0% | 11 | 3 | 2 | 68 |
| **5.5 : 0.20** | 80.4% | 12.9% | 13 | **10** | **3** | 75 |

Every row had **zero 40-breakers through Day 50**; the **first Food-core breach occurred on Day 60**, including the all-neutral 1:1 case. No original player Nurture core dropped below 40 in these six runs. All 30 residents remained alive in the main comparison; actual intervention counts, 10/20/30/40/50/75/100-day checkpoints, individual first-under-40/20 history and source evidence are in the JSON report.

The established **linear-clamped v0.1** formula on this same controlled world (1.6:0.4) yielded 90.0% vs 28.1% encounter odds, **12/15** Food believers ever below 40, **0** converts, and Saint termination on Day 68. Therefore do **not** compare its result as if it used the same probability model as the new sweep.

## 4. Interpretation

**40+ is already breakable at 1.0:1.0** once a real strategy outcome/need/sermon chain exists and multiple contacts accumulate. That is the main finding. A 1.6:0.4 ratio raises short-run faith pressure from 11 to 14 core breaches in this particular deterministic seed, but increasing the ratio further does **not** yield monotonic or reliably larger counts, because contact events, victim experience, belief reinforcement and Saint termination change subsequent world/RNG histories.

In fact, 8-point losses with a 10-day repeat rule can cross the 60 → below-40 threshold after three credible successful events. The identical first-break Day 60 across ratios suggests this cadence and evidence eligibility are the main bottlenecks in this fixture. Extending the multiplier is not the next useful tuning priority.

The existing 40+ immunity to **ordinary Priest preaching**, conversion below the original lower band, and offensive-Miracle Local Divine Presence restrictions are unchanged. This does not demonstrate three equally viable strategic counters nor a 100-day win for general gameplay.

## 5. Reproduction / rollback

```bash
cd poc/v2
npm test
npm run evaluate:oracle:core30 -- --days 100 --budget-ms 15000 --out reports/oracle-30-core-ratio-sweep-2026-10-14.json
npm run evaluate:oracle:core30 -- --only 1.6:0.4 --model linear-clamped --days 100
```

Tunable ratios and fixed 30-person fixture parameters live in `config/oracle-30-core-ratio-sweep-v0.1.json`. The experimental runner is `tools/oracle-30-core-ratio-sweep.cjs`. The original profile `config/oracle-specialization-v0.1.json` has **not** been changed, including its normal 1.6:0.4 defenses and default linear cap. Old opt-in v0.1 `dry-stress` Day-45 snapshot fingerprint remains **`ef11b77b`**, and the legacy pre-Oracle Day-300 fingerprint remains **`778899f9`**.

**Follow-up decision:** Instead of widening 1.6:0.4 directly to 5.5:0.2, test whether **8-point repeated faith loss** and **10-day minimum spacing** should be lowered/slowed; otherwise the near-frontier fixture can weaken 11/15 core even with a neutral matrix. A separate experiment can hold absolute initial pressures constant while rebalancing the two populations' risk. Do not merge these diagnostic odds into general gameplay without further evidence.
