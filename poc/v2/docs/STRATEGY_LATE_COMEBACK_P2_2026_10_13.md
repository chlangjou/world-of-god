# P2 — Late-Game Religious Comeback from One Identical Saved World

**Date:** 2026-10-13 (Asia/Taipei)  
**Branch:** `feature/opponent-difficulty-profiles-v0.3`  
**Status:** Completed **one bounded Day-300 save fork**, three independent **120-day** branches. All passed state validation, none aborted. **No balance, deity power, faith rule, or opponent policy was changed.**

## 1. Question

P1.1 showed that two useful God strategies starting at **Genesis** could mature 20+ followers into 40+ core by Day 240–360. But it did **not** show an actual comeback after a rival had already secured a 40+ native-village core.

P2 addresses the harder question: **Given the exact same Day-300 world where the AI already leads in both total and mature Faith, can the player loosen that core with existing legal God powers over the next 120 days?**

## 2. Fixed saved-world fork and resource discipline

Using the actual `poc/v2/src/sim.js` and unchanged Agriculture / Religion / Divine / Opponent profiles, create the `dry-stress` world with opponent difficulty `standard`. Advance passively for **300 days (900 Ticks)** and serialize the entire world exactly once. Restore identical copies for each experimental arm. The save preserves population, land, food, DP, cooldown, saints/priests, Oracles, AI state, and all RNG states.

- Snapshot serialized JavaScript string length: **853,910 UTF-16 code units** (the UTF-8 file byte size was not measured); reproducibility fingerprint **FNV-1a 32-bit `778899f9`**, **not a cryptographic hash**. Replayed forks must match this fingerprint and exact serialized restoration. We intentionally do not commit the large world snapshot; the runner regenerates it once and stores it in the Git-ignored `reports/.snapshots/` directory.
- At Day 300 the world has **52 living residents**; player vs AI Devotion 20+ = **12:39**, core 40+ = **8:20**, and weighted Faith contribution = **20:83**. Eight of the 20 AI core believers live in original native settlements (`n1`: 4, `n3`: 4); **zero** native-village residents currently follow the player.
- The same Day-300 snapshot is the sole origin of all three arms. A plan is selected at fork; there is **no per-Tick strategy search, no hidden player omniscience, no action substitution after rejection**.
- One fixed attempted Miracle every 21 days: Day **321, 342, 363, 384, 405** (five attempts); two `religion.spread` Oracle attempts on Day **301 and 391** for active strategies. Target coordinates are the own-side native village `n1` and contested village `n3`, determined once by the existing Genesis geometry policy. The rival AI keeps running its existing standard policy autonomously.
- Observe only days **300, 330, 360, 390, 420**, final action success/failure, cohort survival/affiliation and conversion deltas, not a giant per-person event stream.
- Measured in a **V8 isolate**: snapshot preparation **~9.74 seconds**; branches individually **4.05, 4.10 and 4.04 seconds**, total **~21.93 seconds** across separate stages. Total simulated workload **900 + 3 × 360 = 1,980 Ticks**. Native Node RSS has **not** been measured. The repeatable CLI uses **512 MB V8 heap limit** and per-30-day elapsed-time guards, not a strict OS RSS or external process time limit.

## 3. Player strategies

| Name | Oracle | Miracle policy (five fixed attempts, no fallback) |
| --- | --- | --- |
| `passive` | None | None |
| `frontier-welfare` | Spread on Days 301 and 391 | `ripening(n1)`, `rain(n3)`, `harvest(n1)`, `ripening(n3)`, `rain(n1)` |
| `frontier-offense` | Spread on Days 301 and 391 | `confusion(n1)`, `drought(n3)`, `lightning(n1)`, `confusion(n3)`, `drought(n1)` |

All commands still pass the normal Miracle/Oracle eligibility, attribution, DP, cooldown and Local Divine Presence checks.

## 4. Primary Day-420 result

**Primary outcome is genuine 40+ core believers**; mere 20+ affiliations are secondary.

| Day-420 measure | Passive | Welfare + Spread | Offense + Spread |
| --- | ---: | ---: | ---: |
| Player core 40+ | **10** | **9** | **9** |
| AI core 40+ | **29** | **29** | **29** |
| Player:AI 20+ | 12:39 | 12:39 | 12:39 |
| Original Day-300 AI core still living and AI 40+ | **20/20** | **20/20** | **20/20** |
| Original eight native-village AI core still AI 40+ | **8/8** | **8/8** | **8/8** |
| Original AI core dropping below 40 | 0 | 0 | 0 |
| Original AI core converting to player | **0** | **0** | **0** |
| Player rival conversions during branch | 0 | 0 | 0 |
| Miracle successful / attempted | 0/0 | **5/5** | **0/5** |
| Oracle successful / attempted | 0/0 | **2/2** | **2/2** |

