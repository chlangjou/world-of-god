# Population, Family, and Reproduction

Status: Resolved from Issue #3

## Design goal

Population is not a settlement counter. It emerges from living Individuals and their Households.

The model should be deep enough to generate meaningful demographic stories, but light enough to preserve a playful God-game tone.

> **Deep enough to create stories; gentle enough to remain a game.**

## 1. Population source of truth

Living Individual entities are the authoritative population state.

Settlement and Polity population totals may be cached for UI/performance, but they are derived values.

Birth, aging, migration, and death operate on real Individual/Household entities and then update aggregates.

## 2. Household as demographic unit

Household is a first-class but intentionally lightweight entity.

Initial responsibilities:

- member list,
- partner/family links needed by reproduction,
- dependents,
- housing membership,
- shared domestic resources,
- care burden,
- household migration preference.

The first implementation does not require a deep romance or family-drama simulator.

## 3. Individual life cycle

Minimum demographic state:

- birth time / age,
- reproductive profile,
- health,
- fertility,
- pregnancy state where applicable,
- recovery state where applicable,
- dependency stage,
- household membership,
- partner/reproductive relationship references,
- alive/dead.

Suggested coarse stages:

```text
Infant → Child → Adolescent → Adult → Elder → Dead
```

Age thresholds are data/config driven.

Children are real Individuals because they may later become historically important adults, but their AI is intentionally much lighter than adult AI.

## 4. Reproductive profiles

The simulation core should not hard-code one species-specific reproductive model.

Use a species-defined reproductive profile such as:

- can_gestate,
- can_fertilize,
- gestation_duration,
- recovery_duration,
- fertility_curve,
- reproductive_age_range.

Human presets may map these to conventional male/female reproductive roles.

This allows future species to use different reproduction rules without rewriting the demographic core.

## 5. Reproduction is opportunity-driven

Reproduction is evaluated at a slow demographic cadence or on relevant triggers, never every render/simulation frame.

Conceptually:

```text
eligible relationship/opportunity
× fertility
× health
× food security
× housing capacity
× compatibility
× household reproductive intent
× cultural/religious modifiers
× divine calling modifiers
→ conception attempt
```

Conception creates pregnancy state where applicable.

Birth occurs after gestation and creates a new dependent Individual.

## 6. Reproductive constraints should emerge naturally

A gestational role is naturally limited by gestation and recovery.

A non-gestational role may participate in more conception opportunities only when social/cultural rules allow it.

Examples:

- strict monogamy may minimize throughput differences,
- plural-partner norms may increase them,
- famine/housing shortage may suppress reproduction regardless of designation.

Do not encode a fixed sex-based reproduction bonus/penalty when the same result can emerge from biological and social constraints.

## 7. Pairing and family formation

Initial matching may consider:

- age eligibility,
- kinship exclusion,
- proximity,
- existing partnership constraints,
- simplified compatibility/preferences,
- cultural/religious rules.

A deep romance simulator is out of scope for the first playable version.

## 8. Household capacity is soft

Households should not use an arbitrary hard member limit.

Pressure emerges from:

- available living space,
- food,
- care capacity,
- existing dependents,
- wealth/resources,
- cultural expectations.

Overcrowding may reduce well-being, lower willingness for additional children, increase demand for housing, or increase migration pressure.

It should not simply block birth because `household_size == max`.

## 9. Dependents create short-term cost and long-term value

Children should not behave as miniature workers.

Dependents create:

- food demand,
- housing demand,
- care burden,
- reduced available adult labor,
- future labor/population/followers.

Population growth therefore creates a real trade-off.

More children are not always immediately optimal.

## 10. Reproductive intent

Desired family size / willingness is derived from multiple inputs rather than owned by one layer.

Possible inputs:

- individual preference,
- partner preference,
- existing dependents,
- food security,
- housing,
- safety,
- prosperity,
- culture,
- religion,
- mortality pressure,
- oracle/divine calling.

This produces a current reproductive intention rather than a fixed lifetime number.

## 11. Chosen Parent / Breeder

A divine calling to become a **Chosen Parent** does not create births directly.

It may influence:

- willingness,
- matchmaking priority,
- reproductive priority,
- household/social support,
- reduced competing work burden,
- religious prestige,
- partner opportunity where social rules permit.

The final demographic outcome still depends on biology, relationships, gestation/recovery, food, housing, culture, and oracle compliance.

This allows the mechanic to remain humorous and useful without becoming a population cheat button.

## 12. Migration

Household migration is the default when family/dependent relationships make collective relocation sensible.

