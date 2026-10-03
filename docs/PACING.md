# Web PoC 0.1.1 · pacing revision

## Intent and measured scenarios

Easy should permit a playful intervention about every 10–20 real seconds at 1×, with room to observe. Two opening miracles must not strand the player for a minute. Observation alone must not spiral everyone into permanent disbelief. This is provisional prototype balance, not a change to the main design specification.

Measurements use **actual UI defaults**, not the higher `Core.create()` preset belief values: seed `river-dawn-01`, belief .28; valley moisture .65 / food80, dry .28 /45, islands .70 /80. A tick is .5 seconds at1×. Two casts occur on the same tick, one per town; the measured wait ends at18 power (enough for another rain). No acceleration or added power.

| Preset | Old two rains | New two rains | Old rain+bless | New rain+bless |
|---|---:|---:|---:|---:|
| Valley |66.5s|9s|50.5s|7s|
| Dry |76s|10.5s|71s|8s|
| Islands |67s|9.5s|50.5s|7.5s|

Rain remains18, blessing14, oracle10, starting power38, cap100. New per-tick conversion is `(0.15 + devotion * 0.045) * difficulty`, with difficulty2.5/1/.55. Previously `(0.015 + devotion * .012) *1.65/1/.55`. Difficulty affects power only. Normal two-rain recovery is22/26.5/21.5s; hard40/45.5/40s. The zero-devotion easy floor is .75 power/second, giving a24s full rain refill. Costs and finite storage prevent unlimited same-tick casting. Faster recovery does not produce food directly or force oracle compliance.

## Why faith was declining

There was no passive idle penalty: repeated hunger above55% deducted faith every tick, while hunger also suppressed prayer and power generation. Per-meal consumption .18 with hunger relief .022 exceeded sustainable food throughput, especially in the dry start. Merely increasing power would mask that loop.

Meals now cost .12 for the same relief, globally. NPC scoring, movement, traits, oracle agency, ecology and weather are unchanged. Hunger still creates pressure and temporary doubt, capped at6 percentage points. Doubt recovers by .0006/tick when hunger<.4; above.55 it grows by `.0003*(.5+independence)`. The ledger tracks only faith actually lost, preventing a zero-faith resident gaining belief through clamped debt. Prayer, witnessed miracles and oracle outcomes retain separate effects. A failed oracle can still leave a lasting loss.

Completely unattended runs (no opening miracles):

| Preset | Initial faith | Old10min | New10min | Old30min | New30min | New30min food |
|---|---:|---:|---:|---:|---:|---:|
| Valley |27.9%|11.1%|34.9%|0.2%|42.5%|38.8|
| Dry |25.3%|0.5%|26.1%|0.0%|29.3%|44.7|
| Islands |27.4%|10.1%|33.7%|0.8%|40.2%|46.4|

All three finish at approximately11% hunger. Individual beliefs differ; no guaranteed conversion or faith floor is imposed. Dry retains meaningful early food pressure. Automated coverage expands unattended runs to3 seeds ×3 presets ×3 difficulties for30 minutes each, plus one intervention every20 seconds for10 minutes in each preset.

## Feedback and compatibility

The UI reports current power/second at1× and approximate time to afford each action at the chosen speed. These are estimates from current devotion, not guaranteed countdowns. Pausing, Genesis, guide and history freeze simulation. An active oracle is labelled as awaiting inhabitants, rather than promising immediate recasting. Faith details show temporary doubt separately.

Rain changes soil within7 tiles and supplies an observable sign to towns within9 tiles. Signs are evaluated once; actual moisture is required. Blessings gain belief through successful local harvest, not the button press. These existing limits are now explained in the guide.

Save shape remains version1. Optional `hardshipDoubt` defaults tozero; old `wog-1` saves pass validation, retain their world and immediately receive current power conversion. Subsequent simulation marks `wog-1-pacing`. A real save produced by the previous core, advanced500 ticks with a miracle, was validated and continued500 more ticks. Old accumulated faith losses are not guessed or silently restored. New saves are forward-only with respect to the old app; deterministic continuation is guaranteed only within the same ruleset.

## Verification boundary

35 automated tests pass, plus syntax checks and deterministic offline build. UI coverage uses a simulated DOM/canvas, not an actual browser. Prior real-browser environment restrictions remain in effect; visual layout and genuine pointer/storage/download behavior remain unverified. See VERIFICATION.md.