The core checkpoints also remained AI-dominant:

| Day | Passive Player:AI 40+ | Welfare Player:AI 40+ | Offense Player:AI 40+ |
| --- | ---: | ---: | ---: |
| 300 | 8:20 | 8:20 | 8:20 |
| 330 | 9:24 | 9:24 | 9:24 |
| 360 | 9:25 | 9:25 | 9:25 |
| 390 | 10:26 | 9:26 | 9:26 |
| 420 | 10:29 | 9:29 | 9:29 |

By Day 420, **all three native villages still have zero player followers**; their AI core totals `n1=5`, `n2=5`, `n3=7`. The slight player-core difference (10 vs 9) does not prove that intervention directly lowered the player's Faith: it may reflect changed physical events and RNG draw sequences. The important result is that **none** of the original rival core members had defected or fallen below 40 **at Day 420**. Intermediate crossings by the same individuals were not separately logged.

## 5. Mechanism diagnosis — three reinforcing gates

1. **Ordinary preaching is unable to challenge established 40+ commitment.** The actual religion pulse exits early at `if(rival && p.devotion>=faithThreshold) continue`. Spread Oracle can improve real sermon reach and low-commitment conversions, but cannot by itself weaken rival-core residents above the cutoff.
2. **Miracle faith attribution needs a local witness context.** `faithContext()` requires at least one living 20+ worshipper of the casting God within **11 units** of the affected resident. In this Day-300 snapshot, **0 of the eight AI-native-core residents qualify**. Beneficial farming Miracles were cast successfully, yet there were **zero credited direct Miracle adoptions**, zero rival conversions and no rival-core decline. Successful physical spells are **not** synonymous with rival religious persuasion.
3. **Hostile intervention cannot ignore local Divine Presence.** All five offensive casts were rejected with `當地神性臨在不足，無法發動破壞／干擾神蹟`. Rejected casts do not spend DP.

Together these results expose a credible **late-game first-mover/bootstrapping lock-in**: once a town is all AI and its people are mature believers, the player's normal route of preacher-led adoption cannot enter, supporting miracles lack local religious attribution, and destructive miracles are disabled by local presence. Whether a longer campaign, other geographic seed or other already-supported player action breaks this lock remains **unproven**.

**Do not confuse this with P1.1:** choosing development or missionary **from Genesis** could obtain strong native allegiance by Day 360. **Switching to these limited counterattacks at Day 300** did not dislodge an entrenched rival core.

## 6. Decision / suggested next narrow prototype

**P2 is a negative result for the tested late-action policies.** Do not change global recruitment thresholds or Miracle prices yet. The next meaningful design decision is how a God can **establish the first credible foothold inside a rival-controlled 40+ region** without bypassing citizen autonomy:

- **World-mediated missionary bridge:** permit actual Priest/citizen travel and local contacts to generate a limited foothold (not direct forced conversion), then let standard religion logic apply.
- **Observable foreign Miracle testimony:** a small, attributed trace of an especially concrete Miracle could be learned via witnesses/inter-settlement communication without requiring an existing local 20+ follower, still subject to real outcome, repeated-exposure limits, gradual Devotion change and delayed personal decisions.
- **Explicit contested-belief / Faith Contest:** only if the two options above cannot provide adequate, affordable counterplay. Preserve the current 40+ immunity to ordinary casual preaching; no blanket lowering of faith thresholds.

Before implementing any of these, run one **small mechanic-scale thought experiment or bounded unit fixture** to identify the minimum viable opening and preserve the rule **“God expresses intent; world determines execution.”**

## 7. Reproduction, one bounded child process per stage

On this feature branch, from `poc/v2` (Node.js >=18; no dependency install):

```sh
npm run evaluate:late -- --prepare reports/.snapshots/p2-day300.json --budget-ms 15000
npm run evaluate:late -- --from reports/.snapshots/p2-day300.json --strategy passive --days 120 --budget-ms 12000
npm run evaluate:late -- --from reports/.snapshots/p2-day300.json --strategy frontier-welfare --days 120 --budget-ms 12000
npm run evaluate:late -- --from reports/.snapshots/p2-day300.json --strategy frontier-offense --days 120 --budget-ms 12000
```

Preparation validates the saved world and its fixed reproducibility fingerprint; all branches validate the **same** Day-300 signature. The script enforces a **120-day maximum** per branch. Time checks happen once every 30 simulated days; impose an external timeout locally if a hard deadline is required.

- [Machine-readable compact three-arm results](../reports/strategy-late-comeback-p2-2026-10-13.json)
- [P2 source runner](../tools/strategy-late-comeback-p2.cjs)
- [P1.1 — why 180 days was too short for new core maturity](STRATEGY_MATURATION_P1_1_2026_10_13.md)
