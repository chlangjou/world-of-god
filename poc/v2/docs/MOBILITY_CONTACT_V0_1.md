# Mobility & Physical Contact v0.1 — Web PoC v2

**Status:** experimental, branch `feature/opponent-difficulty-profiles-v0.3`; `main` is not modified.

## Scope

Physical mobility is a shared simulation substrate, not a religion-only transport
mechanic. Resident affiliation and household ownership remain stable during
temporary trips; actual `p.x/y` moves on the map.

- Each adult may elect a bounded autonomous resource visit in their work phase
  according to a stable per-person/day hash and a configurable cooldown.
  A bounded BFS on **existing** resource tiles identifies an obtainable hotspot
  9–27 cardinal steps away. A ford is passable only at marked periodic river
  rows; water itself is not a resource destination.
- A trip advances by at most seven adjacent cells in each 8-hour tick. At the
  real site it gathers material from the real tile inventory, then walks home
  and deposits the actual cargo. It consumes work time; no bonus food or forced
  missionary movement is created. Nearby ordinary work uses a reachable
  physical field/forage/material location where feasible.
- Physical contact requires the two living individuals to be within **three
  grid cells at the same sampled moment** in the tick (walking traces included).
  Each pair is recorded once per day. Records include person IDs, snapshot faith,
  home settlements, encounter coordinates, distance, and hour; records expire
  after seven days (and have a maximum length).
- Face-to-face conversations may make a Priest or ordinary believing adult
  a recent preacher. Only actual contact is eligible for social, Priest,
  abstract exchange replacement, and evidence-backed Oracle strategy contact
  in physical mode. Ordinary speech never bypasses the 40+ Devotion protection.
  Evidence-backed attraction/conversion retains its separate real-outcome,
  repetition, self-choice, and timing restrictions.

The existing oracle relay still requires local coreligionist listeners as well
as real cross-settlement contact. This v0.1 intentionally does **not** replace
all trade, profession, or migration decisions with pathfinding.

## Controls and compatibility

`config/mobility-contact-v0.1.json` is loaded by the Web UI for **new worlds**;
all fields are tunable. `mobilityProfile.enabled=false` reproduces the historical
abstract contact model; `W.restore` of pre-mobility saves defaults to disabled
rather than silently changing an existing player's world.

The movement module is separately packaged in `src/mobility.js`. The modular
browser build and tracked standalone HTML both load it **before** `src/sim.js`.

## Evidence / acceptance criteria

Use `node --test tests/mobility-contact.test.cjs` (included in `npm test`).

Check (1) true completed visits and non-river destinations, (2) every recorded
contact within three cells and no same-household contacts, (3) nonzero physical
cross-town meetings in an ordinary 30-person two-faith fixture, (4) none from a
disabled-travel, separated two-town control, (5) JSON save/restore determinism,
(6) no free Devotion or unearned 40+ rival conversion. These are tests of
*contact capability*, not a claim that religion reversal balance is solved.

The baseline 40 threshold, Miracle attack Presence restrictions, agriculture
fertility, and no-teleport household migration policy are unchanged.

## Limitations

Pathfinder uses simple cardinal BFS with explicit fords, not full geographic
trade routes; per-tick travel and short-lived contact logs are deliberately
bounded. Crossing paths only qualifies when people are spatially close at the
same sampled moment. Religion competition may need longer observations and
further balance work once more actual witnesses reach the opposing core.
