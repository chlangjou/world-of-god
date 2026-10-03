# World of God

An emergent civilization and god-simulation sandbox.

## Design thesis

The player is a god, not an RTS commander.

> **God expresses intent; world determines execution.**

The game is intended to generate history from interacting simulation rules: individuals, households, settlements, civilizations, religion, divine intervention, and the consequences between them.

See [Core Principles](docs/CORE_PRINCIPLES.md).

## Design workflow

During the early design phase:

- unresolved directions are tracked as GitHub Issues;
- each issue should converge on one coherent rule/system;
- settled decisions are promoted into `docs/`;
- commits may go directly to `main`;
- Pull Requests are intentionally deferred until the project needs a review workflow.

## Current design backlog

1. [Core God–World gameplay loop](https://github.com/chlangjou/world-of-god/issues/1)
2. [World simulation layers and causality](https://github.com/chlangjou/world-of-god/issues/2)
3. [Population, family, and reproduction](https://github.com/chlangjou/world-of-god/issues/3)
4. [Settlement economy and occupations](https://github.com/chlangjou/world-of-god/issues/4)
5. [Faith, followers, devotion, and divine power](https://github.com/chlangjou/world-of-god/issues/5)
6. [Oracle and divine calling](https://github.com/chlangjou/world-of-god/issues/6)
7. [Miracles, cost model, and power scaling](https://github.com/chlangjou/world-of-god/issues/7)
8. [Religion, priesthood, doctrine, and interpretation](https://github.com/chlangjou/world-of-god/issues/8)
9. [Civilization, politics, diplomacy, and conflict](https://github.com/chlangjou/world-of-god/issues/9)
10. [History, event provenance, and causal explanation](https://github.com/chlangjou/world-of-god/issues/10)
11. [First playable vertical slice (S0–S3)](https://github.com/chlangjou/world-of-god/issues/11)

## Current milestone direction

The first meaningful playable path is expected to be:

```text
S0 Living World
    ↓
S1 Settlement
    ↓
S2 First God
    ↓
S3 Oracle
```

Target experience:

> A small population survives, forms a settlement, begins to worship the player, generates limited divine power, receives a small miracle and an oracle, and responds through its own simulated behavior.

This milestone is deliberately provisional until Issue #11 is resolved.
