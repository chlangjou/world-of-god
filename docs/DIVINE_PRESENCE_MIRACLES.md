# Divine Presence and Spatial Miracle Capability — v1 Contract

Status: **Agreed spatial interface contract from Issues #5, #7 and #8 (2026-10-09), aligned with Miracle v1 (2026-10-10)**. Numerical balance remains configurable.
See [Religion v1](RELIGION_PRIESTHOOD_TEMPLE.md) and [Miracles and Divine Power v1](MIRACLES_DIVINE_POWER.md).

## 1. Separate global resource from local capability

- Each God has one **world-wide Divine Power pool**, funded primarily by followers' effective Devotion plus a weak, configurable **natural regeneration** that continues with zero followers (#7). No regional spendable Divine Power stock, transfers, or temple-based reservoirs. Natural DP does not add Local Presence or bypass spatial gates.
- **Local Divine Presence** is a spatial field derived from the location and #5 weighted Devotion of real followers. Follower counts, Temple counts, political territory, and religious population percentages are **not** independent divine power multipliers.
- The base effective Devotion weights remain `0:1:2:4:8` across bands `0–19 / 20–39 / 40–79 / 80–89 / 90–100`. Same band weights feed the global contribution model and local field inputs; rates/normalization may differ by role.
- Global stored power does not bypass low local capability. Likewise strong local capability does not waive global cost or cooldown. **Sandbox v1 makes all nine initial Miracle types available without an unlock tree**, but an individual cast must still pass capability/DP/cooldown checks.

## 2. Two dimensions of presence

For God `g` at map location `x`:

```text
P[g,x] = weighted spatial contribution from affiliated believers
density[g,x] = normalize(P[g,x], spatial area / kernel)
dominance[g,x] = P[g,x] / sum(P[all gods,x])
```

When total Presence across **all Gods** at x is zero, dominance is zero; if only God g has positive Presence there, g's dominance is **1.0**. **Dominance is share of effective divine contribution, NOT a percentage of residents or nominal followers.**

- High dominance with tiny absolute contribution does not authorize high-tier Miracles.
- High absolute contribution without sufficient dominance is still **contested**.
- Multiple gods' fields may overlap. Political borders and Settlement membership do not define the field; use World coordinates and derived spatial aggregates / caches.
- Spatial kernel, resolution, normalization, density thresholds and category-specific dominance requirements are **configurable / deferred**, not fixed into storage schema.

## 3. Miracle category permissions

Working v1 policy:

| Local condition at cast center | Support/healing/blessing | Offensive or terrain-changing Miracle |
| --- | --- | --- |
| Weak density | Low-tier only, subject to per-Miracle limits | Locked |
| High density but contested share | Support types allowed within their own limits | Locked |
| Sufficient density **and** dominant share | Allowed within tier/cost limits | Potentially unlocked by category/tier |

- First-pass dominance gate: **strictly greater than 50%** of local effective divine contribution, *plus sufficient local density*. The `0.50` threshold is a **tunable balance default**, not an engine invariant.
- **Capability is classified per cast by its requested direct physical effect and magnitude**, not permanently by Miracle name, intended moral purpose or downstream casualties. Ordinary Rain is support even if already-wet terrain floods; deliberately extreme rainfall can require destructive permission. See [Miracle v1](MIRACLES_DIVINE_POWER.md).
- Dominance is an **eligibility condition**, not instant access to every high-tier Miracle; density may cap maximum intensity and size. Local efficiency/cost modifiers should be moderate and configurable to avoid redundant triple penalties.
- No moral protection/forced faction balancing: eligible Miracles may harm rival followers or temples.

## 4. Cast-center eligibility, world consequences

**Check Local Presence / density / dominance only at the Miracle cast center.** Do **not** scan/re-gate each point in its area-of-effect for permission.

1. Evaluate the cast center and selected Miracle/type/intensity against local capability and global resources.
2. If valid, spend power and execute the predefined Miracle effect/range.
3. Apply outcomes to all affected world entities, including friendly believers and structures, without immunity.
4. Secondary physical processes (fire, flood, weather, water flow, etc.) follow World simulation across borders, without rechecking Divine Presence.

This is intentional for predictability and strategy. An area-of-effect may cross into contested or rival-controlled places; it does not retroactively invalidate a cast authorized at its center.

The eligibility API should nevertheless accept a *target area / intended range* for ordinary Miracle size/cost calculations. Only **cast-center** Presence is consulted in v1.

## 5. Short eligibility hold to suppress threshold flicker

- When both required density and dominance thresholds are satisfied, refresh a short **high-tier-eligibility expiration time** for the applicable god / spatial sample / capability category.
- When values dip below threshold, eligibility can persist until that deadline. This is not ongoing recharge and does not waive cost/cooldown.
- First-pass holding period: **60 seconds of simulation time**, tunable. The relevant clock advances according to the game simulation, not wall-clock time; save/load, pause and speed change must preserve semantics.
- This is a recent-qualification grace period; it intentionally permits short use after falling below the threshold.
- Specific cache/grace granularity, expiration storage, and behavior of multiple categories remain implementation choices. Use a single consistent evaluation path, not ad-hoc Miracle-specific comparisons.

## 6. Stable API boundary

Conceptual interfaces:

```ts
getDivinePresence(godId, location): PresenceSample
getDivineDominance(godId, location): number
evaluateMiracle(godId, miracleType, castCenter, targetArea, intensity, duration):
  { allowed, maxIntensity, effectiveRange, cost, reasons }
```

Three layers:
1. **Faith contribution:** authoritative person affiliation, Devotion, position.
2. **Spatial field:** derived/cached `P[g,x]`, density and dominance for all gods.
3. **Miracle capability:** configurable category eligibility, maximum output, cost/effect policy, grace period.

Change `50% → 60%`, `60s → 120s`, per-Miracle density cutoffs, or efficiency curves in Layer 3 without altering Layer 1's data ownership. Spatial field representation may change independently. A future move to local spendable pools would be a **major design change**, not just a parameter tweak.

## 7. Acceptance/regression contract

- High density + high share may **authorize** high-tier direct effects; high density + low share cannot authorize offensive/terrain casts; low density + high share still cannot. This is **cast eligibility**, not a Sandbox catalog unlock.
- Two gods compete by contribution, not headcount. No-presence denominator behaves predictably; a lone positive-presence God gets 100% dominance.
- Center-inside/area-crosses-border is allowed when center meets the policy; center-outside/area-crosses-inside does not borrow authorization from elsewhere.
- Friendly entities are affected normally; consequential physical effects propagate normally.
- A short dip below threshold retains eligibility for the configured simulation-time hold, then expires absent renewed qualification.
- Save/replay with the same ruleset version and input is deterministic. Save format/ruleset versions capture rule changes as appropriate.
- `web-poc` currently uses a simpler global-faith/cost model: it does not yet implement multiple religions, the spatial Presence field, or this Miracle eligibility model.
