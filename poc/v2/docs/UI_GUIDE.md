> This is the PoC v2-local copy of the experimental UI Guide. Official design rules remain in main/docs.

# World of God — PoC UI Guide v0.1

**Status:** Experimental single-viewport layout and two-level Miracle/Oracle controls implemented on `web-mvp-0` (2026-10-11). Layout CSS is in place; manual browser verification at the viewport sizes below is still required.

**Scope:** Browser-first playable prototype. UI presentation may evolve without changing the authoritative God–World simulation or formal rules on `main`.

**Design aim:** The player spends attention **watching and affecting the world**, not scrolling through a document or reading repeated explanatory paragraphs.

## 1. Three primary rules

1. **No vertical scrolling in normal gameplay.** The world, intervention commands, current essentials and selected inspection content fit a single application viewport. Do not use page scrolling or independently scrolling resident lists. History is an explicit exception: it uses a scrollbar confined to its fixed-height inspector while other lists keep tabs, selection or pagination. No essential gameplay control may be clipped or pushed below the visible viewport.
2. **Hints instead of permanent explanations.** Use short labels and current actionable values by default. Explain rules and concepts on hover/focus/click/touch as contextual Hints/Tooltips. Essential state (food, DP, time, cooldown, current warning, action availability) stays directly visible; hiding it in Hints would defeat situational awareness.
3. **Unavailable Miracle = visibly greyed and non-castable.** During a cooldown, the Miracle remains usable if the God can afford its escalating forced-cast DP price; the action shows 2×, 3×, etc. Grey out only when DP or another mandatory condition makes casting unavailable. The player cannot enter targeting or execute the cast until it is available. When blocked for other reasons, show a truthful reason (e.g. insufficient DP, invalid area/permission) as well.

These are UI/presentation constraints, **not gameplay balance changes**. Do not shorten Miracle cooldowns, auto-cast, bypass DP checks or alter faith/Oracle mechanics merely to make a button appear usable.

## 2. Fixed viewport and information hierarchy

### 2.1 Single-screen desktop layout

Prefer an application shell fitting `100dvh` with a small compact HUD/header, a **dominant map**, compact always-present divine action controls and one contextual right-side inspector. The map and active controls should remain visible when a new person, settlement, prayer or history event is selected.

Illustrative layout, not mandatory pixel geometry:

~~~text
┌────────────────── Compact world HUD / Time / DP ─────────────────┐
│ ┌──────────────── World Map ───────────────┐ ┌─ Inspector ────┐ │
│ │                                         │ │ [Needs]        │ │
│ │  World simulation, selection, Rain AoE  │ │ [Settlement]   │ │
│ │                                         │ │ [Residents]    │ │
│ │                                         │ │ [History]      │ │
│ └─────────────────────────────────────────┘ │ Page/Detail    │ │
│ ┌────────── Miracle / Oracle Action Bar ──┐ └───────────────┘ │
│ │ Rain [state]  Oracle [state]  ? hints   │                    │
│ └─────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
~~~

- The browser/document itself must not be a long vertical reading surface in regular play.
- Avoid nested `overflow-y:auto` for residents and household lists. **History alone** uses a bounded internal scrollbar (newest first; up to 200 recent significant events), without making the document or whole sidebar scroll.
- Prefer responsive map size with correct aspect ratio, and use `min-height:0` / proper flex/grid constraints for fixed panels. Do **not** simply apply `overflow:hidden` to the existing tall layout and silently hide content.
- Do not permanently reserve height for the opening explanatory banner, large title, repeated subtitles, or verbose notice paragraphs. Put these in a Help overlay or Hints.
- If a temporary dialog cannot fit, use discrete steps/tabs/pagination rather than introducing whole-page or in-panel vertical scrolling. Dialogs must have obvious close, cancel and keyboard handling.
- On smaller screens or lower height, switch from two-column view to a compact **map-first tabbed inspector**. The initial PoC is desktop-oriented, but essential controls must remain reachable without page scrolling. Maintain readable text and operable target sizes; avoid solving the problem solely by shrinking everything.

### 2.2 What is always visible

Keep visible: current simulated day/season, Pause/Speed, world map, relevant selection, top-level population/food/faith/DP, critical active shortage or Prayer alert, Miracle/Oracle action availability, and action costs or time remaining when blocked.

Inspection may show more values on demand (household supply, profession vs Activity, decision reasons, soil details and event provenance). Avoid showing full histories, all people, all household fields and all actions at the same time.

## 3. Hints / Tooltips

### 3.1 Persistent label vs contextual explanation

