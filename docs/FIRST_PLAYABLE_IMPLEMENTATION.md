# World of God — Issue #11: First Playable Vertical Slice (MVP-0)

**Status:** Implementation-ready scope contract and Codex handoff (2026-10-10). Not an assertion that the features exist.

**Design invariant: God expresses intent; world determines execution.**

**Baseline:** main at e2f0f73be2d2792ebced238205f7970a754bfd3f. Issue: [#11](https://github.com/chlangjou/world-of-god/issues/11).

## 0. Authority and implementation instructions

The following design specifications are authoritative in their respective domains:

- [Core gameplay loop (#1)](GAMEPLAY_LOOP.md)
- [Simulation layers, ownership and causality (#2)](SIMULATION_ARCHITECTURE.md)
- [Individual, Household and population (#3)](POPULATION_MODEL.md)
- [Settlement economy (#4)](SETTLEMENT_ECONOMY_OCCUPATIONS.md)
- [Faith / Devotion / Divine Power working checkpoint (#5)](FAITH_RELIGION_ORACLE_DRAFT.md) and [Issue #5](https://github.com/chlangjou/world-of-god/issues/5)
- [Oracle and Calling (#6)](ORACLE_DIVINE_CALLING.md)
- [Miracles, Mastery and global DP (#7)](MIRACLES_DIVINE_POWER.md)
- [Religion, Saints and Priests (#8)](RELIGION_PRIESTHOOD_TEMPLE.md)
- [Spatial Divine Presence (#7/#8)](DIVINE_PRESENCE_MIRACLES.md)

This document deliberately **reduces the first implementation's content**, not the agreed Sandbox v1 rules. Where an earlier draft conflicts with a newer authoritative file, follow the newer file. Numbers here are first-pass *parameters*, not finalized balance or architecture invariants. Raise any conflict requiring a design change instead of silently modifying the established contract. The older **web-poc** branch can inform UI and pacing but is not the implementation/faith/Oracle authority.

**Codex handoff:** Implement successive runnable, tested increments using the shared Godot Simulation Kernel. Commit implementation separately from this document. Report actual tests, evidence, missing features and commit SHAs; do not declare the entire final Sandbox v1 implemented when MVP-0 passes.

## 1. First player experience

One small river-valley world runs autonomously. Real individuals and households gather, eat, rest, build and **form** an initial settlement. An initial belief/Divine Spark path allows a first Saint to emerge through a mortal/world process. The player observes a food need, manually casts **Rain**, and issues a **food.produce Oracle** to a Saint. World moisture, crops, real work, household food and religious reactions produce visible consequences. Devotion changes can strengthen the global DP pool and allow a later intervention.

~~~text
Observe need / Prayer
   -> choose Rain Miracle or food-production Oracle
   -> validate direct divine act
   -> World physical effect OR Saint receives/transmits intent
   -> real people/households respond autonomously
   -> food, environment and meaningful outcomes change
   -> credible attribution affects Devotion and global DP
   -> observe causes and choose next intervention
~~~

Target: in the curated default playtest, the user can **experience and understand one meaningful Rain result and one Oracle-driven behavior/result within roughly 5–10 wall-clock minutes**. This is a manual playability target, never a justification to script fake success. The world also continues without player commands. No conventional Game Over or scripted quest is required.

### Scenario preset (configurable, not hard-coded)

| Aspect | MVP-0 first-pass setting |
| --- | --- |
| World | 1 river-valley preset, about 64×64 cells |
| Initial population | 24–40 actual Individuals |
| Initial families | 6–10 Households |
| Initial established Settlements | 0; favorable environment for formation |
| Expected settlement | >=1 in a controlled seed/scenario |
| Player god/religion | 1, with religious data using stable IDs for future competition |
| Receiver | autonomous viable First Listener / Saint |
| Implemented Miracle | Rain |
| Implemented Oracle canonical type | food.produce |
| Storable items | Food, Wood, Stone, Fiber |
| Environmental water | World condition; no transported water inventory |
| Time controls | Pause, 1×, 4×, 16× |

Curated starting food, skills, household relationships, and receptivity are permissible **scenario settings**, not hidden simulation overrides. Do not start with an already formed functioning Settlement or directly appoint a citizen to a mundane job. Genesis/Divine Spark supports a viable first religious receiver and later continuity without directly selecting a specific citizen as a player-controlled puppet.

## 2. MVP feature boundary: S0–S3

### S0 — Living World

Required:
- Coarse map topology, terrain, soil suitability, water proximity, local moisture, basic rain/weather and renewable crop/food sources.
- Real ID-based Individuals with age/stage, health, hunger, position, life/death, effort, skills and current Activity; basic autonomous food/gather/rest choices.
- First-class lightweight Households with members/dependents, shared items and basic care/space needs.
- Crops respond to moisture, and usable Food requires feasible work/harvesting. No direct Food creation from Rain.
- Simulation survives and changes state without God intervention.

Deferred: fluid/weather realism, complete ecosystems, animals with complex AI, minute-level NPC routines, intricate pedestrian pathfinding.

### S1 — Settlement

Required:
- Settlement **emerges** when social clustering, shelter need, environmental viability and resources allow it. No divine RTS-style construction placement.
- Distinguish **Occupation** (livelihood), **Proficiency** (skill) and **Activity** (current behavior); initially content may cover food producer, gatherer and builder, without making them exhaustive or exclusive.
- Work Demand computes *Basic Demand* (food, housing, maintenance) rather than named forced job orders. Retain a Trade Demand extension that can return zero until trading is implemented.
- Real housing/storage construction consumes material, capability/work and time. Shared Settlement Storage and Household Inventory are independently owned.
- For appropriate **new storable output**, initial configurable allocation is **20% producing household / 80% shared storage**; not an invariant of total inventory and never an allocation of intangible service.
- Households consume accessible food, request necessary shared help; deficits cause rationing/changed work and eventually hardship, not instant mass death.
- Lightweight real demographics: ages, configurable reproductive profiles, pairing/opportunities, gestation, births, dependent care, aging/mortality and Household migration/relocation. Use slow/event updates. Controlled tests may provide near-due pregnancies/advanced ages rather than waiting for years.
- Population counts are derived from live Individual entities. Household movement can be local; no second fully built town is necessary.

Deferred: detailed genetics/romance, inter-settlement trade, markets, many processing recipes, taxes, polity, warfare and complex kinship.

### S2 — First God / Religion / Rain

Required:
- Player God and Religion have stable IDs. Religion begins with a believer; temples are **not** required for religion, direct Prayer or Saint reception.
- Saint receives raw Oracle; Priest preaches/organizes and **cannot receive raw Oracle merely by holding office**. The same person can be both. A viable First Listener path and a fallback after receiver loss prevent permanent communication soft-lock while viable believers remain. Do not fake universal receiver status.
- Person owns religion_id and devotion 0–100. Starting band weights from #5: **0–19→0, 20–39→1, 40–79→2, 80–89→4, 90–100→8**. Follower boundary **40+**, not the old web-poc's 35. Minor ordinary drift, Priest consolidation of weak believers and real attributed evidence differ from instant conversion.
- One **global, capped Divine Power** pool per God. Worship generates most DP; bounded weak natural recovery remains with zero followers (first-pass reference about 1/3 of a viable small community). Natural DP does not create Local Divine Presence, believers or Mastery. Tune initial DP to allow an early meaningful rescue.
- Individual Prayer may reach God directly; Priest/Temple not mandatory. Compact need summaries may help the player locate an emergency. Prayer never automatically casts.
- The **only implemented Miracle effect** is Rain. Manual input: center, area/radius, intensity, duration; Quick Cast and a minimal Advanced Cast panel; preview estimated DP cost/cooldown and any validation rejection.
- A valid cast consumes global DP; Rain applies real rainfall input to World for the chosen duration, naturally modifying moisture/crops and potentially adverse outcomes. World/Settlement/Individuals own downstream consequences. No guaranteed harvest, no conjured food, no automated rescue and no per-cast permanent faith reward.
- Configurable Rain **maximum duration: one simulated month; standard cooldown: one simulated month**, with simpler/smaller or higher-Mastery casts permitted shorter cooldown under #7. Effects expire automatically. Do not add early cancel/refund/rollback. Keep per-skill cooldown and permanent Mastery state/hook, even if full Lv1–Lv5 tuning is deferred.
- Permanent Devotion is primarily affected by **credible attributable fulfillment of actual needs/Prayer/Oracle**, not raw cast count; repeated casts addressing the same already satisfied crisis cannot generate linear durable gains.
- Low-tier supportive Rain can be eligible under the configurable low-density support policy. Divine Presence is derived from real geographically located **weighted believers**, with capability queried **at cast center only**. MVP may compute presence on demand; high-tier density/dominance maps and 60 simulated-second hold are future policy features. Neither global DP nor temples bypass capability.

**Important content distinction:** Full Sandbox v1 design includes **nine available Miracle types** without skill tree/era unlocks, each with independent Mastery/cooldown; MVP-0 implements **Rain only** to bound engineering. UI must not pretend other eight have working effects or add new unlock conditions. Keep extensible catalogs/interfaces.

### S3 — First Oracle / Calling

Required:
- Implement structured canonical intent **food.produce**, asking for increased food-production priority. It is *never* a direct assignment of Activity, Occupation, production targets, or inventory.
- God targets **one eligible Saint**. Saint reliably understands core intent; local interpretation and preaching/social contact pass it to relevant people. No global broadcast to every Individual.
- Assignment has id, god_id, owning saint_id, type/payload, intended audience, issue/expiry times, state and provenance. State/lock/quota is **per Saint**, not global. Reserve interface for later Radius batches; no Radius UI required yet.
- #6 baseline quota: initial/max **4**, **+1 per 3 simulated months**; issuing one assignment costs **1**, concluding one assignment costs **1** and can lower available quota to **-1**, but not below. Issuing needs quota >=1. Same active canonical intent type to the same Saint is blocked; different Saints remain independent later.
- An Oracle stops **only** on expiry, explicit God conclusion or death of its owner Saint. Mundane success does not auto-conclude; successor does not inherit past assignments. Expiry/death costs no quota. Provide a minimal conclusion action/diagnostic for testability.
- Active duration should be seasons/months (e.g. adjustable six-month scenario default), with bounded fading attention; propagation cannot extend expiry. No unbounded per-person sermon history.
- Individuals independently choose feasible acts given skills, food, family need, alternative work and Calling pressure. High Devotion can make willing compliance strong, not automatic; resources/physical impossibility still constrain results. No artificial anti-RTS disobedience penalty.
- Observe stages: issued → Saint received → preached/heard → accepted/deprioritized → attempted → outcome. An Oracle may cause partial success or failure; show reasons.
- Real fulfillment with attribution may alter Devotion/DP. Temporary Fervor if implemented is a bounded local/settlement aggregate, not permanent Devotion, extra DP pool or Local Presence. Repetition cannot produce unbounded reward.

## 3. Kernel architecture and state ownership

### Core model

Use **Godot 4.x + GDScript** initially, without assuming it outperforms Python until measured. Ordinary lightweight data objects plus explicit system modules are preferred over one authoritative Godot Node per simulated NPC.

~~~text
Godot presentation (Map / UI / Camera / Inspector / visible proxies)
                  ↑ Read-only Snapshot / significant Events
                  ↓ Player Command
Simulation Session: Clock / Scheduler / Ruleset / Seeded RNG
   World | Individual | Household | Settlement | Religion | Divine
                  ↓
           Bounded History / Save
                  ↑
      same Simulation API in headless tests
~~~

Godot Nodes/Sprites represent visible entities, **not** mandatory actors owning simulation state. Culling, hiding or destroying presentation proxies must not alter whether residents exist or act.

Module boundaries and authority:

| Owner | Authoritative state / decision |
| --- | --- |
| World | Terrain, weather/moisture, crops, natural resources and world conditions |
| Individual | Person life/hunger/health, skills, affiliation/Devotion and autonomous immediate Activity |
| Household | Relationship/membership, household inventory, dependents, housing and domestic/migration choices |
| Settlement | Formation, common inventory, housing/construction, Basic Work Demand and derived local statistics |
| Religion | Saint/Priest role functions, Oracle assignments, propagation, Prayer aggregation, evidence/Calling |
| Divine | God-global DP, Rain policy, per-skill Mastery/cooldown and validation of intervention |
| Session / History | Simulated time, event schedule, PRNG, deterministic command ordering and significant events |

**Only the owner mutates authoritative state.** Cross-module operations are direct explicit APIs, bounded requests/events or correctly owned transactions, not universal bus routing. Settlement does not set Person Activity. Religion supplies Calling/evidence; Individual decides work and adjusts Devotion. Divine validates and injects a physical effect; World updates weather.

### Minimal entities (illustrative names, not frozen schema)

~~~text
WorldState   { time, seed, terrain/moisture/crops, active_effects, rng_state }
Person       { id, pos, household_id, settlement_id?, age/stage, health,
               hunger, alive, capabilities, occupation?, activity,
               religion_id?, devotion, reproductive_state }
Household    { id, members/partners/dependents, dwelling_id?, inventory,
               shared_needs, relocation_state }
Settlement   { id, center/extent, derived_member_index, structures,
               shared_storage, basic_work_demand, shortage_state }
Religion     { id, god_id, saint_roles, priest_roles, oracle_assignments,
               bounded_prayers_and_local_attention }
God          { id, global_dp, dp_cap, skills/mastery, cooldown_deadlines }
Oracle       { id, god_id, saint_id, intent_type, audience/payload,
               issued_at, expires_at, status, cause_ref? }
HistoryEvent { id, sim_time, kind, subjects, actual_parent_event_ids?,
               used_decision_reasons?, context? }
~~~

Use stable entity IDs, not Node paths. **Living Individuals are the only population truth**; settlement population and religious aggregate Devotion are derived/cached. Resource transactions conserve quantities and do not produce negative inventory. No unbounded per-Individual lifelong prayer/sermon/emotion logs; bounded hot events and aggregates only.

### Interfaces (conceptual, subject to pragmatic naming)

~~~text
Simulation.start(scenario, seed, ruleset)
Simulation.advance_to(sim_time) / advance_by(sim_duration)
Simulation.submit_command(player_command, at_sim_time) -> Result
Simulation.snapshot(view/query) -> ReadOnlySnapshot
World.apply_rain(validated_effect)
Settlement.compute_work_demand(settlement_id)
Individual.choose_activity(person_id, decision_context)
Religion.issue_oracle(god_id, saint_id, intent, expiry) -> AssignmentResult
Religion.calling_pressure(person_id, current_context)
Divine.evaluate_miracle(god_id, type, center, area, intensity, duration)
Divine.cast(validated_player_command)
Persistence.save/load(versioned_state)
~~~

**Evaluate before spending:** reject a Miracle/Oracle before charging DP/quota or mutating unrelated state. Return explicit blocked reasons. No generalized plugin framework or heavy ECS requirement.

### Simulation clock and multi-rate scheduler

- The shared clock uses **integer simulated seconds** (or an equally precise integer unit). Ruleset/calendar maps days/months; first-pass month may be 30 days, tunable. Time-based DP, cooldown, pregnancy, Rain expiry, Oracle expiry and Saint quota all share it.
- **Pause** stops simulated time and all dependent changes. **1×/4×/16×** change wall-time-to-sim-time mapping only, not model rules; tune the 1× day duration for playability.
- A deterministic scheduler advances to a requested target time, executing every due scheduled event in time order and using stable tie-breaks. Fast-forward must **not skip** consumption, births, cooldowns, death, Rain expiry, Oracle expiry, or quota refill.
- Proposed first-pass cadence, all configurable: local weather/moisture ~6 sim hours; current Individual activity ~4–6 hours or event; economic production/consumption and demand daily; Religion communication/evidence daily or event; demographic opportunity monthly/event; deadlines immediate at their due simulated time. Do not run a full per-NPC AI evaluation every render frame.
- Use explicit seeded RNG state/streams and stable entity/event ordering. Same supported ruleset + seed + initial conditions + ordered timestamped player actions must produce the same authoritative output.
- Headless Runner and game UI use **the same Simulation Session**. Rendering frames only request advances and display snapshots.
- Single-threaded baseline. Profile first; batch/optimize hot paths or consider native code later, not preemptively.

### Persistence and causal history

- Preserve simulated time, ruleset/version, RNG state, entity/inventory state, active Rain inputs, DP/cooldown, Saint quotas, Oracle assignments/deadlines and pending events in a basic save/load.
- Significant HistoryEvent examples: Settlement formed, home built, prolonged shortage, birth/death/migration, Miracle cast, prayer fulfilled, Oracle reception/transmission/result/expiry and consequential faith change.
- Record **actual** direct parents and decision reasons; do not invent precise causes retrospectively. For example: Rain → moisture changed → crop output improved → food deficit reduced → attributable need fulfilled.
- Keep recent events bounded in RAM with a persistence seam. Full Issue #10 historical graph/search can wait.

Suggested directory layout, optional:

~~~text
godot/project.godot
godot/scenes/
godot/scripts/simulation/      # session, clock, systems and data
godot/scripts/presentation/    # UI, map, inspector, visible proxies
godot/data/                    # scenarios and tunable rules
godot/tests/                   # headless deterministic scenarios
~~~

## 4. Minimal UI / player observability

A single game screen with panels is sufficient. Required:
1. Pan/zoom/select World map, residents, household and Settlement; moisture/rain/crop state is visible.
2. Simulated date, Pause/Resume, 1×/4×/16× and restart with seed/preset.
3. God: global DP and recovery, Rain target/area/intensity/duration, Quick/Advanced mode, estimated cost/cooldown and failure reason.
4. Religion: follower/Devotion summary, living Saint and quota, issue food.produce, inspect active/rejected/ended Oracle.
5. Individual/Household/Settlement inspector: inventory, food shortage, work priorities, current Activity vs Occupation, affiliation/Devotion, reason for work response/refusal.
6. Bounded timestamped event feed: answered prayer, environmental effect, religious transmission and meaningful outcome with actual explanation.
7. Basic manual save/load or equivalent usable interface.

Placeholders are fine. Avoid final art, advanced charts and UI polish before the full loop is played.

## 5. Acceptance checklist / Definition of Done

Use controlled seeded scenarios. Claims apply to **those test fixtures**, not all possible stochastic worlds. Automate headlessly where possible and preserve seed/ruleset/commands as reproducible evidence.

- [ ] **A — Autonomous S0:** run >=90 simulated days without player input or crash; real people perform meaningful activities, environment/food changes; no negative inventory or invalid references.
- [ ] **B — Settlement S1:** begin with zero established Settlements; at least one is formed autonomously in a suitable controlled seed during the configurable scenario window (initial test window <=90 simulated days), without scripted finished-building placement.
- [ ] **C — Conservation/economy:** inputs/outputs and labor reconcile; shared and household stores differ; new output split is parameterized; shortage alters behavior without fake instant production/death.
- [ ] **D — Population:** controlled birth, death and household relocation each alter real entities/counts and preserve family membership/age constraints. No per-frame demographic scan is necessary.
- [ ] **E — Rain:** successful cast spends correct global DP, respects center validation, bounds, cooldown and duration, and creates real World rainfall/moisture; food comes from actual farming/gathering. Invalid cast does not spend. Effects end on simulation time with no rollback.
- [ ] **F — Devotion/DP:** follower boundary 40, contribution bands 0:1:2:4:8; recognized *fulfilled* need can raise an Individual's Devotion and subsequent DP rate; already-resolved repeated cast cannot infinitely farm lasting devotion. Zero-follower natural DP recovery produces no Local Presence.
- [ ] **G — Oracle rules:** eligible Saint gets food.produce and spends Saint quota; invalid target, exhausted quota or same-Saint same-type active lock rejects clearly. Refill, conclusion down to -1, expiry and Saint death work; mundane success alone does not end assignment; successor does not inherit it.
- [ ] **H — Autonomous Oracle consequence:** pair identical seeded scenarios with and without a valid communicated Oracle; demonstrate at least one feasible Individual's decision/priority **changes because of Calling**. A second test demonstrates insufficient resources/feasibility may block or partially satisfy the instruction. No direct forced work assignment.
- [ ] **I — Clock:** Pause freezes state. Identical simulated duration and timestamped inputs at different display speeds yield equivalent simulation state; large fast-forward steps process every due event deterministically.
- [ ] **J — Replay and save:** same seed/ruleset/input log reproduces authoritative outcome; save/load preserves pending clocks/RNG/DP/faith/Oracle and resumes identically within one supported version.
- [ ] **K — Headless:** a documented command executes all automated scenarios without rendering and reports a reliable pass/fail code.
- [ ] **L — Performance evidence:** record CPU time per system, sim-days/wall-second, population, memory and backlog for gameplay 24–40; measure separate exploratory **1,000 and 10,000** population probes. No 10k real-time guarantee is implied.
- [ ] **M — Human playtest:** from the default preset, in roughly 5–10 real minutes, a player can observe self-directed life/settlement, intervene with Rain, send food.produce through a Saint, inspect a **real environmental/economic consequence**, see **real autonomous decision influence** and understand related Faith/DP feedback. No fabricated scripted outcomes or manual unit commands.

M is a qualitative product gate, **not** a fixed machine-performance or guaranteed-win condition.

## 6. Implementation stages for Codex

| Step | Deliverable | Must demonstrate |
| --- | --- | --- |
| P0 Foundation | Godot project, rules/preset loader, IDs, simulated clock/scheduler, seeded RNG, headless runner, minimal map | Pause/time/seed deterministic smoke test |
| P1 S0 | Terrain/moisture/crop state, Person/Household, hunger and gathering/work/rest, inspector | A + beginning of C |
| P2 S1 | Settlement emergence, housing/materials/storage, Basic Work Demand, demographic events | B/C/D |
| P3 S2 | First Listener, Faith/DP, Prayer, Rain cast/effect, God UI | E/F + early M |
| P4 S3 | Per-Saint quota/Oracle assignments, propagation, Calling integrated in Individual decisions, reason/event trace | G/H + complete M |
| P5 Stabilize | Save/load, headless regressions, time control, benchmarks and 5–10-minute pacing review | I/J/K/L/M |

Each step should remain runnable and testable. Attach concise implementation notes and actual test commands/results to Codex's handoff. Do not stop at data schema scaffolding or substitute a hard-coded animated story for autonomous simulation.

## 7. Explicit exclusions and extension rules

**Out of MVP-0:** executable effects for the other eight Miracles, destructive/high-tier spatial permissions, multiple competing active religions, Radius multi-Saint Oracle UI, Temple/Glass recipes, political Polity and warfare, inter-settlement Trading Post, money/markets, advanced processing, technology/skill unlock trees, full five-level Mastery balance, deep kinship/genealogy, high-fidelity drought/fluids, complete History #10 graph, polished art, large-N native optimizations, heavy ECS or distributed runtime.

**Do not violate even while deferring content:**
- Individual agency; no direct God job/move commands.
- Saint != Priest, Prayer != Oracle, temporary Fervor != permanent Devotion, God-global DP != Local Presence.
- Occupation != Proficiency != Activity; stored Food != unharvested crops.
- Religion may later cross political boundaries and other religions; avoid singleton identity assumptions even though one active religion suffices now.
- Other Miracle types are absent because **not yet implemented**, not forbidden by an invented skill tree. Each later cast uses center-only Presence checks plus cost/cooldown; direct cast effects are reliable, subsequent world consequences not guaranteed.
- Keep configuration data-driven and preserve replay boundaries. Optimize only after measurements.
- Issue #11 may be marked implemented/closed **only after** agreed acceptance; this document commit itself is not implementation completion.
