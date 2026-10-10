# Settlement Economy, Occupations and Food Security — v1 Contract

Status: **Issue #4 design converged (2026-10-10)**. Structure and behavior are agreed; numeric balance is **provisional and adjustable after playtesting**. This is a design specification, not a declaration that the `web-poc` branch implements it.

Related specifications: [Population #3](POPULATION_MODEL.md), [Simulation architecture #2](SIMULATION_ARCHITECTURE.md), [Oracle #6](ORACLE_DIVINE_CALLING.md), [Religion #8](RELIGION_PRIESTHOOD_TEMPLE.md), [Spatial Miracle capability #7/#8](DIVINE_PRESENCE_MIRACLES.md). Further ownership: [Issue #9](https://github.com/chlangjou/world-of-god/issues/9) for governance/war, [Issue #11](https://github.com/chlangjou/world-of-god/issues/11) for playable scope.

> **Design priority: a meaningful playable world, reasonable first-pass values, and adjustable parameters; not a high-fidelity economics, logistics or famine simulator.** Precise balancing is deferred until actual play.

## 1. Economy and autonomous decisions

- A Settlement supports survival, work, production, consumption, construction and limited exchange without the player micromanaging citizens.
- **Occupation, Proficiency and Activity are separate**. Occupation is a relatively stable livelihood/identity; Proficiency is domain capability that can grow from experience; Activity is the action currently undertaken. Someone may do building work without becoming a Builder.
- Every actor retains decision authority: Individual acts, Household makes shared life/relocation decisions, Settlement proposes public work and stores common inventory, Polity owns policies/war, Religion conveys Oracle influence. **Work Demand never directly assigns a job or overwrites an individual's activity.**
- High Devotion and an applicable Oracle may strongly motivate a feasible act; there is no arbitrary "anti-RTS" obedience penalty. Actual skills, resources, danger, family needs and decisions still govern outcomes.

## 2. Small bounded occupation / skill / activity vocabulary

v1 proposes **eight broad occupation families** as a convenience/working set, *not* eight exclusive job classes, nor a hard coded maximum:

| Family | Example activities | Capability examples |
| --- | --- | --- |
| Food producer | farming, hunting, fishing, husbandry | agriculture, hunting |
| Resource gatherer | woodcutting, stone gathering, mining | gathering, mining |
| Builder | housing, storage, shrine/temple construction, maintenance | construction |
| Craftsperson | tools, clothing, metal or glass processing | crafting, material processing |
| Caregiver | care for dependents/sick, basic medical assistance | care, medicine |
| Guard / combatant | patrol, defense, soldiering | combat |
| Religious worker | preaching, rites, organization | preaching, organization |
| Explorer / pioneer | exploration, resource survey, settlement scouting | exploration, survival |

- **Saint** is divine qualification, **not** a ninth exclusive occupation; Saints can have other work. Priest is a social/religious function and can be part-time (#8).
- Base farming, gathering, simple carrying and similar tasks have **low entry barriers** for healthy adults. Specialized medicine, advanced craftsmanship or demanding construction may need skill, tools and/or facilities.
- A single activity may use multiple proficiencies. Learning/skill and occupation-change rates are balance parameters. Adding a new recipe/activity **must not require a new occupation**.
- Children, elders and ill persons use their actual capacity from #3 rather than automatically supplying a full adult workload.

## 3. Time allocation and activity choice

First-pass healthy-adult time budget: **1/3 Rest, 1/3 Work, 1/3 Other**, conceptually ~8 hours each in a 24-hour day. This is a **coarse budget**, not a minute-by-minute NPC schedule or mandatory 8 hours of production every day.

- Rest: sleep/recovery.
- Work: productive activities and professional public service (including a Priest's regular duties).
- Other: household life, social/religious participation, caring, leisure, ordinary individual needs.
- Construction and crafting consume Work budget; a citizen listening to a sermon normally uses Other. Oracle reception itself need not be an allocated work shift.
- Under famine, war or emergencies time allocation may flex through **simple, configurable** modifiers; do not create an intricate rostering system.

Conceptual decision path:

```text
Actual need + available resources + public work demand + local context + Oracle pressure
  -> filter physically/skill feasible actions
  -> Individual/Household evaluates competing goals
  -> spends available activity budget, producing actual outcomes
```

## 4. Work Demand as a small independent module

The base Work Demand module has **two primary inputs**:

1. **Basic Demand**: food, shelter, basic repair/maintenance and other necessities derived from population, households, shared storage and environment.
2. **Trade Demand**: actual exchange needs/surpluses for settlement-to-settlement trade where feasible; not a copy of Basic Demand counted again as new consumption.

```text
Basic Demand + Trade Demand -> Work Demand summaries -> autonomous work choice
```

- Work Demand describes desired *activity, work quantity, priority and available inputs*, not jobs forced upon named people.
- Individual/household personal actions and Religion/Polity intent are **additional decision inputs**, not reasons to turn the base Work Demand module into a universal NPC scheduler. Later explicit projects may produce bounded work requests through the same interface.
- Avoid demanding resources that have already been allocated or duplicating trade + consumption claims for one need.
- Separate work *offered* from work *performed* so labor shortages, inaccessible materials and choice remain observable.

## 5. Inventory and simple common economy

Use exactly two primary inventory ownership levels in v1:

- **Household Inventory**: storable goods held/consumed by a household; not automatically confiscated for public use.
- **Settlement Shared Storage**: community-managed storable goods, allocated according to **actual basic need**, not fixed individual entitlement or a marketplace.

For suitable *storable new material output*, the **initial allocation policy** is **20% retained by the producing household : 80% transferred to common storage**, **tunable**, not a requirement that the *current total inventory balance* always be 20:80. Do **not** apply this ratio to hours of care, combat, sermons, structures, repairs or intangible services. Do not infer the production split from the percentage of job types devoted to food.

- A household normally consumes its available food first and requests the shortfall from shared storage. Other households with separate stores may have different food security, even when the Settlement aggregate appears sufficient.
- Shared stock feeds basic household shortages, public work support, reserves and only then feasible surplus trade. If communal resources are insufficient, ration sensibly without conjuring goods.
- **Normal -> shortage -> severe shortage** are *derived conditions* from actual supply, expected needs and available stocks; they are not an independent expensive simulation FSM. In shortage: conserve/ration, reasonably prioritize dependent survival; in severe shortage: raise food-work, trade and voluntary migration pressure. Death is a consequence of prolonged severe stress, not an immediate penalty for one deficit.
- No complete monetary economy, wages, property-law simulation, wealth distributions, tax bureaucracy or complicated household-to-household market required for v1.


### Minimum viable food-access and household loop

The agreed household/shared storage model needs a **coherent path**, not detailed logistics: production -> eligible allocation -> reachable withdrawal -> actual consumption -> work, reproduction and migration outcomes.

- Food security means a household's own stock **plus realistically reachable and allocable** shared food. Distant, ineligible or already allocated stocks must not count as free household reserves.
- Deposit and withdrawal can intentionally have different rules; they must not accidentally disagree because one path checks distance and the other checks Settlement affiliation. Migration/rejoining must update both sides consistently.
- Hunger, Work Demand, reproductive intent, rationing, hardship and relocation must use compatible **effective accessible food** rather than contradictory private-only thresholds.
- Real isolation and famine may still cause deaths, with inspectable causes and possible autonomous adaptation. Avoid conjuring food, forcing births or making shared stores magically universal.
- MVP requires only simple deterministic distribution/eligibility logic; a full commodity market or item logistics simulator is unnecessary. The 20:80 split alone does not make this system playable.

## 6. Bounded resources and recipe-driven production

Maintain a **small shared resource catalog**, data-driven recipes, and only limited processing depth. Initial concept: roughly **10 raw/base inputs, 5 processed inputs and 2 general-purpose products**; these are a *design budget, not mandatory fixed database columns*.

| Base / raw inputs (illustrative 10) | Derived / processed (illustrative 5) | Generic products (illustrative 2) |
| --- | --- | --- |
| Food, Wood, Stone, Fiber/Hide, Clay, Sand, Metal Ore, Fuel, Precious Ore, Herbs | Preserved Food, Textile, Metal, Glass, Precious Metal | Tools, Weapons |

- A World water source can initially be a local environmental constraint, **not** a new per-household transported inventory item. Later water logistics can be added if play requires it.
- Resources should be actual inventory quantities with consistent unit/transaction rules. Recipes consume inputs, work/time/required capability and produce outputs; no free materials created by having a building.
- Prefer short recipes (typically no more than two processing stages): e.g., metal ore + fuel -> metal -> tools; sand + fuel -> glass; food -> preserved food. This is a content-guideline, not an engine structural limitation.
- Food subtypes, metal alloys and dozens of separate tools/weapons are **not necessary** for first playable. Research/capabilities may unlock recipe variants without multiplying core occupation classes.
- Production feasibility and costs vary with local environment, accessible inputs, proficiency, tools and equipment. Specific yields, wear and exact resource quantities are balance data.

### Building recipes and functional optional materials

A building recipe distinguishes **required structural materials** from **optional/special functional material contributions**. The same mechanism supports houses, granaries, workshops, shrines and temples.

- Basic hut: mainly wood/fiber/clay. Upgraded housing may use stone/metal, but no compulsory building tech ladder.
- Temple follows #8: autonomously proposed/built/maintained in response to religious demand; **not** an independent generator of Divine Power or Local Divine Presence. Temple Core footprints do not overlap.
- **Large Temple example: ideal Wood : Stone : Glass = 6 : 4 : 2.** Wood and Stone satisfy its structural requirements; Glass is optional to achieve an increased **religious activity / preaching influence radius**, not spatial Miracle eligibility.
- Assuming structural requirements are met, a v1 **tunable linear interpolation** is:
  ```text
  radiusMultiplier = 1 + (maxRadiusMultiplier - 1)
                         * clamp(glassAvailable / glassIdealForThisBuildingScale, 0, 1)
  initial maxRadiusMultiplier = 2.0
  ```
  Glass 0 -> **100%** base radius; half the scaled ideal -> **150%**; ideal or more -> **200%**. For bigger buildings both required recipe amounts and the relevant ideal Glass amount scale; neither unlimited glass nor a bigger raw count alone gives uncapped multipliers.
- Radius applies to social/religious organization/communication, *not* God-specific Local Divine Presence, dominance, Miracle range or instant Devotion conversion. A doubled circular radius can cover ~4x area; tune carefully after play.
- Precious metals or other rare ingredients may support future prestige/quality variants, but no unapproved direct Faith/Divine Power bonus is implied.

## 7. Trading Post: abstract exchange boundary

Full caravan simulation, detailed pathfinding for goods, merchant NPCs, prices and market clearing are **out of scope** for the v1 economy. If/when cross-settlement trading is present, **Trading Post** handles bounded periodic aggregate exchange:

- Match *real* exportable surplus with actual unmet imports; preserve quantities.
- Apply simple tunable capacity and (optionally) range/availability, delivery interval and loss/efficiency so goods do not freely teleport across the entire world.
- Update Settlement Shared Storage (and downstream household withdrawals) in batch; no per-crate or per-caravan entity required.
- Trading Post is **not a prerequisite** for S0–S3 first playable; early worlds must survive using basic production and reserves.

## 8. Food security, drought, population and divine intervention

Food security is important to the gameplay loop, but must stay **lightweight**.

- Track production, need, **accessible** household/shared reserves, coverage and a short-lived shortage-duration/stress signal. Avoid unbounded individual diet/starvation histories.
- Storage has capacity and preservation loss; natural yields depend on land, rain and available work, not a magic fixed farm output. Emergency agricultural work may help but cannot guarantee compensating for drought.
- Scarcity consequences escalate approximately as: conservation/rationing -> lower productivity and birth intention -> trading/migration/prayer -> serious health decline -> exceptional deaths after **prolonged severe shortage**, in line with #3. Report **births, deaths and migration separately**; migration from a Settlement is not global mortality.
- The "how many good harvest years sustain a drought year?" metric is an **exploration/diagnostic**, **not** a compulsory survival threshold. We do not require every settlement to withstand a severe drought without God.
- **Rescue Miracles are expected normal play**, especially rain, harvest aid, healing and acceleration. Default **support/rescue Miracle cost-effectiveness should be forgiving**, with meaningful local benefit from one or a few casts; do not demand high-frequency rescue micromanagement everywhere. Exact DP, range and cooldown values remain #7 balance work.
- Prolonged severe multi-year droughts should be comparatively uncommon in default climate presets. Players may choose harsher circumstances/modes; variability remains.
- **Drought itself may also be a Miracle.** Opposing interventions use the same World/weather/physical consequence logic, with category-specific #7 eligibility and cast-center Divine Presence checks. Destructive Miracle may harm own believers; no automatic moral immunity.
- Multiple settlements may be too far apart to cover with one rain Miracle or unavailable due to local capability; inability to save an entire world is acceptable. A saved village should still be rewarding. A non-rescue playthrough should not instantly trigger arbitrary Faith penalties or guaranteed global collapse.
- Do not add per-settlement disaster micromanagement or force a dedicated heavy climate/economy model just to raise realism. Weather can be a coarse input and Miracle modifies it via the World layer.

## 9. Runtime and scale contract

Engine direction: **Godot is provisionally selected**, with simulation core separable from rendering and capable of headless tests (#2/#11). **Godot vs Python speed is not assumed**: Python prototypes are design probes, not runtime benchmarks.

- **Multi-rate / event-driven simulation**: high-frequency only for currently relevant individual activity; slower aggregate economy, religion, work-demand and demographic checks; on-demand events for disasters/Miracles.
- Prefer Settlement/Religion × Region aggregates, batched production/inventory operations and bounded hot state. **Do not require a full per-NPC decision or Godot scene-node traversal on every render frame**.
- Avoid heavy trading routes, full commodity markets, deep crafting chains and per-person permanent emotion/economic histories in v1.
- Validate speed, pause/fast-forward and save/replay with actual engine at increasing populations; use tunable fidelity/data structures, and only optimize/harden when measurements show bottlenecks.
- Prototype scenario results are **not authoritative balance or performance guarantees**. Earlier sample calculations (e.g. 150 inhabitants/100 adult workers, 8h work, rain rescues) were assumptions exploring qualitative plausibility, not calibrated coefficients.

## 10. Parameters, scope, acceptance

Rule parameters should allow playtest adjustment without changing state ownership or recipe/occupation architecture, including:

- time budgets; skill entry requirements and proficiency gains; work selection preference;
- food need/yield, raw-material yields, seasonal rain modifiers, resource accessibility;
- 20:80 output-allocation default, shared distribution policy, reserve capacity/loss, shortage/rationing thresholds;
- recipe amounts, tools/wear, building production time, Glass ideal, Temple radius multiplier ceiling and curve;
- Trading Post capacity/range/settlement interval/efficiency if enabled;
- natural disaster severity/frequency/duration; population health, fertility and migration sensitivity to shortage;
- Miracle support efficacy/cost/cooldown/area by #7; cross-God competition remains under existing spatial Miracle rules.

**Accept v1 conceptually when:**
1. One ordinary Settlement can feed itself under plausible parameters and build/maintain basic housing while different occupations/skills participate in multiple activities.
2. The Resource/Recipe chain accounts for inputs and output; a builder can use wood/stone/metal without requiring dozens of occupation IDs. No double-counted Basic/Trade demand.
3. Required building materials constrain construction; an otherwise complete Large Temple without Glass has 100% base social radius and at ideal 6:4:2 reaches 200%, without manipulating Local Divine Presence.
4. Shortage triggers conservation, activity shifts, voluntary trading/migration and gradual population impacts, **not instant mass death**; birth/death/migration remain distinguishable.
5. A plausible rain Miracle delivers meaningful local disaster relief; a wider world may still be too large to rescue completely; deliberate Drought Miracle produces physical consequences by World rules.
6. Adjustable numeric parameters and playtest difficulty profiles do not mandate a deep simulation or a hard-coded historic era/technology tree.
7. Godot implementation retains separable simulation ownership and can be performance-tested at multiple population scales and fast-forward speeds.
8. Households with zero private food but genuinely accessible public stores can consume and make coherent work/reproductive decisions, conserving actual stocks.
9. Remote/migrated households use consistent access rules; a controlled favorable multi-year population scenario can produce real births rather than being blocked by private-inventory-only thresholds.

**Explicitly deferred:** calibrated balance values, large-scale economy benchmarks, deep trade/market physics, full NPC logistics, modern/firearm-era warfare, obligatory technology tree, complete religion/politics economy. Cold/early metal weapons are sufficient initial warfare content, while weapon technologies/recipes can later expand without replacing the economic model.

Next practical action: use #11 to bound S0–S3 first-playable scope; use #7 for Miracle catalogs/cost/pacing and #9 for political combat details. Further numeric calibration belongs to actual playable iteration rather than additional extensive paper simulations.