| Current content type | Default presentation | On-demand Hint / Detail |
| --- | --- | --- |
| Rain button | `喚雨`, state + cost or cooldown | Rain modifies moisture; harvest still needs soil/crops/work; casting settings |
| Oracle button | `糧食神諭`, Saint/quota/active | Saint reception, propagation, mortal agency, per-Saint same-type lock |
| Top resource HUD | Food / DP / population / follower counts | Accessible food definition, weighted Devotion, DP regeneration |
| Resident inspector | Name, current Activity, concise reason | Work candidates, proficiency, full causal explanation / Calling contribution |
| World / map legend | Compact visual legend or icon help | Terrain explanations and controls |
| Events | Short timestamp + meaningful headline | Actual attributable causal reasons (expand/select) |

- A Hint should answer *what it means*, *why this state exists* or *what the player can do*, ideally in one or two short sentences. Use a separate, paginated Help view for long educational content.
- Mouse hover and keyboard focus should reveal Hints; tap/click should work without hover on touch devices. Do not make Help accessible **only** by hover.
- Use meaningful accessible labels, `aria-describedby` or equivalent descriptions for controls. Avoid covering the target action or map with a persistent Hint.
- An unavailable control still needs a discoverable reason. A native disabled button may not receive focus/hover, so expose the reason next to it or through a separate focusable information affordance. Tooltip alone is not sufficient for critical errors.
- Distinguish a short transient toast for command feedback from a permanent Hint and from History. No repetitive instructional toasts on every simulation tick.

## 4. Miracle action state contract

Miracle availability comes from the authoritative simulation evaluation (`evalRain` / eventual general capability API). UI must never invent its own eligibility rule.

| State | Visual | Interaction | Required player feedback |
| --- | --- | --- | --- |
| **Ready** | Standard colored, high-contrast active button | Can enter targeting | Approx. DP cost; target/settings ready |
| **Targeting** | Distinct selected state and map range preview | Map click issues validated cast; Esc/cancel exits | Cast area, intensity/duration and DP estimate |
| **Cooldown with enough DP** | Available, clearly labeled `強制施放（N×）` | May target and cast at N× DP cost | Remaining simulated cooldown + actual next-cast DP |
| **Insufficient DP** | Inactive/grey with distinct cost indicator | Cannot start/cast | Current DP, required DP, `神力不足` |
| **Other invalid input / local capability** | Inactive with reason | Cannot execute; settings may remain editable | Concrete reason such as invalid center, intensity, local capability |
| **Paused** | Preserve actual ready/cooldown status | UI may inspect/change settings; time stops | Countdown stays constant; casting policy remains simulation-owned |

Implementation guidance:

- Recalculate button state when sim time, DP, Miracle settings, selected target, Mastery or capability changes; do **not** use a wall-clock timer that counts down while paused.
- While cooldown is active, **show the escalating DP multiplier and cost**. Keep `#rainBtn` usable when the next cast is affordable; grey it out only when the next real DP charge is unaffordable. Keyboard shortcut `1` uses the same rule; the final clicked center is revalidated by the simulator.
- A disabled visual state **must not rely on color alone**: preserve the clear status/reason text and optionally a lock/hourglass icon. Keep contrast readable.
- If the candidate target location is not yet specified, show center-dependent cost/permission as a provisional preview, and revalidate the final map click. Do not imply provisional eligibility is a final guarantee.
- For multiple future Miracles, **each Miracle has independent cooldown and Mastery**. A blocked Rain button must not grey out unrelated available powers.
- Oracle has a **different** availability model: Saint reception, quota and active type lock, not Miracle cooldown or DP. Show its own state/reason.

## 5. Inspection and navigation rules

- One selected person/household/settlement at a time; display a concise summary in the visible inspector. Detailed Work Demand, resource access and faith explanation can open a contextual detail page.
- Prefer tabs such as `祈禱`, `聚落`, `居民`, `歷史`. Keep household lists paginated and History inside its own fixed-height scroll area; never grow the sidebar as population grows.
- **History only contains meaningful events** per current rules: births, deaths, sustained famine/recovery, migration, major settlement and divine/religious outcomes. The most recent 200 are retained by default, ordered newest first in a scrollable History-only panel. Routine counters belong in stats.
- Sim speed, pause and active Miracle feedback must stay visible even after selecting another person or detail view.
- Help/Hints are presentation state and must not change the simulation or its deterministic results.

## 6. Historical gaps in Web v0.2.1 (before the 2026-10-11 UI revision)

These gaps led to the current **fixed-viewport, tabbed inspection, two-level divine selection and disabled-Rain UI**. The bullet points below describe the *previous* v0.2.1 implementation:

- `index.html` / `style.css`: the header, intro, five metrics, large square canvas, intervention cards, four sidebar panels and footer form a tall page. The regular flow is not constrained to one viewport.
- `style.css`: `.person-list { max-height:105px; overflow-y:auto; }` and `.events-panel .events { max-height:460px; overflow-y:auto; }` explicitly introduce internal vertical scrolling.
- `index.html`: intro paragraph, section explanation paragraphs, action descriptions and advisory paragraphs occupy permanent height; most can move into compact Hints/Help.
- `app.js`: `updateCost()` writes cooldown text into `#rainCooldown` but does not disable or grey out `#rainBtn`. The button click/keyboard handler can arm Rain even during cooldown, with failure only after a map click. `#oracleBtn` already uses `disabled`, offering a consistent pattern to reuse.

## 7. UI acceptance and regression tests

Test with both little and much content (e.g. 24 vs 40+ people; few vs 100+ recent significant events), while paused and at 1×/4×/16×.

- [ ] **Viewport:** normal gameplay at desktop baseline **1366×768** and **1920×1080**, 100% browser zoom, has no page-level vertical scrollbar; map, time and essential divine actions fit within the viewport. Test compact behavior at **1280×720**. Do not hide controls by clipping.
- [ ] **Bounded History-only scrolling:** household/person lists still use pagination or selection, while History alone has a usable internal scrollbar with newest events above older events. No page-level scrollbar.
- [ ] **Contextual hints:** long explanations removed from routine layout; Hints accessible through mouse hover, keyboard focus and touch interaction. Important DP/cooldown/shortage state is visible without hovering.
- [ ] **Cooldown:** cast Rain, confirm next cast is shown at 2× DP and remains targetable when affordable. Additional same-skill casts cost 3×, 4×, etc., and become unavailable when DP is insufficient. The countdown runs on simulated time and returns to 1× when complete.
- [ ] **DP/capability:** low-DP and invalid-cast conditions show distinct, truthful reasons and never spend resources. The same simulator validation path applies to mouse and keyboard interaction.
- [ ] **Oracle:** insufficient quota or same-Saint active intent clearly disables Oracle action without masquerading as a Miracle cooldown.
- [ ] **Content stress:** adding people, prayers or events does not push the map/offscreen controls out of view; panels update without losing selection and UI state.
- [ ] **Simulation integrity:** UI-only changes do not affect deterministic headless simulation, Divine Power, duration, cooldown mechanics or Oracle/Faith ownership.

## 8. Scope and rollout

This document is **a UI Guide for the PoC**, not a request to redesign the simulation. Apply it during the next Web PoC UI iteration, then verify the acceptance checks and actual browser layout.

Suggested rollout: (1) fixed viewport and map-first layout; (2) compact panels, tabs/pagination and contextual Hints; (3) real disabled/grey cooldown states and consistent pointer/keyboard handling; (4) responsive/manual usability regression.

**Authoritative source:** `main` gameplay/Simulation/Miracle/Oracle contracts remain unchanged. This guide governs experimental **presentation**, not numeric balancing or rule changes.

## 9. Web PoC layout revision (2026-10-11)

- Replaced the long stacked page with a bounded `100%`-height header, top HUD and a workspace containing the map and a right-hand control/inspection rail. The map and selected divine action remain visible together.
- Divine selection has **two layers**: Miracle/Oracle category tabs, then an extensible power-type dropdown (Rain or food-production Oracle currently implemented). Selected power parameters/actions appear only in the corresponding compact panel.
- Resident inspection is a dropdown rather than an unbounded button list. Household cards are paginated; the History tab now uses one bounded internal scrollbar showing newest events first (retention 200), without document scrolling.
- Rain reads live `evalRain` status. Cooldown means a higher DP multiplier rather than an unconditional disabled button. Insufficient DP disables the cast/target control with a textual reason; the `1` shortcut shares the same check.
- Header File dropdown keeps save/load/import/export reachable without spending permanent horizontal width on each button.
- Baseline viewport sizes **1280×720, 1366×768 and 1920×1080** remain manual visual acceptance checks; no verified browser screenshots were produced in this change.

## 10. Click-to-locate needs (2026-10-11)

- **Need origin is actionable:** every active Prayer in the Needs inspector is a focusable button with its original evaluation center's place name and coordinates. Show up to three per page; keep remaining entries navigable with compact pagination, **without** creating page-level or normal-inspector scrolling.
- **Map indicator:** selecting a prayer shows a distinct crosshair and location label. Local crop-water prayers use the radius already employed by the World prayer evaluation (currently 11 cells), depicted as a dashed *reference* ring. Never mislabel it as a required Miracle cast radius or a guarantee of downstream success.
- **Priest parity:** every collected prayer carries the same source location as its originating record. Selecting the Priest bubble opens the first/current need with the map pin, and the Priest prayer navigator changes the pin as it changes the need. Never position all petitions at the Priest's current coordinates.
- **Lifecycle:** answered, resolved, lapsed, or removed needs release their pin immediately on redraw. New World/load resets transient selection; changing the paginated global list clears stale selection. The user can also clear the map pin manually or use Esc when no Miracle is armed.
- **Divine interaction:** location selection merely guides God; no DP charge, auto-cast or change in underlying Faith/World state. Until the pointer enters the map, the selected center may be used for Miracle preview. The final map click is still independently validated and must remain explicit.
- **Source precision:** a settlement-aggregated need is marked at its *evaluation center*, not advertised as an individual person's exact live location. Old founding-area water requests that lack stored centers use the original camp-based evaluation center.
- **Functional checks:** tests cover three distinct water needs, source switching, additional-page navigation, Priest bubble navigation, expiration cleanup, crop evaluation radius, unchanged DP, and save-format compatibility. The three desktop viewport sizes remain subject to real-browser visual checks.

