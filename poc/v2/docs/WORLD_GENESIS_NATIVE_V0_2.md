# World of God Web PoC v2 — Indigenous World Genesis & Critical Notices

**Status:** Experimental, 2026-10-11. Code under `poc/v2/`; formal `main/docs/` rules remain authoritative. The new-game profile is `config/opponent-v0.2.json`, with Agriculture tunables in `config/balance-agriculture-v0.1.json`.

## World-first Genesis (two distant Gods and existing native people)

New browser games start with 51 individuals:

- Player (`g1/r1`): 4 starting households / 12 initial adherents on the east/south-east side.
- AI (`g2/r2`): 4 starting households / 12 initial adherents on the opposite side, at least 29 cells from the player camp (default dimensions/seed).
- Indigenous population: 3 pre-existing villages (`n1/n2/n3`), with 3 real households and 9 initially unaffiliated individuals each (27 people). Households have pre-existing homes, private Food, communal historical stock and nearby farm fields. `nativeOrigin` remains on a person after they choose a religion.

The 3 villages are **not God-owned territories**. Nobody is automatically converted because their village is near a deity; converted individuals remain native people. Gods' own households establish `s1/s2` through ordinary home-building, not by annexing the original villages. One-God new worlds still start with native villages by supplying `worldGenesisMode:'native'`; existing old saved games preserve their prior household and settlement placement.

### Fair, water-aware village selection

At new world generation, candidate meadow tiles are scored by water access, fertility, moisture and real terrain resources (no generated free resource tile). Selection is deterministic from existing terrain: one village near each origin and one near the equidistant midpoint.

New-game checks across 5 seeds enforce:

- The middle village's distances to both God origins differ by **at most 3 map cells**.
- The two outer villages' *near-side* distances to their corresponding Gods differ by **at most 3.5 cells**; neither is granted extra initial followers.
- All three village centers are within **10 map cells of river-bank influence**, avoiding unreasonably dry native starting locations.

This is approximately equal **opportunity**, not forced equality of conversion rates or difficulty. The simulation may produce different religious growth due to geography, needs, actual Priest influence and player decisions. Small custom maps may use a relaxed location fallback.

### Native stock and voluntary, climate-risk-adjusted production

Instead of adding a water-consumption simulation, use the existing soil-moisture, real crop-stock, Food and seasonal work model. This also avoids introducing instant dehydration without an existing drinking-water resource.

`agriculture.nativeResilience` configures a settlement's risk using the modeled river-bank distance. Villages were inhabited before the Gods arrived, so Genesis may contain credible *historical* communal food stock: normally 15 days' total Food coverage, increasing up to 34 days for very remote villages. Food is allocated at initial world creation, not granted by Miracle or continuously replenished without labor.

During play `localReservePolicy` computes the local desired stock from the same water risk. On a very remote site, the planning target can rise from 18 to 38 days, the relaxation threshold from 18 to 36 days, and the comfortable-care threshold from 26 to 46 days. These are work **preferences** (a household chooses real feasible harvesting), not a hard job assignment or guarantee of actual food supply. The `town.workDemand` diagnostics and settlement inspector show this target. No food is minted by setting a goal.

The old Agriculture Original mode is unchanged when not using the new native-world Genesis.

## Fast-forward interruption

The simulation emits bounded structured, deterministic `attention` notices; the browser, not the kernel, decides playback speed.

- **New real player petition:** 4×/16× → 1×, automatically choose the Needs tab and locate the new prayer source, without casting or consuming Divine Power.
- **Enemy destructive/interfering Miracle actually reaches player believers:** immediate Pause; locate and highlight impacted region, inspect a witness.
- **Enemy Priest causes actual Devotion loss or conversion of a player follower:** Pause and locate the affected person. Mere proximity/sermon without belief effect does not interrupt. Similar non-conversion pressure is rate-limited to avoid repetitive stops; conversions always count.
- Unrelated childbirth, work and ordinary events do not change speed. Other Gods' own prayer needs do not interrupt the human player.

The browser checks new notices **after each simulated 8-hour tick during fast-forward**. It does not advance the rest of a batched interval after a critical event. At 1×, the event marker may be dismissed with Esc. Restoring an old save normalizes the optional notice field and skips historical notifications.

**Per request, this specific fast-forward-interruption component received syntax-only validation, without a separate event simulation or added interaction tests.**

## Verification and known limits

The `tests/native-world.test.cjs` suite covers real native population, initial homes/stores, distinct origins and memberships, terrain-aware equalized access, risk targets, 48-day drought survival and deterministic save/restore. Two seeds were run under a 16/32/48-day drought window and the native villages survived with no forced deaths in this baseline experiment. This is not proof for all climates, Miracle attacks, migration or long-term catastrophe.

Deferred: actual nomadic households / roaming hunter-gatherers, low-frequency in-migration, formal tribal politics, native languages/cultures and territorial borders, water consumption, opponent difficulty levels and browser UX review at every desktop size. These are separate follow-up features, not silent changes in v0.2.
