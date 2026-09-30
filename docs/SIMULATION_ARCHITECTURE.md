# World Simulation Architecture

Status: Resolved from Issue #2

## Purpose

This document defines the high-level simulation layers, state ownership rules, event flow, causality principles, persistence boundaries, and reproducibility goals for **World of God**.

It intentionally does not define detailed population, economy, faith, or religion formulas. Those belong to later design issues.

## 1. Layers are ownership boundaries, not a hierarchy

The simulation is not a simple parent-child tree.

An Individual may simultaneously belong to:

- a Household,
- a Settlement,
- a Polity,
- one or more religious/social affiliations.

Religion may cross political borders.

Therefore, a simulation layer primarily defines:

1. the authoritative state it owns,
2. the decisions/rules it owns,
3. the events or requests it emits,
4. the events, queries, or snapshots it consumes.

## 2. Core simulation layers

### World

Owns:

- terrain and topology,
- climate and weather,
- water and soil,
- ecology,
- spatial resources,
- environmental hazards and disasters,
- simulation/world time.

The World layer produces physical conditions. It does not decide social policy.

### Individual

Owns:

- body and life state,
- age, health, hunger, energy, safety,
- traits and skills,
- knowledge and perception,
- personal relationships and affiliations,
- personal faith,
- immediate goals and actions.

Individual decisions should use information available to that individual, even when the player can inspect broader simulation truth.

### Household

Owns:

- family / partner / dependent grouping,
- shared domestic resources,
- housing membership,
- care obligations,
- household-level family/reproductive choices,
- some relocation and migration decisions.

Household is a first-class entity, but its first implementation may remain lightweight.

It exists to avoid forcing every demographic and domestic decision into either Individual or Settlement.

### Settlement

Owns:

- local population membership,
- shared storage and inventory,
- housing and local infrastructure,
- labor demand,
- production and consumption aggregates,
- local governance needs,
- local safety,
- migration pressure.

A Settlement may create demand or policy pressure, but it does not directly overwrite an Individual's authoritative state.

### Polity

Owns:

- political membership,
- territorial claims,
- leadership and government,
- diplomacy,
- taxation / tribute / high-level resource policy,
- war and peace,
- strategic migration or colonization,
- law and policy.

**Polity** is intentionally used instead of **Civilization** as the implementation concept.

Culture, ethnicity, language, technology, and civilization identity may later become separate cross-cutting systems.

### Religion

Owns:

- religious affiliation graph,
- religious institutions,
- priests and prophets,
- temples, cults, sects,
- doctrine and tradition,
- oracle transmission and interpretation,
- schisms,
- aggregated devotion and religious authority.

Religion is explicitly cross-cutting and must not be modeled as a child of Polity.

A single religion may span multiple settlements and hostile polities.

## 3. Cross-cutting systems

### Divine actor

The player/god is an external causal actor.

It injects:

- Genesis/start conditions,
- Miracles,
- Oracles.

It does not own mundane world state.

### History and provenance

History is not a simulation actor.

It is a persisted projection of significant simulation events plus the causal provenance required for explanation, replay support, debugging, and player-facing historical inspection.

## 4. State ownership rule

> **A layer may directly mutate only the authoritative state it owns.**

Other layers should interact through:

- requests or intent,
- events,
- read-only queries/snapshots,
- explicit transactions when atomicity is required.

Example:

A Polity should not directly execute:

```text
individual.occupation = Soldier
```

Instead:

```text
Polity: military demand/policy rises
    ↓
Settlement: soldier labor demand rises
    ↓
Individual: evaluates occupation
    ↓
some individuals accept or reject military work
```

Likewise, Religion must not directly set an individual's faith to a target value.

It can produce institutions, rituals, doctrine, social pressure, fulfilled or failed oracles, witnessed miracles, and other inputs that the Individual layer evaluates.

## 5. Semantic ownership is strict; implementation is pragmatic

The state-ownership rule is a design contract, not a requirement to route every low-level operation through an expensive message bus.

Performance-oriented batch/vectorized operations are allowed.

Example:

A flood affecting a large region may be processed as a batch by the World system.

The important constraint is that the correct owning system performs the state mutation and cross-layer side effects remain explicit.

## 6. Causal propagation

Prefer explicit state transition and causal propagation over hidden cross-layer mutation.

