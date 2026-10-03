# Faith, Religion, and Oracle — Design Checkpoint

Status: **Working draft / checkpoint for Issues #5, #6, and #8**

This file captures the current agreed direction before Issue #5 is fully resolved.

The GitHub Issues remain authoritative for unresolved mechanics and balance values.

## Why these systems are being designed together

Faith, Religion, and Oracle now form one gameplay feedback loop rather than three independent systems:

```text
God
 ├─ Miracle ───────────────────────────────┐
 │                                        ↓
 └─ Oracle → Priest / Receiver → Followers → World
                │                │          │
                │                └─ devotion│
                └─ attribution ← evidence ──┘
                         ↓
                  Divine Power
```

Settlement economy and occupations consume the resulting religious / oracle pressures, but should not define the religious communication model themselves.

## 1. Faith state direction

Do not use one universal Personal Faith value for every purpose.

### Spiritual Receptivity

A person-level disposition toward supernatural interpretation.

It represents how readily a person treats unusual events, rituals, dreams, omens, or religious claims as spiritually meaningful.

It is not tied to one religion.

### Religion-specific Devotion

Commitment toward a particular religion / god identity.

Conceptually:

```text
Person
├─ spiritual_receptivity
└─ religion_devotion[religion_id]
```

A person may therefore be:

- unreceptive and unaligned,
- receptive but unaligned,
- weakly attached to one religion,
- strongly devoted,
- exposed to or contested by multiple religions.

The exact storage representation and whether multiple simultaneous positive affiliations are allowed in v1 remain open.

### Follower

Follower should be a **derived affiliation state**, not an unrelated Boolean source of truth.

Its exact threshold / hysteresis rules are still open.

### Aggregate Devotion

Aggregate Devotion represents the effective religious contribution of a religion's believers.

It should not scale only with nominal follower count.

A smaller highly devoted religion may therefore compete with a larger weakly committed one.

## 2. Evidence and attribution

Miracles and extraordinary natural events provide evidence, but evidence and attribution are different.

Baseline rule:

```text
extraordinary event
→ awe / fear / curiosity / receptivity

event + trusted religious attribution
→ religion-specific devotion

active Oracle + semantically matching event / Miracle
→ especially strong targeted evidence
```

A person who witnesses rain after drought should not automatically know that the player's god caused it.

Priests, ritual context, prior teaching, and active Oracle context make targeted attribution possible.

## 3. Religion v1

Religion is a cross-cutting simulation system and the primary communication / attribution substrate between a god and ordinary believers.

Minimum v1 responsibilities:

- stable religion identity and god attribution;
- follower / affiliation relationships;
- Priests / Oracle Receivers;
- Oracle reception and interpretation;
- preaching / ritual / repeated teaching;
- memory of active religious context;
- attribution of miracles and meaningful events;
- aggregate devotion.

### Multiple religions

Multiple top-level religions may coexist and compete:

```text
God A → Religion A → Priests A → Followers A
God B → Religion B → Priests B → Followers B
```

A Settlement may contain mixed religious populations.

### No internal religion forks yet

For the current core design:

> **Multiple religions may compete; one religion does not internally fork yet.**

Local interpretation differences and misunderstandings are allowed, but they do not create persistent independent sect, schism, or heresy entities.

Deferred:

- persistent sects;
- schisms;
- heresies as separate organizations;
- disputed ownership of Devotion between internal branches.

## 4. Priest / Oracle Receiver

An active religion requires an in-world route for receiving divine intent.

Baseline flow:

```text
God
  ↓
Priest / Oracle Receiver
  ↓ interpretation
Preaching / ritual / repeated teaching
  ↓
Followers
  ↓
behavioral response
```

### Minimum receiver continuity

An active religion should maintain at least one viable Oracle Receiver so ordinary gameplay cannot soft-lock merely because one priest dies.

Working bootstrap direction:

- first worship / Genesis may appoint or create a First Listener / Priest;
- if the receiver disappears while viable believers remain, a successor may emerge;
- if the religion fully collapses, the existing Divine Spark concept may later permit revival.

The exact succession algorithm remains open.

### More priests

Additional priests may improve:

- geographic reach;
- transmission reliability;
- sermon / ritual frequency;
- interpretation consistency;
- simultaneous Oracle capacity.

More priests must **not** make mortal compliance automatic.

## 5. Oracle lifecycle

