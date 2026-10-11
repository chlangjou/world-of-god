# Divine Powers Expansion v0.1 — Web PoC v2

**Status:** Approved first-batch scope (2026-10-11), implementation handoff. **This document is not a claim that these abilities are implemented.**

**Target:** `main/poc/v2/` (modular browser PoC). The formal v1 contracts under `main/docs/` remain authoritative. Baseline: Priest Interaction v0.2 confirmed playable, existing `rain` Miracle and `food.produce` Oracle.

## Player-facing objective

Before introducing the second religion, give the player meaningful distinct actions: improve farming, rescue the injured, exert environmental pressure, inflict immediate harm, and *actively direct* the existing autonomous Priest network toward propagation. Avoid waiting-only gameplay or extra complexity added solely to increase the power count.

## Approved first batch: four Miracles and one Oracle

| Canonical ID | Display | Direct effect / communicated intent | Important constraint |
| --- | --- | --- | --- |
| `harvest` | 豐收 / Harvest | Improve **existing** field growth / attainable yield over a bounded period | Must not conjure stored food, labor, or land |
| `heal` | 治療 / Heal | Improve actual living targets' current health/recovery in a selected area | Must not resurrect the dead or remove food/hunger needs |
| `drought` | 乾旱 / Drought | Suppress water replenishment / apply drying pressure over an area for a bounded duration | Water/moisture and crops respond through World; Rain/Drought may coexist |
| `lightning` | 雷擊 / Lightning | Cause an immediate, localized physical strike with actual damage | May hurt followers, Priests, Saints or rivals; no automatic immunity |
| `religion.spread` | 傳教 / Religion Spread | Saint communicates that religious outreach should receive more attention; willing followers/Priests **choose** more real preaching opportunities | Must not directly change affiliation or grant an instant conversion bonus without contact |

Preserve existing `rain` and `food.produce` behavior. **Do not introduce an unlock tree** in the Sandbox PoC.

## Explicitly excluded: `food.reserve`

User decision (2026-10-11): **If Food Reserve cannot deliver a meaningful gameplay difference from Food Production, omit it.**

Current PoC already has autonomous household/common food stocks, a physical-access allocation model and granary building. Merely boosting farming/foraging would be equivalent to `food.produce`. A distinct reserve policy would require credible extra behavior (e.g. real rationing rules, loss/spoilage avoidance, transport, deliberate stock/allocation policy) and would touch multiple economic constraints. **Do not implement `food.reserve` in this batch, do not expose it as a disabled UI placeholder, and do not replace it with a filler Oracle.** Revisit only if the supporting food-logistics simulation makes the two play strategies observably different.

## Mechanics and authority boundaries

### Miracles

