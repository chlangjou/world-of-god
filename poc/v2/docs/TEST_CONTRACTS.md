# Current regression contracts — 2026-10-23

Accepted gameplay changes define expected behavior. Replace obsolete test assumptions
with checks of the agreed rule; a failing old assertion alone does not authorize
changing gameplay back. Preserve compatible custom profiles and old saves.

| Requirement | Regression coverage |
|---|---|
| Default physical contact is within **5 cells**, including the boundary | `mobility-contact.test.cjs` tests 5 and 5.001 cells, configured legacy radius 3, and disabled legacy movement. |
| A new outpost requires **2 households and 2 completed homes** | `core.test.cjs` checks actual autonomous founding against the current profile, alongside survival and local cultivation. |
| Standard AI starts evaluating at day 22 on an **18-day cadence**, first decision day **36** | `native-world.test.cjs` checks no decision by day 35, a real decision on day 36, and actual legal casting within 90 days. It does not require a cast at every decision. |
| Resource visits and missionary visits are independent | `mobility-contact.test.cjs` separately checks all trips disabled, missions enabled without resource visits, and ordinary resource visits. Contacts and conversion still require actual encounters/evidence. |
| The fixed religion inspector retains useful granary progress | `layout.test.cjs` boots the actual app and checks real material quantities, paid materials, construction work and completed status. |
| Saint and Priest roles remain visually distinguishable | `layout.test.cjs` records actual Canvas draws and checks distinct role colors; a real injury produces a collected petition and clickable prayer bubble, while no petitions yields no bubble. |
| Miracle and Oracle controls invoke the selected action | `layout.test.cjs` clicks the actual UI handlers with the real simulation, checking the Miracle result and the Oracle receiver/intent. `miracle-parameters.test.cjs` additionally covers aim tracking, parameters and DP. |
| Save/restore reproduces future world state | `religion.test.cjs` checks exact world equality after relay and cultivation, including migration of the unused old capacity cache without altering land, stocks or inhabitants. |

`browser-harness.cjs` is shared test infrastructure for the actual `app.js`;
it supplies a small DOM/Canvas adapter, not a replacement simulation. Tests exercise
rendered output and real actions rather than exact implementation strings.

The manual Oracle workflow now runs the current full suite with zero accepted
failures. The old comparison against a historical commit with two accepted failures
has been removed. Historical reports remain evidence of previous runs, not waivers
for current regressions.
