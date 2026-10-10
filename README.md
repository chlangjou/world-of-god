# World of God

An emergent civilization and god-simulation sandbox.

## Run the Godot MVP-0

The S0–S3 core-mechanism PoC is now playable. Its scope follows
[FIRST_PLAYABLE_IMPLEMENTATION.md](docs/FIRST_PLAYABLE_IMPLEMENTATION.md): one
river valley, autonomous individuals/households/settlement, Rain and
`food.produce`. Numbers and presentation are provisional validation tools.

On this Windows checkout, double-click **[Play.cmd](Play.cmd)** to play or
**[Open-Editor.cmd](Open-Editor.cmd)** to develop in Godot. Godot 4.7.2 is available
locally under the Git-ignored `.tools/godot/` directory. For a fresh checkout:

```powershell
./tools/install-godot.ps1
./tools/godot.ps1 -Mode play
```

Use the left panel's **降雨 / 神諭 / 祈求** tabs. Scroll to zoom, drag with the right
mouse button to pan, and select residents to inspect their decisions. Space
pauses the simulation. There are no mundane unit/job/building commands.

Night skip is enabled by default: 20:00–08:00 advances at 8 times the selected
speed, then returns to the selected speed at 08:00. Significant nighttime events
pause for inspection; press Resume to continue with a 10-second grace period
that records events without pausing again. Toggle **夜間快進** off to watch
the night at normal speed. The map favors active daytime residents; resting
residents remain inspectable through the resident menu.

```powershell
./tools/godot.ps1 -Mode test       # deterministic headless acceptance checks
./tools/godot.ps1 -Mode economy    # food access, sufficiency and 1,600-day population checks
./tools/godot.ps1 -Mode benchmark  # 32 / 1,000 / 10,000 population probes
./tools/godot.ps1 -Mode capture    # real-renderer UI smoke checks + screenshot
```

Residents compare accessible household/common food with real needs. Once
supplies are sufficient, food skills and `food.produce` no longer keep pushing
harvesting; existing construction, material gathering and family care can take
priority. A food deficit raises food-work priority again. Fertility, yields,
consumption and the 20:80 new-output split retain their existing values.

The editor project is [`godot/project.godot`](godot/project.godot). See
[PoC handoff, evidence, and remaining acceptance](docs/POC_HANDOFF.md) before
interpreting this prototype as full Sandbox v1 or closing Issue #11.

## Design thesis

The player is a god, not an RTS commander.

> **God expresses intent; world determines execution.**

The game is intended to generate history from interacting simulation rules: individuals, households, settlements, civilizations, religion, divine intervention, and the consequences between them.

See [Core Principles](docs/CORE_PRINCIPLES.md).

## Converged design specifications

- [Settlement Economy, Occupations and Food Security (Issue #4)](docs/SETTLEMENT_ECONOMY_OCCUPATIONS.md)
- [Oracle and Divine Calling (Issue #6)](docs/ORACLE_DIVINE_CALLING.md)
- [Religion, Saints, Priesthood, Shrines, and Temples (Issue #8)](docs/RELIGION_PRIESTHOOD_TEMPLE.md)
- [Miracles, Mastery, and Divine Power (Issue #7)](docs/MIRACLES_DIVINE_POWER.md)
- [Divine Presence and spatial Miracle capability (Issues #7/#8)](docs/DIVINE_PRESENCE_MIRACLES.md)
- [Faith, Religion and Oracle historical checkpoint](docs/FAITH_RELIGION_ORACLE_DRAFT.md) (superseded where noted)


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

## First playable implementation handoff

- [Issue #11 — MVP-0 implementation contract (S0–S3)](docs/FIRST_PLAYABLE_IMPLEMENTATION.md)

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

The implemented MVP-0 remains subject to the acceptance gates in Issue #11;
the human playability gate has not been declared passed by automated tests.