Possible triggers:

- food insecurity,
- housing shortage,
- danger,
- work opportunity,
- family connections,
- religious pressure,
- polity pressure,
- oracle influence.

Individual migration remains valid for roles/contexts such as explorers, soldiers, priests, exiles, merchants, or unattached adults.

## 13. Mortality

Minimum mortality causes may include:

- old age,
- severe/prolonged starvation,
- disease or health failure,
- violence,
- environmental hazards/disasters.

Natural aging may use simplified age-dependent mortality.

The first implementation does not need detailed medical realism.

## 14. Tone and hardship model

The game is intentionally light, playful, and readable.

When demographic pressure increases, prefer consequences in approximately this order:

1. reduced willingness to have children,
2. delayed reproduction,
3. lower productivity,
4. rationing/support behavior,
5. migration,
6. prayer / requests for help / social response,
7. illness or hardship,
8. death only when conditions are severe or prolonged.

### Children

- Infant mortality is not a core gameplay mechanic.
- Children are not intentionally modeled as first/preferred starvation victims.
- Households/settlements may prioritize dependents when distributing support.
- Pregnancy complications, abandonment, and similar family trauma are out of scope for the baseline system.

### Death presentation

Death remains necessary for aging, war, disease, disasters, and meaningful consequences, but:

- avoid graphic presentation,
- keep deaths comparatively sparse and understandable,
- prefer growth slowdown, hardship, migration, and recovery before mass death,
- do not let suffering become the dominant optimization problem.

## 15. Demographic aggregates

Settlement/Polity may derive and cache:

- population,
- birth rate,
- death rate,
- age distribution,
- dependency ratio,
- fertility rate,
- housing pressure,
- food pressure,
- migration pressure.

These indicators may guide higher-layer decisions, but they do not replace Individual/Household state.

## 16. Culture and religion hooks

Culture/religion may later modify:

- partnership structure,
- reproductive age norms,
- kinship restrictions,
- household formation,
- desired family size,
- celibacy rules,
- attitudes toward Chosen Parents.

Issue #3 defines the hook only; detailed cultural systems are deferred.

## 17. Genealogy and memory

Persistent historical genealogy belongs on disk.

A Person may retain durable identifiers such as:

- person_id,
- parent_ids,
- birth event,
- death event.

RAM should keep only family/kinship data needed for the current simulation, such as:

- household relationships,
- partners,
- children,
- close relatives,
- bounded recent generations needed for kinship checks.

Older lineage can be loaded from historical storage when needed.

This follows the project rule:

> **RAM serves the present; disk preserves the past.**

## 18. Performance

Demographic systems are slow/event-driven.

Examples:

- aging: scheduled/periodic,
- pairing: periodic or triggered,
- reproductive intent: periodic/dirty-state,
- conception: periodic opportunity,
- birth: scheduled event,
- migration: pressure-triggered or periodic,
- mortality: scheduled/periodic hazard.

No demographic subsystem should require per-frame evaluation.

## 19. First playable scope

For S0–S3, include:

- real Individual entities,
- lightweight Households,
- age/life stages,
- reproductive profiles,
- simplified pairing,
- gestation and birth,
- dependent children,
- food/housing effects,
- aging/death,
- household migration,
- Chosen Parent modifier hooks.

Not required initially:

- deep romance,
- detailed genetics,
- inheritance law,
- complex divorce/family politics,
- pregnancy complications,
- detailed infant mortality,
- extensive kinship politics.

## 20. Minimum coherent demographic prerequisites (Issue #11 playtest lesson)

A fertility threshold can be tuned, but **the meaning of accessible food** is a system contract. Demographic decisions must consider realistically reachable household food and shared supplies, not private stock alone or distant/unavailable settlement totals.

- Pregnancy/conception opportunity still depends on real living partners, reproductive profiles, health, gestation/recovery, housing/care and available food. Planning for a household's share of communal stock must not consume, reserve or double-count it.
- Migration must update the household's food access, Settlement affiliation and survival choices. Genuine isolation can lead to hardship or death, but accidental deposit-only access cannot be accepted as emergence.
- Use controlled **favorable, multi-year / approximately 1,600 simulated day** scenarios with eligible people, actual food access and shelter to show real births occur under selected deterministic seeds. This is a regression fixture, **not** a promise that every stochastic world must grow.
- Check reasons for delayed conception (partner, food access, shelter, pregnancy/recovery, health). Do not force births, create resources or remove meaningful scarcity to satisfy a test.

Low-frequency decisions remain sufficient: this does not require detailed reproduction or logistics simulation.