- All casts are **manual**, with center, effect area, intensity / applicable duration, pre-validation, global DP spending, independent skill Mastery (Lv1–Lv5) and per-skill cooldown. Invalid attempts do not charge or mutate authoritative state.
- The direct effect is reliable if valid; benefit/harm, resource conservation, autonomous activity and durable Devotion emerge from owning World / Individual / Religion systems.
- **Harvest:** modify field growth potential or bounded crop yield *in the actual Agriculture and Original models*, not settlement/household inventory. A world with no applicable fields yields no new food.
- **Heal:** target currently living individuals in range and only change real health/recovery state; normal cap applies. Health can decrease again from genuine subsequent causes. Evidence/faith is conditional on answered needs, not per-cast.
- **Drought:** first-pass maximum cast duration one simulated month and baseline cooldown one simulated month, both tunable (matching Rain's agreed envelope). Rain and Drought are separate skills with separate XP/cooldowns and independent active inputs, *not mutually cancelling flags*. Net weather/soil outcomes arise via the existing moisture model. Expiration stops the input, not the resulting damage.
- **Lightning:** finite area / strength, with immediate damage through Individual health/death rules. Lightning need not invent a Wildfire propagation system in this slice.
- **Spatial capability:** full-game design requires cast-center density and dominance for high-tier destructive effects (initial dominance strictly above 50%, plus adequate density), while low-tier support is more accessible. The current PoC represents only one actual player God; do not counterfeit full rival dominance calculations or silently waive future high-tier policy. Expose any deliberately simplified PoC eligibility policy and cover zero-presence and insufficient-density rejection.
- Never treat radius overlap with rival land as per-target recertification: validate **only the cast center**, then apply real effects to everyone in range.

### `religion.spread` Oracle

- Only an eligible **Saint** receives the initial Oracle, using the existing per-Saint quota, active-type lock, issue/expiry/conclusion/death lifecycle. Priests relay; they do not directly receive raw Oracle by holding office.
- The intended decision is **more preaching effort**, especially when available Priest leisure time can be used for it. Existing autonomous Priest preaching stays active without Oracle.
- The new Oracle contributes bounded context-aware priority or opportunity to the **existing preaching choice** (and ordinary relay), never a god-issued occupation/order or a free worldwide conversion probability.
- Any religious growth must follow **actual recent sermon/contact**, receptivity and existing conversion policies: normal Priest activity may attract unaffiliated people and gradually challenge only low-Devotion rival affiliation. Established 40+ rival Devotion remains resistant to ordinary preaching.
- Effects must expire naturally with the Oracle's assignment. Sermons already delivered and real affiliations already changed are not reversed.
- Overlapping different Oracle intent types may coexist; *different types must not inherit the hard-coded `food.produce` work bonus or fulfillment reward*. In the current kernel `workCalling()`, `checkFulfillment()`, `processOracles()`, and UI each currently assume the one-food-Oracle case. Filter by canonical intent when extending them.

## Implementation seams in current Web PoC v2

| File or boundary | Necessary implementation |
| --- | --- |
| `src/sim.js` | Introduce a small type-based Miracle evaluator/caster and typed effects, keep Rain as a backward-compatible path; integrate environmental inputs, crop growth, health/harm and expiration with their existing owners |
| `src/sim.js` Religion/Individuals | Extend `checkOracle` / `issueOracle` to accept `religion.spread`; influence actual preaching decisions and the existing weekly `socialReligionPulse`, not an invented conversion event |
| `src/app.js`, `index.html` | Existing Miracle/Oracle two-layer select must actually route selection, preview cost, map targeting, status, disabled cooldown and issuance / conclude for the selected intent |
| `config/` | New tunable PoC profile for power cost, direct intensity, duration, cooldown and preaching response; separate from Agriculture's validated parameter set |
| `tests/` | Reproducible seed-matched acceptance, independent skill/cooldown/DP/quota, save/restore, overlapping weather and no fake faith or food |
| `docs/` | Record experimental simplifications clearly; do not modify formal v1 contracts as an implementation shortcut |

## Required acceptance cases

1. **No-op/rejection:** out-of-bounds, insufficient DP, cooldown, inadequate destructive capability, dead target / missing applicable field etc. are accurately handled; rejected command does not charge and a cast never silently yields fake stores or followers. For cases where empty-target casting is intentionally permitted, expose a truthful no-applicable-target warning.
2. **Harvest vs Rain:** dry or nutrient-limited fields still obey actual growth inputs; Harvest changes the *subsequent crop path*, while Rain supplies moisture; neither instantly creates private or public food. Original and Agriculture pathways behave coherently.
3. **Heal:** at least one genuine injured survivor improves; an unwounded or deceased person is not spuriously healed or resurrected.
4. **Drought / Rain:** simultaneous input is deterministic through the soil model; each expires at its own simulated deadline; damage persists as world state.
5. **Lightning:** damaging cast changes living health or actual death with valid provenance; friendly religious affiliation offers no protection; no disconnected fire or fabricated damage layer.
6. **Religion Spread:** same-seed with vs without the issued Oracle produces *measurably different real preaching opportunities* / reachable conversions in suitable setups; without eligible preacher, no fictitious worldwide conversion. Ordinary Priest works with no Oracle, and 40+ rival affiliation is protected against this mundane channel.
7. **Oracle ownership:** same-Saint same-type lock, independent types, quota, expiry, conclusion and owner death work. Spread must **not** increase food-work Calling or receive food fulfillment faith credit.
8. **Integration/UI:** selecting any visible ability uses that ability, not Rain or `food.produce` by mistake. Cooldown/DP/quota disable the correct button. Cast preview and final charge agree; fixed viewport, hints and Priest petition bubble remain intact.
9. **Regression:** `npm test`, `npm run smoke`, `npm run check:agriculture` pass; seeded save/restore and old save migration preserve already-earned world history.

## Scope limit

This is an incremental **playable Web PoC experiment**, not a final power taxonomy or full multi-God simulation. Protect existing agriculture balance, Priest behavior and determinism. More Miracle types (Protect, Accelerate, Wildfire, Storm) and other Oracles remain later candidates, not hidden dependencies of this slice.