An Oracle is a persistent simulation object and religious context, not a one-tick command.

Current lifecycle:

```text
issued
  ↓
received by Oracle Receiver
  ↓
interpreted
  ↓
preached / propagated
  ↓
heard by relevant people
  ↓
accepted / rejected / deprioritized
  ↓
attempted
  ↓
completed / failed / expired
  ↓
outcome interpreted by religion
  ↓
Devotion / history consequences
```

Useful Oracle state may include:

- oracle identity;
- intended meaning;
- target / domain;
- issue time;
- receiver;
- current interpretation;
- propagation state;
- active / expired / fulfilled / failed state;
- related evidence / Miracle references.

The Oracle should remain temporally relevant long enough for later events to confirm, contradict, or complicate its interpretation.

## 6. Boundary with mundane simulation

Oracle does not directly perform settlement or individual actions.

Instead it creates a decision input / pressure.

Conceptually:

```text
Oracle
→ interpreted divine calling
→ individual / household / settlement decision input
→ autonomous worldly execution
```

For example, future occupation selection may consider:

```text
occupation utility =
    local labor demand
  + skills
  + traits
  + household constraints
  + culture
  + divine calling pressure
  + other context
```

Issue #4 owns the mundane occupation / economy decision model.

Issue #6 owns how divine intent reaches that model.

## 7. Divine Power and Miracle pacing direction

Preferred resource model:

```text
Faith / Devotion
   ├─ generates shared Divine Power
   └─ accelerates Miracle cooldown recovery
```

Each Miracle should eventually define:

- Divine Power cost;
- independent cooldown;
- optional scale / intensity;
- unlock stage.

Cooldown acceleration from Devotion should be capped or sublinear.

Exact formulas and balance constants remain open.

### Civilization-linked unlocks

Miracle vocabulary may unlock with mortal development, for example:

```text
foraging / hunting
→ agriculture
→ permanent settlement
→ organized religion / polity
→ later civilization stages
```

Exact stage definitions are deferred.

## 8. Web PoC pacing evidence

The `web-poc` branch exposed two concrete early-game problems that Issue #5 must account for.

### Difficulty currently affects Divine Power but not Personal Faith growth

Relaxed mode accelerates Divine Power generation, but current per-person faith changes use fixed values.

This means Easy / Relaxed does not actually make belief formation itself easier.

### Genesis currently overrides preset belief

Preset starting belief values exist in the core, but Genesis currently supplies a fixed 28% value.

This places much of the initial population below the current follower threshold and makes the opening slower than intended.

These are PoC implementation / pacing findings, not final formulas.

### Pacing requirement

The eventual model should explicitly distinguish:

1. receptivity / individual devotion growth;
2. follower / affiliation formation;
3. aggregate Devotion;
4. Divine Power generation;
5. initial Divine Power reserve;
6. Miracle cooldown recovery.

Easy mode should reduce early passive waiting without removing the same simulation and agency model.

## 9. Minimal Miracle contract needed by this cluster

Issue #7 can remain open, but this cluster assumes a Miracle exposes at least:

```text
Miracle {
    divine_power_cost
    cooldown
    unlock_stage
    evidence_strength
    scope
}
```

The exact miracle catalog and costs are not resolved here.

## 10. Current dependency order

Recommended design order:

1. **#5 Faith / Devotion / Divine Power**
2. **#8 Religion / Priesthood v1**
3. **#6 Oracle / Divine Calling**
4. **#4 Settlement Economy / Occupations**
5. **#7 detailed Miracle balance**

The reason is that #4 should consume divine calling as a normal decision input rather than inventing the Oracle delivery model itself.

## 11. Still unresolved

Issue #5 still needs to decide, among other things:

- exact representation of religion-specific Devotion;
- follower thresholds / hysteresis / conversion behavior;
- whether and how simultaneous religious affiliations work;
- Devotion aggregation formula;
- Divine Power cap and generation formula;
- difficulty modifiers;
- early-game pacing targets;
- decay / reinforcement rules;
- snowball prevention.

Issue #8 still needs:

- exact Priest emergence / succession;
- geographic transmission;
- ritual / preaching cadence;
- institution scaling.

Issue #6 still needs:

- concrete Oracle object schema;
- capacity / cost model;
- interpretation variance;
- conflict between multiple active Oracles;
- compliance pressure and expiration rules.
