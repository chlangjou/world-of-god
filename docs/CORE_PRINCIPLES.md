# World of God — Core Principles

Status: Draft / evolving

This document records only principles that are sufficiently agreed to guide design. Unresolved mechanics belong in GitHub Issues until they are settled.

## Project direction

**World of God** is an emergent civilization and god-simulation sandbox.

The player is a god, not an RTS commander. The core experience is to influence a living world, observe how people and societies interpret that influence, and watch history emerge from simulation rather than from scripted outcomes.

## Core design principles

### 1. God expresses intent; the world determines execution

The player should not directly replace the decision-making of individuals, settlements, armies, or civilizations.

A divine instruction should influence priorities and behavior, while execution remains subject to the world's own needs, traits, institutions, resources, and conflicts.

> God expresses intent; world determines execution.

### 2. Emergence before scripting

Important outcomes should arise from interacting rules whenever practical.

Examples include:

- settlement formation,
- migration,
- population growth or collapse,
- profession changes,
- war,
- religious movements,
- schisms,
- dynastic or cultural change.

Scripted events may support presentation, but should not be the primary source of world history.

### 3. Miracles and oracles are different systems

**Miracles** change physical reality and consume Divine Power.

Examples: improved harvests, healing, rain, blessings, disasters, resurrection.

**Oracles** communicate divine intent and influence behavior.

Examples: choose a profession, increase population, migrate, explore, protect, build, attack, or make peace.

Oracles should not behave as guaranteed commands.

An Oracle should normally enter the mortal world through an in-world receiver such as a Priest / First Listener, then propagate through interpretation, preaching, ritual, and social transmission rather than being broadcast as raw divine data to every believer.

### 4. Faith distinguishes receptivity from religion-specific devotion

The religious feedback loop should not collapse all belief into one universal number.

The current conceptual split is:

- **Spiritual Receptivity** — an individual's openness or sensitivity to supernatural meaning, signs, awe, fear, ritual, or divine claims.
- **Religion-specific Devotion** — the individual's commitment toward a particular religion / god identity.
- **Follower** — a derived affiliation state, not a second independent source of truth.
- **Aggregate Devotion** — the effective religious contribution produced by followers and their devotion.
- **Divine Power** — shared spendable capacity for miracles.

A raw extraordinary event may increase awe or receptivity without automatically proving which god caused it.

Targeted devotion should be strengthened most reliably when an event is attributed through a trusted religious context, such as priestly interpretation, ritual, or a matching active Oracle.

A large nominal religion should not automatically equal a powerful god if its believers are weakly devoted.

### 5. Divine power scales with worship, but intervention remains bounded

More and stronger devotion should enable more divine intervention.

The preferred direction is a hybrid resource model:

- worship is the main renewable input to each God's shared, world-wide **Divine Power** pool, with a **small natural recovery** even without followers;
- Miracle types start available in Sandbox v1, with each type's **independent permanent Lv1–Lv5 Mastery** improving effect per DP and cooldown;
- each Miracle has its own cooldown;
- Faith/Devotion may accelerate cooldown recovery;
- cooldown acceleration should be capped or sublinear so large religions cannot eliminate local action limits.

Larger religions may also create communication, interpretation, institutional, and political complexity.

Multiple top-level religions may compete for followers, including inside the same settlement.

Persistent internal sect / schism / heresy branches within one religion are deferred for now.

### 6. Low-level miracles should usually work through nature

Early miracles should modify existing processes rather than simply spawn resources.

For example, a harvest blessing should improve crop yield or reduce crop failure rather than add an arbitrary amount of food directly.

Higher-order miracles may increasingly violate normal physical rules.

### 7. Individuals and societies retain agency

Occupation, reproduction, migration, war, worship, and other behavior should be influenced by multiple factors.

A divine calling may be a strong factor, but not necessarily an absolute override.

### 8. Population rules should produce consequences rather than hard-coded bonuses

Systems such as a designated Breeder / Chosen Parent should influence priorities, resources, relationships, or reproductive opportunities.

Population output should still emerge from fertility, health, partners, pregnancy/recovery constraints, food, housing, culture, and social rules.

### 9. History should preserve causality

Major world events should retain enough causal information for the player to inspect not only what happened, but why.

For example, a war may record:

- immediate trigger,
- border pressure,
- resource scarcity,
- leader hostility,
- religious influence,
- migration pressure.

The ability to reconstruct the causes of history is intended to become a defining feature of the game.

Player-facing History captures **major events and sustained transitions**, not periodic food/population status or no-event messages. Routine metrics belong in inspectors/diagnostics. Displayed decision reasons must reflect the actual decision inputs rather than generic statements unrelated to available resources or Oracle influence.

### 10. The simulation core should remain separable from presentation

The long-term architecture should allow the world simulation to run independently of rendering.

A headless simulation should eventually be possible for balancing, regression testing, long-duration runs, and causal analysis.


### 11. Minimum coherent mechanics before simulation detail

**Tunable values are not optional correctness contracts.** If a rule affects survival, reproduction, work, migration or religious outcomes, its minimum supporting dependencies must work together before it is treated as playable.

- Identify ownership, input/production, eligibility and physical access, allocation, consumption, consequences, adaptive responses and player-facing explanation.
- Use a **consistent effective-access model** in all dependent decisions. For example, a household may have no private food yet have a real claim on reachable communal stores; distant or ineligible stock cannot be treated as available. Do not double-count planned allocations.
- A household/common inventory system is not complete merely because both counters exist. Deposits, withdrawals, settlement affiliation and relocation must be coherent. Starvation despite genuinely reachable, allocable food caused by incompatible rules is a defect, not emergence; genuine isolation can still have consequences.
- When the supporting loop is too costly for the current PoC, explicitly simplify or defer the feature rather than ship a half-connected penalty. Keep the agreed full-v1 design intact.
- Test the connected behavior at edge cases and over long simulated periods **before** tuning coefficients. Do not conceal a missing mechanism through forced births, conjured food or artificial immunity.

> Prefer a small complete and observable causal loop over a more detailed but partially connected simulation.

## Current conceptual simulation layers

The working model currently contains six interacting layers:

1. World
2. Individual
3. Household
4. Settlement
5. Civilization
6. Religion

Their exact boundaries and data contracts remain open design work.

## Development workflow

During the early design stage:

- unresolved design directions live as GitHub Issues;
- settled rules are promoted into `docs/`;
- changes may be committed directly to `main`;
- Pull Requests are not required until the project reaches a scale where review workflow adds value.

## Current milestone direction

The first meaningful playable path is expected to cover:

- S0 — Living World
- S1 — Settlement
- S2 — First God
- S3 — Oracle

The intended milestone experience is:

> A small population survives, forms a settlement, begins to worship the player, generates limited divine power, receives a small miracle and an oracle, and then responds through its own simulated behavior.

The exact acceptance criteria are tracked separately in GitHub Issues.
