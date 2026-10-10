# World of God — 河谷初生 · Web MVP-0

> **God expresses intent; world determines execution.**

This branch is a **fresh, independent browser-based prototype** derived from the current `main` design specifications (Issues #1–#8 and the Issue #11 MVP-0 scope), **not** a port of the earlier `web-poc` code or its balance model. It deliberately focuses on the small playable God–World feedback loop before deciding on a production engine or Codex implementation workflow.

## Play immediately

1. Download **`World-of-God-Web-MVP0.html`** from this branch (or download the source ZIP).
2. Double-click **`World-of-God-Web-MVP0.html`** (or `index.html` in the source ZIP) in Chrome / Edge / Firefox. There is **no build step, package installation or server dependency** for gameplay.
3. Click **開始 / 繼續**. Use **1×, 4×, 16×** to observe settlement formation; the world can also run with no divine intervention.
4. Inspect residents and homes. Click **選擇降雨位置**, then the map, to inject Rain into the physical world. The cast changes moisture/crop conditions; actual Food still comes from labor.
5. When a Saint emerges, click **傳下神諭**. Residents decide how to act after social transmission. The inspector shows individual reasons and any changed priorities.
6. Observe drought-related **Prayer**, resource changes, fulfilled need, Devotion and Divine Power. Save/load via browser storage, or export/import a JSON state.

Keyboard: **Space** Pause/Resume, **1** toggle Rain targeting, **Esc** cancel Rain targeting.

## Implemented in this experimental release

- Pure browser-independent deterministic `sim.js`, fixed 8-hour simulation step, seeded RNG and clock-based effects; same kernel tested with Node.js.
- One 64×64 curated river valley, 24 real residents / 8 households, terrain, moisture, fields, food/wood/stone/fiber resources, autonomous jobs and real material-consuming housing.
- Emergent settlement when households cluster and actually build enough housing; two inventory ownership levels and configurable 20:80 allocation on *new storable production* after settlement forms.
- Basic life, hunger, birth/gestation, death and low-frequency household relocation under severe shortage.
- Individual religion/Devotion (40+ followers, contribution bands 0:1:2:4:8), separate Saint vs Priest emergence, global DP with weak natural regeneration, bounded prayer/attribution.
- **Rain** center/radius/intensity/duration, DP cost, cooldown, basic permanent Mastery and physical weather/crop consequences.
- **food.produce** Oracle to a Saint, individual per-Saint quota (4 initial/max, replenish once per 3 simulated months), same-Saint active intent lock, transmission, autonomous choice effects, expiry/conclusion/owner death. Ordinary work success does not auto-conclude a divine calling.
- Map, controls, God panel, compact household/settlement/person inspectors, significant event reasons and single-version save/load.

## Tests

No runtime dependencies. Node.js 18+ optional, only required to run automated tests:

```sh
npm test         # deterministic, autonomy, rain, Oracle, demographics and save checks
npm run smoke    # seeded complete-loop headless scenario
npm run build    # regenerate the self-contained offline HTML
```

A preview may also be served with `python -m http.server 8000`, but local `index.html` normally works directly.

## Status and deliberate limits

This is **playable MVP-0 experimental**, not full S0–S3 product completion and not final Sandbox v1. The exact balancing (food, drought, faith acceleration and duration) is deliberately provisional. There is only **one working Miracle** and **one Oracle type**; the full design's nine Miracle types and multiple religions remain future work, not a skill/era unlock gate. No polity, wars, Temple economy, detailed ecology or completed spatial high-tier Miracle gating yet. Rendering remains basic Canvas 2D, intentionally separate from simulation.

The `main` branch still holds the authoritative specifications, including [Issue #11's original implementation contract](docs/FIRST_PLAYABLE_IMPLEMENTATION.md). This **Web-first adapter** changes the *runtime choice* (browser+JS/Node versus provisional Godot+GDScript), not those gameplay invariants. See [Web MVP implementation notes](docs/WEB_MVP0_NOTES.md) for known gaps and test strategy.

Do not merge this experimental branch into main without design/playtest review. The older `web-poc` branch remains untouched.
