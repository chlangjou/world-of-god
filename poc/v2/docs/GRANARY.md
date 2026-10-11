# Settlement Granaries — Web PoC v2

**Status:** Experimental local settlement infrastructure, not an amendment to authoritative `main/docs/` Settlement Economy.

## Why the change

Before this version, every Settlement had an independent `storage` inventory initialized at zero, and production/consumption correctly respected local household access. But no **physical granary object or autonomous construction work** existed. The map therefore displayed only houses, even if several settlements had sizable public reserves.

## Minimal physical granary loop

- On founding a real Settlement, the community proposes one local granary at a nearby unoccupied land location. The proposal creates **no resources and no finished structure**.
- Existing `Settlement.storage` continues representing reachable public stock. Until the granary is built, this is **temporary communal/open-air storage**, not a magically completed building. Deposits, withdrawals, food safety and the current 20:80 new-output split remain unchanged.
- People autonomously prioritize missing public Wood/Stone when the project needs them, then choose `build_granary` as a normal, resource-constrained work action when the local stock and household food security permit. Materials are debited **once**, from that Settlement only; adults supply actual working shifts. Completion is a significant causal History event, with no food bonus.
- Separate towns have separate granary state and separate local inventory, even if their settlement influence circles overlap. No UI placement, quotas, inter-town food transfer, or free construction.
- Initial tunables in `config/balance-agriculture-v0.1.json` → `granary`: **Wood 6, Stone 4, work 6**, missing-material priority 13, construction priority 14 and minimum 4 food-access days. Kernel fallbacks cover Original and previous saved Agriculture profiles. These are candidate gameplay values, not economic calibration.
- Settlement inspector shows physical granary status, the town's own public food and Stone. The map displays a gold-roofed granary only when it has been built, with an outlined site while pending. The HUD's global public-food total is still a *sum*, not one universal warehouse.

## Compatibility and proof

Loading a historical `mvp0-web-2` JSON world adds an **unbuilt proposed granary** to each town where absent. It preserves existing stocks, people, soil and Divine Power, and actual construction begins only on subsequent simulation ticks. Re-import/save does not recreate the project after it is built. Targeted tests cover empty initial proposals, missing stone, actual construction, naturally formed multi-settlement granaries, legacy saves and deterministic replay. The existing Agriculture, Religion, Miracle and Oracle regressions remain in force.

## Out of scope

Storage capacity, weather spoilage, inventory transportation, trading posts, warehouse ownership/property law, larger infrastructure upgrades and structural damage/repair are not simulated here. The building itself does not generate food or Divine Power.
