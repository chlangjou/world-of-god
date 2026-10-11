# Opponent v0.1 — 真實人口與兩位 God 的信仰競爭

**Status:** Web PoC v2 experimental (2026-10-11). This module does **not** change the authoritative `main/docs/` design. It extends the existing deterministic kernel rather than building a second independent world.

## Playable scope

- One human God: `g1`, religion `r1` (初光信仰); one AI God: `g2`, religion `r2` (暮影信仰).
- Each side has **its own DP, DP income, Mastery, per-Miracle cooldown, Saint, Priest and Oracle quotas**. The two Gods cannot spend one another's stored DP. The existing Miracle/Oracle types and world-side consequences are shared; every effect keeps its originating `godId`.
- AI begins among **already generated households** `h6`/`h7` (configured `initialHouseholdIndexes=[5,6]`, zero-based). Their faith changes at Genesis; there are no additional humans, homes, farmland, food, or materials.
- Ordinary preaching and household education use the same seven-day faith pulse and one physical population. Priest sermons can undermine an existing *weakly committed* rival (under 40) gradually. Only under 20 can someone choose to switch affiliation; 40+ never erodes solely because a Priest preaches. Both sides use independent religion RNG and alternate first-mover order between pulses.
- Rival adults actually preach during leisure; autonomous Priest formation is possible in existing Settlements; Saints become Oracle receivers under the existing eligibility and quota rules. An AI transmission is still delayed/reached through real listeners — no instant or invisible mass conversion.

## Minimal AI policy

The rival policy runs at configurable day intervals (default 12 days from day 14). It checks actual followers, Priests and Saints, then:

1. Uses a live Saint with available Oracle quota for `religion.spread` when no active rival spread Oracle exists.
2. Selects a real follower/Priest/Saint position, surveys existing nearby farmland and moisture, and attempts **Rain**, **Ripening**, **Heal**, or **Efficiency**. It spends the same DP, has the same cooldown and causes the same physical world effect as a player cast. One successful Miracle at most per decision.
3. Occasionally attempts **Confusion** toward an actual opposing Priest. The usual destructive Miracle gate checks the **caster's weighted local presence / total known-faith presence above 50%**, so offense is impossible in enemy-dominated territory. Both allied and rival local residents can still suffer an indiscriminate attack.

It is deliberately *not* an optimal combat AI, hidden cheats, another resource simulation, temple system, or an LLM/Agent. This first slice is intended to give real religious competition and responses without slowing down world simulation.

## UI & data ownership

The compact header `對手: AI 神 / 無對手` option controls **new worlds only**. Switching prompts for confirmation and recreates the same seed. In an AI world the top faith metric displays *human 40+ / opponent 40+*, each Settlement shows local opponent believers/roles and enemy DP, and the map uses coral/rose for rival adherents, Saint and Priest. Existing player Priest petition bubbles and Oracle controls remain player-only. Events name the actor's faith so the player can see enemy actions.

`config/opponent-v0.1.json` contains the tunable AI entry day, cadence, seeded household indexes, early devotion, Divine Power and Oracle duration. `src/sim.js` is the authority for simulation; `src/app.js` must never grant AI resources or decide conversions.

The separate `opponentRng` is saved. A save made with rival enabled restores all Gods, religions, cooldown clocks, effects, Saints, and AI counters; a legacy save with no `opponent.enabled` **stays single-God**. For a brand-new contest use `重新創世` while the header is in AI mode. Optional standalone builder embeds the new profile.

## Validation and deferred work

`npm test` includes `tests/opponent.test.cjs` covering no artificial people or resources, DP and cooldown isolation, actual AI casting/Oracle, protected 40+ faith, save/restore replay, and legacy save migration. Run `npm run smoke` and `npm run check:agriculture` before release.

Deferred: Temple and shrine construction, moving missionaries/pathfinding, population-wide prayer relay for rival, rival ritual petition UI, deeper strategy/response trees, diplomacy, wars, religion splits, multiple AI rivals, win/loss conditions, and browser usability/playtest balancing. No opponent activity is inserted into a restored legacy game unless a **new world** is explicitly created.
