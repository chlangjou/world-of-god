# Priest Interaction v0.2 — Web PoC v2

**Status:** Experimental gameplay / observation slice under `poc/v2/`. Formal God–World authority stays in `main/docs/` ([Religion v1](../../../docs/RELIGION_PRIESTHOOD_TEMPLE.md), [Oracle v1](../../../docs/ORACLE_DIVINE_CALLING.md)).

## Observable priesthood

A real Priest appears autonomously from existing settlement believers and an eligible housed adult, independently of Saint qualification. In the map **Saint is cyan**, **Priest purple**, and a dual-role person displays both a cyan center and purple ring. Role affiliation is also shown in the resident inspector.

- If a Priest has at least one **real currently open local prayer**, an outlined gold speech bubble appears beside/above that person. The minimum visible circle is 20 CSS px wide even when the canvas is scaled down.
- Clicking the bubble opens the Needs panel and shows the Priest, originating settlement, real petition category and reason, number of distinct supporters, and original simulated date. Multiple petitions use a compact per-prayer navigator, not full-document scrolling.
- The bubble disappears when its underlying prayers are answered, resolved or expire. Merely assigning the Priest role never creates a prayer or promise.
- **Prayer does not need Priest**: believers' direct petitions remain in the underlying world when `priesthoodEnabled=false`. Priest is the *local information aggregator* and social organizer, not a gatekeeper to God.
- Local bounded prayer categories in this v0.2 proof: drought/crop trouble, local food insecurity, injured believers, and unhoused families. They originate from real conditions and are scoped to inhabited Settlements. The pre-existing founding-area Rain fulfillment retains evidence-based faith credit and cannot be farmed per tick.

## Real social advantage

The previous Priest multiplier was dominated by family contact in a fully affiliated starting village. This revision makes the bonus independent, deliberately enhancing recruitment while still requiring a local **recent leisure-time sermon** from an actual Priest.

| Parameter | Baseline | Meaning |
| --- | ---: | --- |
| `priestTeachingMultiplier` | 1.8 | Extra consolidation, slower above Devotion 40; ordinary teaching capped at 60 |
| `priestJoinChance` | 0.24 | Separate weekly Priest recruitment chance for unaffiliated citizens (scaled by receptivity) |
| `priestRivalDoubtChance` | 0.58 | Weekly chance of doubt when a low-Devotion rival actually hears the Priest |
| `priestRivalDoubtStep` | 3 | Bounded decline toward 19 during repeated sermons |
| `priestRivalConversionChance` | 0.30 | Weekly chance of choosing the new religion after prior belief drops below 20 |
| `priesthoodEnabled` | true | Comparative test flag; when false there is no autonomous Priest office |

A rival person at **Devotion 40 or above cannot be eroded or switched by ordinary Priest preaching**. Only low-Devotion rival affiliations are susceptible, and conversion is voluntary/probabilistic after repeated contact. This is **not** full multi-religion gameplay: no actual competing God, rival DP, sacred infrastructure or reciprocal rival preaching exists yet.

### Seed-matched checks

With Agriculture, same rules and no player Miracles / Oracles, for the default starting community at day 180 (`valley-spring-01`), Priest vs no Priest:

| | With Priest | Without Priest |
| --- | ---: | ---: |
| 40+ committed followers | 8 | 4 |
| Average Devotion | 37.21 | 34.83 |

For an illustrative **controlled adoption stress fixture** (6 initially unaffiliated adults, 4 weakly affiliated foreign adults with Devotion 29, and one committed foreign adult at Devotion 65), after 110 simulated days:

| Seed | New believers with Priest | New believers without Priest | Former rival believers who switched |
| --- | ---: | ---: | ---: |
| `valley-spring-01` | 10 | 5 | 4 |
| `calm-river` | 9 | 5 | 3 |
| `river-dawn-01` | 8 | 6 | 2 |

All three fixture seeds retained the committed Devotion-65 foreign affiliation unchanged. These are reproducible **fixture results**, not a prediction about arbitrary worlds or a guarantee of strictly monotone metrics under every randomized run.

## Simulation and save semantics

- Prayer summaries are `Religion × Settlement` aggregates over real open petition records, not individual sermon histories. A Priest has no raw Oracle reception rights and cannot conjure a new petition by rank.
- The social pulse remains low-frequency and uses the independent religion PRNG. No supernatural actions, inventory, births, or implicit faith bonuses are produced by selecting a bubble.
- Existing saves upgrade recognized legacy Priest join default `0.075` to the new `0.24` candidate parameter and fill missing Priest/rival metrics. All actual people, private and shared stock, stored prayers and history are preserved.
- No complete Church hierarchy, detailed mobility model, real rival God, multi-purpose Miracle catalog or Temple mechanics are introduced.

## Prayer source location in the Needs UI (2026-10-11)

Open petitions are now **click-to-locate**. The Needs inspector shows three compact request cards per page (with additional requests reachable through page controls), including petition type, source settlement, map coordinates and short reason. Clicking a card places a persistent crosshair at its actual recorded request evaluation center. **Food-water** petitions additionally show the 11-cell local-field evaluation radius as a dashed *reference* circle: this is not a guaranteed Rain cast footprint or an automatic cast.

A Priest's collected petitions use the **same original prayer IDs and centers**, not the Priest's current position. Clicking a Priest's prayer bubble opens the related petition and highlights its center; moving through the Priest's individual petitions updates the highlight. An answered/resolved/lapsed/deleted petition automatically releases the pin. The highlight is an ephemeral presentation selection, not saved authoritative World state, not a prayer requirement, and never spends DP or casts.

- Newly created founding-area food-water prayers record `center=s.camp`; legacy saves that omitted `center` resolve to that same historical evaluation anchor. Settlement-generated requests already carry their local settlement evaluation center.
- `prayerLocation(state, id)` is the one shared location interpretation API. `priestPetitions` exposes its derived `location` as an additional field, while preserving existing supporter counts, selection and local priest scope.
- Other settlement prayer types show the **settlement demand evaluation center**, not a claim of a precise injured person's current location or a guarantee that one Miracle reaches every petitioner. No continuous person-tracking or per-prayer map history is introduced.
- No world/faith/resource or balance formula changes are needed for this UI improvement. Bounded fixed-viewport layout, Miracle targeting confirmation, and Priest prayer autonomy remain unchanged.

## Acceptance

`npm test` runs `tests/priest.test.cjs` for authentic collective prayers, bubble removal after fulfillment, cross-Settlement localization, same-seed ablation, weak foreign faith response, stable foreign faith protection and save/restore determinism. Other economic / religious regressions must stay intact.
