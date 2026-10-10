# Miracles and Divine Power — v1 Contract

Status: **Issue #7 design converged (2026-10-10)**. This is a gameplay/architecture contract, **not** a claim of implementation or calibrated balance. Exact numerical coefficients remain configurable and subject to playtesting.

Related authoritative contracts: [Core Principles](CORE_PRINCIPLES.md), [Gameplay Loop](GAMEPLAY_LOOP.md), [Faith / Religion checkpoint](FAITH_RELIGION_ORACLE_DRAFT.md) (#5 remains the owner of the base Devotion economy), [Spatial Divine Presence](DIVINE_PRESENCE_MIRACLES.md) (#7/#8), [Religion v1](RELIGION_PRIESTHOOD_TEMPLE.md) (#8), [Oracle v1](ORACLE_DIVINE_CALLING.md) (#6), and [Settlement Economy v1](SETTLEMENT_ECONOMY_OCCUPATIONS.md) (#4).

> **God expresses intent; world determines execution.** A valid Miracle reliably injects its defined direct physical/biological effect. Weather, water flow, health, agriculture, society, faith, and other downstream results follow the owning simulation systems.

## 1. God-driven capability, not civilization-driven unlocks

- Each God retains its achieved Divine Capability permanently: unlocking a power is **irreversible**, even after all followers disappear.
- In **Sandbox v1**, the initial Miracle catalog is **entirely available from the start**. There is **no Miracle unlock tree**, per-skill prerequisite, civilization-era gate, or faith threshold that locks a catalog entry.
- The nine entries are an initial bounded vocabulary, **not a claim that the eventual Miracle taxonomy or relationships are complete**.
- If later added, an individual Miracle's unlock policy must remain independently configurable and a granted unlock remains permanent. Story/Scenario Mode may add custom civilization, discovery, or special-event conditions without changing Sandbox's core contract.
- Civilization/environment may determine what an effect can act upon: Harvest requires crops to benefit; Accelerate requires an applicable process. This is world feasibility, **not a civilization unlock**.
- Separate three concerns: permanent ability ownership; current **Divine Power (DP)** to pay for a cast; **Local Divine Presence** to authorize the selected cast at its center.

## 2. Initial nine-Miracle catalog

These are distinct player-facing skills with **independent Mastery, experience and cooldown**, even if they use the same World subsystem.

| Miracle | Direct effect / simulation input | Initial design role |
| --- | --- | --- |
| Rain | Add rainfall / water input over an area and duration | Usually rescue/support; extreme direct rainfall can be destructive |
| Harvest | Increase existing crop growth/yield potential or reduce crop failure | Support |
| Heal | Improve health/recovery of valid living targets | Support; no automatic resurrection |
| Accelerate | Speed up applicable growth/production/recovery processes | Support; does not conjure inputs or command workers |
| Protect | Reduce relevant incoming harm over an area/time | Support |
| Drought | Suppress rainfall / water replenishment for an interval | Environmental/destructive intervention |
| Lightning | Cause a localized lightning strike | Usually offensive; fire/secondary damage follow World rules |
| Wildfire | Ignite susceptible material/vegetation | Usually destructive; propagation follows fire/World rules |
| Storm | Create a selected combination of intense weather effects | Often destructive; depends on direct selected effect |

Rain, Drought and Storm may share climate simulation code but **do not share skill progression**. Rain at extreme settings may cause flooding, but it does not automatically gain Storm's wind effects. Future abilities (resurrection, creation of life, meteor, parting seas, large-scale terrain change, etc.) are content expansion rather than v1 prerequisites.

## 3. Capability is evaluated per cast, not fixed by skill name

- Classify the **requested direct physical effect** and magnitude of **each cast**, not the Miracle name, player's declared moral intention, intended victim, or observed casualties afterward.
- A normal Rain cast remains support even if it incidentally floods an already saturated area. A directly specified supernaturally extreme Rain cast may need **destructive/high-tier capability** even if described as rescue.
- Broad ordinary rain is not automatically hostile merely because its radius is large; relevant direct intensity/duration/physical-effect limits are configurable per Miracle.
- High-tier offensive/destructive or terrain-changing casts require **both** sufficient effective Local Presence density and dominant share at the **cast center**, first-pass **strictly over 50%** share; lower-tier support remains usable under its own local limits.
- Eligibility checks use **only the center**, never a per-cell re-gate of the affected area. Crossing religious/political boundaries is allowed. Own followers, saints, settlements and temples have no immunity.
- The spatial capability contract's **60-second simulation-time eligibility hold** remains in force. High stored global DP or Mastery does not bypass the local capability gate.

See [Spatial Divine Presence v1](DIVINE_PRESENCE_MIRACLES.md) for the authoritative presence computation and policy interface.

## 4. Independent five-level Mastery

- Each Miracle has its own permanent **Mastery Lv1–Lv5**, with progression from actual uses. **A larger meaningful cast should contribute more than a trivial one**; do not give identical experience for every click.
- Higher Mastery improves **divine efficiency**: the **same direct effect** costs **less DP and less cooldown** than it did at lower Mastery.
- Conversely, a higher-Mastery god can cast a **larger standard effect** for the **same baseline DP and baseline cooldown** that a novice spends on their smaller standard effect.
- The player is not forced to cast at the highest learned output. Small, precise casts remain available and become cheaper/faster as Mastery rises.
- Default Mastery does **not** automatically transfer between skills, even in related domains.
- No obligatory mastery-grinding quests, complex per-target experience ledger, or skill-tree engine for v1. Mastery brackets, experience curve and efficiency multipliers are tuneable data.

Example (illustrative, **not** fixed balance): a novice Rain Lv1 standard cast costs 10 DP / 10 cooldown units; after learning Rain Lv5, that same small effect might cost 2 DP / 2 units, while the larger Lv5 standard cast again costs 10 DP / 10 units.

## 5. Shared global DP plus weak natural recovery

- Each God has **one world-wide spendable Divine Power pool**, **not** a separate pool per region/temple. Gods do not share the same ownership pool with one another.
- Worship/Devotion remains the main renewable source, using #5's effective Devotion bands **0:1:2:4:8** and the existing temporary, bounded Fervor rules.
- Even with **zero followers**, a God has a **weak natural DP recovery**. First-pass tuning target: approximately **one third of a minimally viable small faith community's DP generation**, not one third of an ever-changing live "smallest god" measurement. Make the reference rate/ratio configurable.
- The natural trickle replenishes **spendable DP only**; it does not by itself grant Devotion, Local Presence, Mastery, Miracle unlocks or long-term Divine Capability upgrades.
- The pool remains capped; waiting centuries must not create infinite stored DP. Exact rate, cap, starting reserves and difficulty profiles are #5/#7 balance parameters.
- A religion can become dormant with no believers while its God's previous capabilities and Mastery persist. [Religion v1](RELIGION_PRIESTHOOD_TEMPLE.md) supplies **Divine Spark / Genesis** and an autonomous **First Listener / first Saint** path to regain believers; this bootstrap path must not depend on an already nonzero Local Presence field.
- First Listener receives Oracle as a Saint/Saintess, **not** an automatic Priest appointment or guaranteed ordinary-person compliance.

## 6. Cast input, power cost and simple cooldown

Each player cast supplies: **Miracle type, cast center, target area/radius, intensity, duration**, with optional quick-preset selection. Validate against local capability and available global DP **before** spending.

- **DP is the main limiting cost.** Bigger area, stronger intensity and/or longer time increase cast workload and DP price. Very large/extreme effects can be **nonlinearly expensive**; spending nearly all available DP on a catastrophic cast is permitted when the center's capability allows it.
- **Mastery provides efficiency** for both DP and cooldown. The same small cast gets cheaper as Mastery grows; a maximal standard cast at each new level can be normalized to the same baseline DP/cooldown.
- Use simple **data-configured workload, cost and cooldown factors**, not a complex general-purpose optimization formula. Exact weights/exponents, caps and minimum charge are balancing data. An "improbability" factor, if retained in tuning, means direct supernatural violation or bounded environmental resistance; **it must not make essential rescue impossibly expensive just because rain is naturally unlikely during a drought**.
- **Each Miracle has its own cooldown.** Cooldown can rise modestly with cast workload but is a light anti-spam limiter, **not** a second expensive long-term resource system. Keep a minimum cooldown and bounded/sublinear faith-based recovery acceleration (#5).
- Cooldowns, durations and the existing presence eligibility hold use **simulation time**. Pause, speed changes, save/load and deterministic replay preserve their semantics.
- **Rain and Drought initial v1 default:** maximum cast duration **one simulated month** and standard cooldown **one simulated month**, configurable. A smaller cast at higher Mastery may have shorter cooldown. Do **not** offer arbitrary multi-year uninterrupted Rain/Drought casts; such effects would require repeated eligible spending.
- Continuous Miracles expire automatically at their chosen duration. **No manual early cancellation, refund, rollback or extra cancellation state** in v1. The environment may remain wet, dry, damaged or healed after a Miracle expires.
- Other Miracle types may have shorter, immediate or different duration/cooldown defaults rather than all being forced to one month.

## 7. Natural overlap and world consequences

- Miracles do **not** mutually exclude or automatically dispel one another. Concurrent Rain/Drought, multiple Rain casts, Harvest during Drought, or Protect with Lightning all act through their common underlying simulation state/rules.
- Outcome is determined by physical state, availability of inputs and relevant system behavior, not special pairwise anti-Miracle rules.
- A successful Rain cast really produces its specified rainfall; it does **not** guarantee a harvest, prevent flood, ensure a city's survival or force anyone to worship.
- Harvest/Accelerate improve applicable processes within resource feasibility: no free food/materials, forced work or magical inventory fabrication from a mundane blessing.
- Simulation ownership stays with **World** for physical/climate changes, **Individual** for health, **Settlement** for economy/inventory, **Religion/Individual** for belief/attribution, etc.; the Divine actor injects validated events/requests, not untracked cross-layer writes.
- Significant outcomes may be captured in History with real causal provenance; avoid per-frame/per-person persistent Miracle logs.

## 8. Faith feedback and no spam farming

- A cast does **not** grant automatic permanent Devotion.
- Witnessing an event may increase Spiritual Receptivity; **credible attribution** to a specific God and **real fulfilled needs/prayers** can materially increase that God's Devotion.
- Prayer and **Collective Petition** are information/coordination, not mandatory Miracle prerequisites or additional fuel. One matching cast may satisfy many real needs.
- Repeated casts against the **same already-resolved crisis** must not generate linear permanent faith rewards. A future distinct crisis can produce a fresh response.
- Use short-lived region/religion needs/evidence and meaningful historical events, **not** unbounded individual Miracle-exposure ledgers.
- Do **not** add a separate punishment for "Miracle dependence." Natural diminishing value, DP, cooldown and world feasibility are sufficient v1 constraints.

## 9. Player interface and intervention cadence

- **Every Miracle is manually cast by the player.** No automated rescue, auto-attack, auto-defense or priority policy in v1.
- Support **Quick Cast** presets (e.g. small / current-Mastery standard) and **Advanced Cast** customization (radius, intensity, duration / estimated DP). The player can freely cast without a prayer, or locate relevant places through Prayer/Collective Petition.
- Before confirmation, show **direct effect**, expected area/duration, DP cost, projected cooldown, current Mastery, and Local Presence eligibility / reason if blocked. Predictions of downstream benefit or risk must not be presented as guaranteed outcomes.
- Favor **one or a few effective rescue casts** over repetitive maintenance clicks. Rain, Harvest, Heal, and Accelerate should be useful and affordable by default. Prolonged multi-year natural droughts should be uncommon in default climate presets (#4); challenging scenarios may differ.
- Time acceleration and passive observation remain valid play styles. The world does not require continuous divine micromanagement.

## 10. Scope and future extension

The v1 contract fixes **system behavior and ownership**, not particular absolute DP costs, exact skill XP thresholds, mastery multiplier tables, Miracle effect curves, climate coefficients, difficulty pacing or optimized runtime implementation.

- New skill types / relationships, ability unlock trees, advanced supernatural violations, and Story/Scenario-only prerequisites are **deferred** until there is a more complete Miracle taxonomy.
- Normal-play technology/era gates are **not** a Sandbox default.
- Use data-defined skills/effects and configurable casting policy; separate simulation from rendering, prefer multi-rate/event-driven effects and bounded derived aggregates.
- The legacy **web-poc** has not been validated against this v1 contract; this commit is a **design checkpoint**, not gameplay implementation.

## 11. Acceptance scenarios

1. All nine v1 Miracle types appear available in Sandbox without an era/skill prerequisite. Rain Mastery upgrades do **not** unlock/advance Storm or Drought.
2. Rain Lv5 casting the former Lv1-size rain uses **less DP and shorter cooldown** than Rain Lv1 for the same direct effect; the current maximum standard preset can still use baseline cost/cooldown for a larger effect.
3. Larger custom area/intensity/duration increases DP cost; a sufficiently funded catastrophic extreme cast still requires center-based destructive capability.
4. Ordinary Rain remains support even if wet terrain later floods; direct extreme rainfall requires appropriate destructive classification before cast.
5. High absolute Presence but low dominance, or high dominance but insufficient density, does **not** permit gated high-tier destructive casts; the current contract's threshold hold works on simulation time.
6. Center authorized/area crossing rival territory can proceed and can harm the caster's own followers; center unauthorized/area overlapping a friendly zone cannot borrow permission.
7. Zero followers does **not** delevel God/Mastery; capped weak natural DP regeneration continues and Divine Spark can bootstrap a new First Listener without violating the ordinary destructive-Miracle gate.
8. Rain and Drought effects coexist in World climate; stopping their ongoing input by expiry does **not** undo already changed World state.
9. Default Rain/Drought durations cannot exceed one simulated month; baseline cooldown is one simulated month, with smaller/high-Mastery casts allowed shorter cooldown under tuned settings. No cancel action is needed.
10. Credible answered prayer may raise Devotion; blind spamming the same satisfied need does **not** multiply durable faith rewards.
11. No player automation casts any Miracle; Quick and Advanced Cast paths both use the same validation and accounting.
12. A deterministic ruleset replay preserves DP, Mastery, cooldown clocks, spatial qualifications, Miracle effect event order and world consequences.