## 11. Sticky Miracle controls (2026-10-11)

- Every Miracle has **its own independent last-used radius, intensity and duration settings**. Moving to another Miracle and back restores the values last entered for that skill, not its defaults. Casting does **not** reset them; the next permitted cast can reuse the same parameters.
- Keep the last selected Miracle and Oracle separately when the player switches tabs. The slider setup of a timed Miracle must survive visiting an instant Miracle with the duration control hidden.
- First selection of a never-edited ability uses its ruleset defaults. Restored values are clamped to that ability's current range, duration and intensity limits when a ruleset/Profile changes.
- The preferences are **presentation-only, in-memory for the open browser page**, including world reset/load within that page. They are not Divine state, do not alter DP/cooldown/Mastery, are not written into the deterministic world save, and do not claim persistence across a browser refresh.
- Interaction acceptance covers multiple Miracle round trips, instant/timed switching, Miracle/Oracle tab switches, direct cast with restored parameters, world reset/load and changed upper bounds. No A/B balance experiment is involved.

## 12. Per-cast cooldown preview (2026-10-11)

- The Miracle panel displays **projected cooldown in simulated days before casting**, updating with radius, intensity, duration, selected skill and its Mastery. A wide 5-day Rain cast may have a longer cooldown than a tiny one, but it must be meaningfully shorter than an otherwise identical 30-day cast at usable settings.
- A successful cast starts the cooldown immediately. The remaining counter uses the **authoritative** `readyAtHour` and keeps running on simulated time, not wall time or the duration of the World effect. Preview values come from the same simulation evaluator and are quantized to the actual simulation tick.
- Cooldown-active buttons now remain usable **only if** the God can pay the rising 2×, 3×, ... surcharge. Changing duration affects the new cast's own baseline and deadline but cannot shorten an already longer cooldown. Instant effects have no duration-based cooldown scaling. Separate skills still have separate clocks.


## 13. Fast-forward interruption for actual player concerns (2026-10-11)

- Accelerated playback advances in **8-hour simulation ticks** with an attention check after every tick; stop on the triggering tick rather than at the end of a long catch-up batch. The kernel reports factual notices; only `src/app.js` changes playback speed.
- An open petition from one of the player's real believers slows 4× / 16× to **1×**, shows the Needs tab and pinpoints the prayer source. No automatic Miracle or Divine Power spend.
- An enemy's destructive / interfering Miracle overlapping living player believers, or an opposing Priest actually reducing a player's believer's Devotion or causing conversion, **pauses**. Highlight the map position and show the affected resident when possible.
- Mere enemy talk without actual faith change, normal food labor, routine births and other nonurgent history should **not** stop accelerated playback. Repeat hostile preaching warnings can be throttled; a new conversion remains urgent.
- The stopped speed is synchronized with speed buttons; old save history must not re-interrupt when loaded. Esc dismisses a previous hostile event marker. Existing viewport/pager and Miracle control requirements remain intact.
- This incremental fast-forward change did **not** request additional dedicated simulations or tests. See [Indigenous World Genesis](WORLD_GENESIS_NATIVE_V0_2.md) for conditions and data ownership.

## 14. Cooldown DP Escalation instead of a hard lock (2026-10-12)

The later approved gameplay contract **supersedes earlier hard-lock and always-grey cooldown wording** in this guide. See [Cooldown DP Escalation v0.1](COOLDOWN_DP_ESCALATION_V0_1.md).

- For the first cast of each Miracle, display base DP and normal cooldown.
- During that same skill's cooldown, preview **the actual 2×, 3×, ... cost of this cast's own parameters**. Enter-targeting remains available while DP is sufficient; map click must validate again. Missing target, insufficient local presence, and other simulation checks still apply independently.
- An unaffordable forced cast is greyed out with readable reason, current DP and required DP. Reset the premium to 1× once the authoritative `readyAtHour` is reached.
- Recasting a shorter-duration Miracle must **never decrease** an earlier longer cooldown deadline; other Miracle skills and enemy cooldown chains are unaffected.
- `tests/miracle-parameters.test.cjs` checks the real UI button state/cost preview; simulation tests cover counters, save/restore, and the no-free-cast guarantee.
