# Religion Propagation v0.1 — Web PoC v2

**Status:** Experimental; `main/docs/` is the authority ([Religion](../../../docs/RELIGION_PRIESTHOOD_TEMPLE.md), [Oracle](../../../docs/ORACLE_DIVINE_CALLING.md), [Faith](../../../docs/FAITH_RELIGION_ORACLE_DRAFT.md)).

## Implemented causal chain

- Each living Individual owns affiliation (`religionId`) and Devotion. A low-frequency weekly pulse evaluates in-world contacts: co-resident believers, **actual recent leisure-time preaching** by an ordinary adult or Priest, and bounded exchange between nearby already-inhabited Settlements. Nobody is assigned a conversion quota.
- Adults sometimes preach during the non-work social phase; Priests do so more often. Priests can form autonomously in a Settlement with real local believers, suitable adults and houses. A Priest is a social role, **not** an Oracle Receiver or a compulsory full-time job.
- **Childhood formation differs from ordinary preaching.** Newborns start unaffiliated at Devotion 10. From age 4, they may take up their co-resident parents/guardians' beliefs. Over years, strongly committed family example can create moderate committed belief (up to Devotion **55** when both guardians have 80+); it never directly clones the parents' 80–100. Ordinary adult preaching and recurring local religious life can gradually pass **40** into ordinary committed belief, then slow and cap at a tunable **60**; it does not create 80–100 Devout/Zealot devotion. Major durable jumps still primarily require attributed Miracle/Oracle evidence.
- Migration preserves actual affiliation. Settlement religious status is derived from actual residents, never from a free settlement buff. Nearby Settlements with recent preaching believers can exchange limited social contact; this is an abstract interaction, **not** an invisible missionary teleport.
- **Oracle:** only an eligible Saint receives directly; after the local initial transmission, a Priest or ordinary social links may relay a still-active Oracle to an adjacent connected Settlement. Only believers at the received locations can apply the Oracle as autonomous decision pressure. Saint quotas, type locks, duration, death and global Divine Power remain unchanged. More than one qualifying Saint may emerge in large multi-settlement worlds, without scaling linearly with headcount.
- The fixed-viewport Web UI shows both 20+ 信眾 and 40+ 信徒, per-Settlement Priest/Saint and active Oracle counts, and offers selection of an eligible Saint when sending/concluding an Oracle. History records major first arrivals and cross-settlement relay, not every sermon.

## v0.1 commitment calibration (2026-10-11)

The experimental PoC keeps **40** as the committed-follower / Divine Power weighting boundary, but removes the previous hard **39** ceiling for social consolidation. With observable real gods, a resident repeatedly exposed to a stable religious community should be able to cross 40 without a separate player-cast Miracle for every person. Baseline tuning is `weakLearningChance=0.26`, `ordinaryConsolidationCap=60` and a slower growth probability above 40. There is **no automatic Devotion decay** in this single-religion slice; believable rival competition is the planned primary source of durable erosion. The exact tuning is provisional; this PoC-level adjustment does not silently rewrite the historical official Faith checkpoint in `main/docs/`.

## Configuration / compatibility

`config/religion-propagation-v0.1.json` contains editable experimental rates (not full sociological balance). The kernel maintains normalized fallbacks for old `mvp0-web-2` saves and an independent seeded religion RNG so ordinary preaching does not consume the agriculture/demography random sequence. Restore preserves actual people, previous Faith, Miracle, DP, crops and inventory; no world reset is required. Both JSON profiles are embedded by the optional standalone exporter.

## Deferred

Full rival faith competition/conversion, Temple/Shrine building, travelling missionary pathfinding, formal religious hierarchy, war/polity rules, spatial hostile Miracle eligibility, Fervor, and complete Oracle radius-batch interface. This is a minimal playable propagation loop, not a full religion simulation.

## Tests

`npm test` includes a distinct `religion.test.cjs` covering non-work preaching, family faith formation, no ex nihilo conversions, adult 40+ stability, priest autonomy, connected/disconnected Oracle relay, old-save upgrades and deterministic replay. `npm run smoke` and `npm run check:agriculture` remain the baseline regressions.
