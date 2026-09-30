# Core God–World Gameplay Loop

Status: Resolved from Issue #1

## Core contract

**God controls divine actions; the world controls worldly outcomes.**

The player is a god, not an RTS commander.

The player may reliably invoke a divine action, but the downstream consequences remain governed by the simulation.

Examples:

- A rain miracle reliably creates rain.
- Whether the rain improves crops, causes flooding, spreads disease, changes migration, or affects belief is determined by world state.
- An oracle is reliably issued.
- Whether it is heard, understood, accepted, attempted, completed, or produces the intended result is determined by simulated actors and institutions.

This separates **reliable player input** from **unreliable plans and consequences**.

## Player action channels

### 1. Observe

The player may inspect the world, individuals, settlements, religion, history, and causal chains.

The core game assumes broad divine observability because understanding emergent simulation is part of the experience.

Characters inside the world still act only on information available to them.

### 2. Genesis

Genesis is a pre-history creation/editing phase.

Players do **not** begin from a blank world by default.

Expected flow:

```text
Choose preset world
    ↓
Modify terrain / ecology / starting conditions
    ↓
Optionally save as a custom world/template
    ↓
Begin History
```

The game should provide several curated preset worlds.

A modified preset may be saved as a reusable custom world.

Genesis actions are conceptually separate from normal Faith/Divine Power economics.

Once History begins, equivalent large-scale edits become divine interventions and should obey normal power costs.

### 3. Miracle

A Miracle directly changes physical or biological reality.

Examples:

- improve crop conditions,
- heal,
- create rain,
- bless,
- cause disaster,
- perform higher-order supernatural acts.

The miracle's immediate effect should normally be reliable.

Its consequences are not guaranteed.

### 4. Oracle

An Oracle expresses divine intent to individuals, settlements, religions, or civilizations.

An oracle influences decisions but does not directly execute them.

The conceptual lifecycle is:

```text
issued
  ↓
transmitted / heard
  ↓
interpreted
  ↓
accepted / rejected
  ↓
attempted
  ↓
completed / failed
  ↓
consequences
```

Each stage may later be explained through simulation state rather than through an opaque failure roll.

## Direct-control boundary

Normal divine play should not directly provide mundane RTS-style control.

The player should not normally be able to:

- move individuals along exact paths,
- assign ordinary jobs as guaranteed commands,
- place normal civilian buildings as direct construction orders,
- set exact production quotas,
- force reproduction,
- force diplomatic outcomes,
- directly script wars,
- directly select political outcomes.

The god may instead influence those outcomes through Oracles, Miracles, environmental changes, blessings, institutions, or other divine mechanisms.

## Autonomous world requirement

The world must continue producing meaningful history without player intervention.

The player is not the world simulation's CPU.

A valid play style is to accelerate time and simply observe decades or centuries of autonomous change.

The divine layer exists to redirect, amplify, suppress, or react to history.

## Repeating gameplay loop

The primary loop is:

```text
Observe
  ↓
Form intent
  ↓
Intervene (Oracle / Miracle)
  ↓
Autonomous execution
  ↓
Consequences
  ↓
Faith / Divine Power / History change
  ↓
Observe again
```

A non-intervention loop is equally valid:

```text
Observe
  ↓
Let world run
  ↓
Consequences
  ↓
New history
  ↓
Observe
```

## Intervention cadence

The game should not reward high-frequency micromanagement.

The intended rhythm is closer to:

```text
Observe → let years pass → identify an interesting situation
→ intervene once or a few times → let the world respond
→ inspect consequences
```

Time controls such as pause and acceleration are therefore important, while high APM should not be a core skill.

## Failure model

### Miracle execution

A valid miracle should normally execute successfully if its requirements and cost are satisfied.

Failure is primarily in downstream consequences.

Example:

`Rain succeeds → excessive moisture produces flooding → harvest plan fails.`

### Oracle transmission

The oracle may fail to reach relevant believers or institutions.

### Oracle interpretation

The oracle may be understood differently from the player's intended meaning.

### Oracle compliance

Actors may understand the oracle and still refuse or deprioritize it.

### Oracle execution

Actors may accept and attempt the oracle but fail because of resources, danger, politics, skill, environment, or other world conditions.

### Outcome failure

The requested behavior may be completed while the larger desired result still fails.

This distinction should be visible to the player whenever possible.

## Difficulty

Difficulty should preserve the same simulation rules and agency model.

The primary difficulty axis is how quickly worship becomes usable divine influence.

Conceptually:

- **Easier** — Faith/Devotion accumulates faster; meaningful divine intervention becomes available sooner.
- **Normal** — intended baseline.
- **Harder** — Faith/Devotion accumulates more slowly; intervention timing and religious growth matter more.

Difficulty should not primarily work by making NPCs artificially smarter or less intelligent, nor by removing their agency.

The detailed formula belongs to the faith/divine-power design work in Issue #5.

## No conventional sandbox Game Over

The core sandbox does not require a traditional Game Over.

If all followers disappear, the world continues.

A minimal **Divine Spark** may preserve extremely weak long-term influence, allowing a forgotten god to potentially re-enter history through dreams, whispers, omens, or future believers.

Challenge/scenario modes may later define explicit win/loss conditions without changing the core simulation contract.

## Design invariant

The most important invariant for later systems is:

> **The god may directly control divine acts, but must not directly replace the agency of the simulated world.**
