# Issue #11 — Web-first MVP-0 Implementation Notes

**2026-10-10 · experimental branch `web-mvp-0`**

## Decision and baseline

The project is still in game-feel exploration. Implement the first playable S0–S3 loop in a plain HTML/CSS/Canvas 2D browser app, with a **Node-testable JavaScript simulation core**. The Godot/GDScript runtime selected provisionally in `docs/FIRST_PLAYABLE_IMPLEMENTATION.md` is *deferred*, not rejected as a future production platform. All previously agreed #1–#8 God/World ownership, miracle and Oracle game contracts remain authoritative.

This branch starts from **main**, not from the older web-poc, and does not import prior prototype code/models. Its rules are independently implemented and balance is deliberately provisional.

## Runtime boundary

- `sim.js`: no DOM, Canvas, localStorage, wall-time API, input events or network. Exposes `create`, `advanceTicks`, `stats`, `evalRain`, `castRain`, `issueOracle`, `concludeOracle`, `presenceAt`, `validate`, `restore`. Stable IDs, seeded PRNG, pure explicit simulation advancement; updates only on discrete simulation-time tick. Role and authority distinction is maintained by functions, not a heavyweight framework.
- `app.js`: user input, pause/speed-to-tick translation, Canvas drawing, dynamic inspector, browser save/load/JSON export; **not** allowed to decide Person occupations, add Food, change faith, choose Saint, or directly mutate sim-owned state.
- `index.html`, `style.css`: gameplay UI, no third-party runtime packages.
- `tests/`: actual headless kernel tests and scenario smoke run.

The MVP uses 8-hour simulation ticks and three daily activity phases (rest/work/other); all durations, cooldowns, Oracle quotas and birthdays use **simulation hours**, not real time. A full sub-tick scheduler and the high-tier 60-*simulated-second* eligibility hold are **deferred** until high-tier Miracles exist; do not confuse simulation-hour integer storage with permanently deciding coarse time granularity for the engine.

## What is intentionally approximate

- Settlement forms after at least four actual shelters are completed within a residential cluster, using real collected wood/fiber and work. This is a compact v0 formation rule, **not** a universal city-growth theory.
- Individual work uses short feasible utility candidates (food, wood, fiber, stone, housing), with family need and optional Oracle pressure. It is not a deep planner/pathfinding system. A changing Oracle decision can be compared to an otherwise identical run without the Oracle.
- Person location is coarse within a household vicinity; no exact step-by-step walking or physics. Culling a drawn person has no simulation effect.
- A single renewable Rain input changes tile moisture; crop fields respond through growth and are harvested by actual farmers. Small households, simplified food production/consumption and short natural drought windows prioritize playability rather than realism.
- Prayer arises from *actual* field moisture and food/crop risk; fulfillment requires an attributable relevant cast, measurable moisture improvement and subsequent real food work. Credits are per short-lived need, not per button press.
- One God/Religion can operate; the data uses IDs and presence derived from real located, weighted believers, not temples or global DP. The complete multi-God dominance threshold / high-tier cache is unimplemented. Ordinary supportive Rain remains accessible under basic support policy.
- Saint qualification is separate from Priest office: the first Listener can communicate an Oracle independently; a Priest may later emerge through community context, and priestly position alone gives no receiver power.
- Save version `mvp0-web-1`: same-version restore and deterministic continuation. No cross-version migration or comprehensive provenance database is promised.

## Quality gates and evidence

Run `npm test` (16 headless scenarios) and `npm run smoke` (fixed seed with settlement, Rain, Oracle and autonomous changed decisions). The initial browser smoke checks that controls render, the world advances, a settlement and Saint emerge, the Oracle issues, Rain targets the map and no JavaScript page errors occur. The local screenshot is a developer artifact, not game content.

Further game-feel iteration should be based on actual user play. Key observations to collect: 5–10 minute engagement; whether one rescue Rain feels consequential; how much waiting occurs; whether users understand Saint/Priest/Prayer; how visible the Oracle's changed choices feel; and how much food/drought pressure is fun rather than frustrating.

## Known gaps (do not misreport as complete)

- Only Rain/food.produce; catalog/UI for remaining eight Miracles and alternate Oracles are not implemented.
- Some #3 demographic rules remain simplified (gestation, relocation and death supported; no rich pairing/kinship or pregnancy recovery).
- Full Priest roles, Temple/Shine organization, Collective Petitions, multi-religion conversion and multiple geographically separate Saints are future tasks.
- Economy uses four raw storable goods, not the entire 10+5+2 catalog. Trade Demand currently omitted, no Trading Post.
- Event traces are short and truthful, but Issue #10's full history schema/offload/replay UI is not implemented.
- Save validation is minimal prototype-grade; untrusted save imports should be handled with stricter limits before public deployment.
- No measured 1k/10k population scaling claim; Canvas rendering is not a production engine benchmark.

## Next decision point

Keep Web as the rapid playtest surface until the God–World loop, pacing and basic fun are confirmed. Re-evaluate engine choice (Web or Godot) **after** player testing, rather than porting before it is necessary.
