# Oracle Specialization / Reset — experimental v0.1

**Branch**: `feature/opponent-difficulty-profiles-v0.3` (not `main`).  
**Scope**: Opt-in PoC balance experiment; old saves and original rules remain valid.

## Gameplay intent

One Saint carries **one sustained Oracle** at a time. Individuals may hear several Saints but act on only the strongest credible/current calling; higher-priority **feasible** work is still decided by the resident, not by God. Hunger and survival take precedence.

| Oracle | Prioritized use of limited work/opportunity | Weakness demonstrated to another God |
| --- | --- | --- |
| `food.produce` 存糧 | Real farming/foraging and reserves, less discretionary care/housing | If a specific household really misses recent child care and rival nurturing village provides it |
| `family.nurture` 育兒 | Care work, minor bounded child recovery, greater conception chance *only after actual care* | If housing is needed and rival explorers completed a real home recently |
| `settlement.explore` 探索 | Wood, fiber, stone, building and pioneer opportunities; less surplus farming | If accessible food security is low while a rival food-focused village has demonstrably more reserves |
| `religion.spread` 傳教 | Existing Priest / nonwork sermon cadence | No direct 40+ core bypass |
| `life.balance` Reset | “神很滿意你們的行為，放下心中的執著，去追尋你們自己的需求。” | Ends the active Saint focus; does not affect Faith directly or undo food/people/homes |

A specialized Oracle does **not expire automatically** in this experiment; one Saint has at most one active Oracle. Reset is available without DP or quota use (avoids being trapped by an obsolete order); **issuing the next specialization uses the ordinary Saint quota**. A dead/departed Saint still terminates their Oracle. Legacy `concludeOracle`, expiry, quotas and rules remain unchanged for non-opt-in worlds.

## Counterplay is factual, not a preset type multiplier

A core believer at Devotion **40+** remains immune to **ordinary preaching**. Only with all of the following does a strategic challenge cause a bounded doubt: its own current received Oracle has a genuine unmet need; a competing religion has performed the matching counter-Oracle **actions**; a real household/town result is present; and a recently preaching follower of the rival faith in a nearby actual settlement provides a sampled **cross-town encounter**. The encounter is recorded per person with source town, rival Oracle and observed result. No follower is created, no religion is switched, no divine power is credited for an unproven improvement.

After a particular person has credible witnessed contact, only currently live follow-up preaching from that origin may continue weakening the **below-40** band within a 75-day memory window, eventually reaching existing below-20 conversion mechanics if it persists. Generic outsider teaching cannot bypass 40+. Offensive Miracle Presence checks are untouched.

The cross-town meeting is a **coarse social-exchange PoC**, not simulated animated walking or an already-complete travel system. All parameters are in `config/oracle-specialization-v0.1.json`; this is a model to test, not finalized balance.

## Reproduce and revert

- `npm test`: existing regression tests plus `tests/oracle-specialization.test.cjs`.
- `npm run evaluate:oracle -- --days 60 --budget-ms 30000 --out reports/oracle-strategy-quick-2026-10-13.json`.
- The runner generates the same `dry-stress` Day-45 snapshot once, restores it for **five** 60-day arms, keeps standard autonomous AI and all normal religious/economic laws. No forced player followers, no 20+ as proxy for victory. Each day records whether the original AI 40+ cohort actually crosses below 40 (not only endpoint). Fixed actions include the Reset on Day 76.
- New browser PoC loads `config/oracle-specialization-v0.1.json`. To opt out in programmatic creation, **omit** `oracleStrategyProfile`; loading an old save keeps its original Oracle semantics. **Do not** rebuild or overwrite `main`.
- Historical passive Day-300 fingerprint `778899f9` must remain unchanged when no Oracle profile is supplied.

## Limitations and next decisions

- Childbirth takes the real pregnancy duration; a 60-day check sees conceptions but not new babies.
- In the Day-45 baseline all 17 households already have homes. Exploration therefore has little or no direct construction opportunity during this short window. This is a **real gameplay gap**, not evidence it performed successfully. Improving physical demand for frontier houses may need a separate minimum slice, not simply buffing conversion rates.
- Core doubt is meaningful movement, **not a forced conversion or victory**. Recheck durable 40+ counts, original cohort paths and evidence origins. Do not extend the simulation for years just to manufacture a winner.
