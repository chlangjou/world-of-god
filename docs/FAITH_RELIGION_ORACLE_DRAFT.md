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

The first implementation should favor cheap, readable population state over deep individual psychology.

> **Simulate decisions and consequences, not internal monologues.**

Minimum ordinary-person religious state:

```text
PersonReligionState
├─ religion_id?   // current religion, if any
├─ devotion       // integer 0..100
└─ receptivity    // optional low-frequency / trait-like modifier
```

Ordinary people should not retain long personal histories of sermons, Miracles, Oracles, or theological interpretation. Those events should normally produce immediate state changes or short-lived modifiers and then be discarded.

### Devotion bands

First-pass bands:

| Devotion | State | Natural drift Down : Flat : Up | Divine Power weight |
| --- | --- | ---: | ---: |
| 0–19 | Skeptic / unaligned | 5 : 3 : 2 | 0 |
| 20–39 | Light believer | 4 : 3 : 3 | 1 |
| 40–79 | Follower | 3 : 4 : 3 | 2 |
| 80–89 | Devout | 1 : 8 : 1 | 4 |
| 90–100 | Zealot / Priest candidate | 0 : 9 : 1 | 8 |

The drift values are first-pass balance values, not final constants.

Natural drift is intentionally weak. Large permanent changes in Devotion should come primarily from **Miracle evidence** and **Oracle fulfillment / contradiction**.

For 0–19, ordinary natural drift should not by itself cross the 20-point belief threshold; entry into meaningful belief should require convincing religious evidence or equivalent exceptional influence.

### Priest effect

Priests are primarily conversion and consolidation infrastructure, not passive generators of extreme Devotion.

Working rule:

- own Priest influence can shift weak believers (especially 20–39) upward over time;
- rival Priest influence can slowly erode people below 40;
- ordinary Priest pressure does not meaningfully move committed believers at 40+;
- high Devotion should require major divine evidence rather than simply living near a Priest.

A simple first-pass probability shift is:

```text
4 : 3 : 3
→
3 : 3 : 4
```

for eligible weak believers inside effective Priest influence.

### Conversion hysteresis

A person at 40+ is a committed believer and normally resists rival preaching.

A person at 39 or below becomes vulnerable to rival religious influence.

Actual conversion requires both:

1. Devotion at 39 or below, and
2. exposure to a convincing rival Miracle / Oracle effect.

On conversion:

```text
new_devotion = max(20, old_devotion - 5)
```

This prevents instant full-confidence conversion and gives the new religion a consolidation phase.

### Gameplay objective

Devotion is not primarily a balance meter to keep near an ideal value.

The central religious game is:

```text
gain followers
→ consolidate them
→ project religious influence
→ weaken rival control
→ convert vulnerable populations
→ gain more Divine Power
→ use stronger divine actions
```

## 2. Evidence, attribution, and temporary religious mood

Miracles and fulfilled Oracles are the main sources of large, durable Devotion change.

Baseline rule:

```text
Miracle evidence / Oracle fulfillment
→ large Devotion movement (often 15+ points)

Priest influence
→ slow consolidation / erosion near conversion thresholds

ordinary victory / defeat
→ temporary Fervor / Low Morale
→ efficiency modifier
→ no automatic permanent Devotion loss
```

A raw extraordinary event still needs attribution to a religion before it becomes strong targeted evidence.

Priests, ritual context, prior teaching, and active Oracle context provide that attribution.

### Major victories and defeats

Religious victories, temple defense, relic capture, shrine destruction, or similar events should not normally rewrite long-term Devotion by themselves.

Instead they may create a temporary settlement/religion-level state such as:

- **Religious Fervor** — temporarily improves activity, religious efficiency, or propagation;
- **Low Morale / Religious Depression** — temporarily reduces efficiency after defeat or loss.

These effects should usually live on a `Religion × Settlement` aggregate state rather than on every individual.

This preserves strategic consequences without turning every battlefield result into mass deconversion.

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

## 7.1 Divine Power contribution

First-pass contribution uses devotion bands rather than a continuous per-point formula:

```text
0–19   → 0
20–39  → 1
40–79  → 2
80–89  → 4
90–100 → 8
```

This gives thresholds strategic meaning and allows a smaller highly devoted religion to compete with a larger weakly attached population.

The exact Divine Power generation rate and storage cap remain balance work.

## 7.2 Territorial religious influence hook

Shrines, Temples, Relics, and similar institutions are primarily Issue #8 concerns, but Issue #5 assumes they may:

- provide small local religious modifiers;
- extend or strengthen Priest influence;
- create territorial religious pressure;
- support competition over religious space.

They should modify local influence rather than add large new per-person state.

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

Issue #5 core mechanics are now mostly defined. Remaining work is primarily pacing / balance:

- Faith update cadence;
- exact Miracle / Oracle Devotion deltas;
- exact Divine Power generation rate and storage cap;
- difficulty modifiers;
- initial population / Devotion distribution;
- early-game intervention timing;
- snowball prevention under multiple religions.

Issue #8 still needs:

- exact Priest emergence / succession;
- geographic transmission / influence range;
- Shrine / Temple / Relic effects;
- ritual / preaching cadence;
- institution scaling;
- territorial religious competition.

Issue #6 still needs:

- concrete Oracle object schema;
- capacity / cost model;
- interpretation variance;
- conflict between multiple active Oracles;
- compliance pressure and expiration rules.