Example:

```text
World: drought
    ↓
crop potential falls
    ↓
Settlement: food production falls
    ↓
food shortage / labor demand changes
    ↓
Household + Individual: stress / occupation change / migration
    ↓
Settlement: migration pressure rises
    ↓
Polity: border pressure / political reaction
    ↓
Religion: prayer / interpretation / devotion changes
    ↓
God: optional Miracle or Oracle
    ↓
new causal input enters the world
```

Not every low-level transition must become a permanent historical event.

## 7. Decision ownership and derived values

Authoritative decisions belong to the layer that owns the acting entity.

Examples:

- eating, walking, accepting work → Individual,
- household relocation → Household,
- local labor demand → Settlement,
- declaration of war → Polity,
- institutional oracle interpretation → Religion,
- rainfall → World.

Derived values may be computed from lower-level state and cached.

Examples:

- settlement population,
- average faith,
- food security index,
- migration pressure,
- military strength.

A cached value must not become a second conflicting source of truth.

## 8. Multi-rate simulation

All layers share one simulation timeline, but they do not need one update cadence.

Expected direction:

- immediate/local Individual actions → relatively frequent or event-driven,
- Household decisions → slower/event-driven,
- Settlement aggregates → periodic,
- Polity strategic decisions → slower,
- Religion → mixed event-driven and periodic,
- environmental/climate systems → their own cadence.

Expensive derived statistics may be event-driven or scheduled.

This is an architectural allowance, not a fixed tick schedule.

## 9. Determinism and reproducibility

Within a declared simulation/ruleset version, the simulation should be reproducible when given the same:

- world seed,
- Genesis/start state,
- rules/configuration version,
- player input/event log,
- deterministic random streams.

Random decisions should use controlled PRNG streams rather than wall-clock/global randomness.

Exact bit-for-bit replay across arbitrary future versions is not required.

The goal is deterministic replay within a supported version for:

- debugging,
- regression tests,
- balancing,
- long-duration simulation analysis,
- reproducing emergent failures.

## 10. Causal provenance

The system should avoid fake causal precision.

Significant events may distinguish:

### Direct parent events

Explicit prior events that triggered the current event.

Example:

```text
Border Incident #132
    ↓
War Declaration #145
```

### Decision reasons

Inputs actually consumed by the decision rule.

Example:

- relationship hostility,
- military strength ratio,
- food pressure,
- migration pressure,
- leader traits,
- oracle pressure.

### Context factors

Relevant surrounding conditions that may matter but are not claimed as direct causes.

Example:

- below-normal rainfall,
- demographic growth,
- religious tension.

Weights should only be recorded when the decision model genuinely uses weights.

They must not be invented afterward to create false explanatory precision.

## 11. Runtime events versus History

Runtime state changes and persistent history are different concerns.

Example:

```text
Bob hunger 42 → 43
```

is a simulation change, not necessarily history.

A meaningful event such as:

```text
Bob died during the Great Famine
```

may be promoted into persistent history.

Large patterns may later be aggregated into higher-level historical events.

## 12. Memory and persistence boundary

> **RAM serves the present; disk preserves the past.**

Memory is primarily reserved for the current simulated world.

History must not grow indefinitely in RAM as world age increases.

The runtime may keep:

- a bounded hot window of recent events,
- compact causal references needed by active decisions,
- caches/indexes required by current UI,
- summaries of important historical state.

Older significant events should be persisted/offloaded to disk in append-oriented storage.

Minor transient changes should not be permanently stored at all.

A long-running world must not consume memory proportional to its total simulated age.

The exact storage format is deferred to later implementation/history design.

## 13. Architectural invariants

The following are considered stable constraints:

1. Simulation layers are semantic state-ownership boundaries, not a strict hierarchy.
2. Household remains a first-class entity, with a lightweight initial implementation allowed.
3. Polity represents political/governance state; "Civilization" is not overloaded as the political container.
4. Religion is a cross-cutting graph and may span multiple polities.
5. Cross-layer direct mutation of authoritative state is prohibited by design.
6. Different systems may run at different simulation cadences.
7. Supported simulation versions should be deterministically reproducible from seed/state/input.
8. Persistent history contains significant events only and is offloaded to disk.
9. Long-term history must not compete with current-world simulation for unbounded memory.
