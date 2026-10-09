# Religion, Saints, Priesthood, and Temples — v1

Status: **Issue #8 design converged (2026-10-09)**. Implementation and balance values remain open.
Primary references: [Issue #8](https://github.com/chlangjou/world-of-god/issues/8), [Faith #5](https://github.com/chlangjou/world-of-god/issues/5), [Oracle #6](https://github.com/chlangjou/world-of-god/issues/6), [Miracles #7](https://github.com/chlangjou/world-of-god/issues/7).
Spatial miracle rules: [DIVINE_PRESENCE_MIRACLES.md](DIVINE_PRESENCE_MIRACLES.md).

## 1. Identity and agency

- **God expresses intent; the world determines execution.** The player is a god, not an RTS commander; mortals autonomously recruit clergy, build shrines/temples, govern settlements, migrate, and fight.
- A Religion has a stable god attribution and begins with its **first believer**. Its existence does not require a temple, clergy hierarchy, or state sponsorship.
- Multiple top-level Religions may coexist, including within one Settlement or across hostile Polities. One Religion does **not** internally branch into persistent sects, schisms, or heresies in v1.
- Religion, priesthood, temples, and political organizations have distinct lifecycles. Loss of a temple or political sponsor does not delete surviving belief or prevent direct prayer.
- Religion may become dormant if followers vanish; a future Divine Spark may allow revival. Dormancy/revival specifics remain future design work.
- Mortal affiliations use the compact #5 person state (`religion_id?`, `devotion 0..100`, optional receptivity). Do not store extensive individual sermon/prayer histories.
- #5 rules remain authoritative: weighted divine contribution `0:1:2:4:8`; ordinary rival preaching does not readily overturn 40+ Devotion; evidence from attributed Miracle / fulfilled Oracle is the primary source of large durable Devotion changes; conversion rules and temporary Fervor / Low Morale follow #5.

## 2. Two-way divine communication

```text
God --Oracle--> Saint / Saintess (receiver) --> Priest / social propagation --> Believers
God <--direct Prayer---------------------------------------------------- Believers
God <--organized Collective Petition--------------- Ritual Priest <-- Believers
God --Miracle--> physical world --> observable outcomes and attributed evidence
```

- **Saint / Saintess** is a genuine Oracle Receiver. A receiver's divine qualification differs from mortal recognition, social influence, and organizational authority. A saint need not be a priest; one person may hold both roles.
- **Priest** is a religious/social role, not inherently an Oracle Receiver or exclusively a full-time occupation. A farmer may also preach or lead rituals; full-time religious work emerges only if time/resources/support permit.
- First Listener uses **Divine Spark / Genesis plus autonomous mortal response**, ensuring at least one viable reception path without letting the player directly select/control a citizen.
- Multiple Saints are permitted but **must not scale linearly with follower headcount**. More receivers can improve reach/reliability without guaranteeing obedience.
- **Succession = autonomous succession + minimum receiver continuity.** When a receiver disappears, viable followers seek successors. If all receivers are lost while the Religion remains viable, provide a fallback way for a new/temporary receiver to emerge; do not automatically grant that person influence, priest rank, or guaranteed compliance. A priestly appointment alone cannot confer genuine reception.
- The exact first-receiver selection/succession algorithm and receiver capacity belong to implementation / Issue #6.

### Prayer and collective petitions

- Every believer may **pray directly to God**, without Saint, Priest, or Temple. Prayer is heard independently of whether a Miracle can be cast at that location.
- Prayer comes from autonomous mortal needs (healing, rain, safety, peace, etc.). Miracles need not correspond to every prayer; responding is optional, not a forced quest or mandatory per-prayer service.
- A matching Miracle that *actually fulfills* a petition can sharply increase the petitioner's Devotion, with credible attribution. Witnesses may also be affected; raw events without clear attribution need not generate equivalent targeted Devotion.
- **Ritual Priests** organize prayer and consolidate related wishes by underlying need, locality, urgency, and potentially applicable Miracle, exposing a compact **Collective Petition** to God. They do not create free Divine Power, duplicate contributors, or grant automatic permanent Devotion.
- A collective petition is *information and coordination*, not an extra power resource. One correctly placed Miracle may satisfy many distinct petitions; only real fulfillment and observed evidence determine effects.
- Ordinary unfulfilled prayers should not automatically produce large persistent Devotion losses.
- Use short-lived personal requests and Religion × Settlement (or spatial region) aggregates; avoid permanent individual prayer histories.

## 3. Priestly emergence and functional specialization

Priests emerge autonomously from: **community religious demand + candidate suitability + social/resource support**. High Devotion makes candidature more plausible but never guarantees appointment or competence.

Functional tendencies, **not mandatory classes**:
- **Preaching Priest / Missionary:** attribution, teaching, spreading Oracle and Miracle accounts, cross-settlement transmission; does not force conversions or 40+ believers' erosion.
- **Ritual Priest / Caretaker:** communal rites, prayer collection, Collective Petitions, care and cohesion.
- **Organizer / Steward:** coordinate resources, train potential clergy, maintain institutions, negotiate with settlement or polity actors.

One person may perform several roles; saint and priest capabilities are orthogonal. Priests and institutions may disagree or interpret an Oracle locally, but do not create separate sect identities in v1. Deliberate covert infiltration, impersonation of rival priests, and hidden-subversion gameplay are excluded.

## 4. Shrine and Temple lifecycle

- A **Shrine** is a small, potentially informal place of ritual, memory or gathering. A **Temple** is a durable community religious activity center; neither is a prerequisite for religion, prayer, saintly reception, or priestly function.
- Buildings emerge from actual religious/social demand plus available labor, resources, land, and permission. **No direct player placement**, hard believer-count building thresholds, compulsory upgrade ladder, or guaranteed reconstruction.
- Temple functions are practical: coordinated rituals and Collective Petitions, reliable preaching, training and organization. They do **not** generate Divine Power or Divine Presence by merely existing.
- Lifecycle: proposal → construction → use/maintenance → decline or closure → disuse/ruin → possible reuse or rebuilding. Keep **physical condition** distinct from **religious activity**.
- Minimal v1 temple properties: `religion_id` (present religious use), `controller` (religious community / settlement / polity / person), `condition`, `activity`, and spatial footprint. Control may change through war, politics, or ordinary transfer; do **not** implement deeds, property markets, rent, title litigation, complex temple economics, or forced reallocations by faith share.
- **Temple Core footprints cannot overlap** other Temple Cores. Religious influence and different gods' Divine Presence **may overlap**. A Shrine need not claim Temple-sized exclusive territory.
- Destruction or occupation removes/impairs organizational functions, not devotees' personal Devotion. Surviving worshippers may pray elsewhere and autonomously build anew if conditions permit.

## 5. Religion and Polity

- Religion is cross-cutting and may span many Polities. A Polity may include several Religions.
- Early tribe/family leaders may simultaneously act as Saint, Priest and Chief. Political administration/command may later specialize as governance demands grow, **without a mandatory era-based transition to a secular state**.
- Theocratic governance, divinely legitimated kingship, cooperation, and institutional separation can be stable or reversible. Political independence from **Priesthood** is distinct from independence from **God**.
- God can intervene physically through Miracles, including punishment, **subject to local Divine Presence and Miracle capability**. Mortal rulers weigh credible divine intervention risk, not an unconditional global assassination power.
- Polity can sponsor/restrict clergy, temples and proselytizing; politics cannot directly set personal Devotion or forcibly turn every resident into a genuine high-Devotion believer.
- Military command, land ownership, occupations, migration and policy remain mortal autonomous decisions (Issue #9 / #4), not Oracle-executed RTS commands.

## 6. Religion competition and consequences

- No automatic moral immunity or guaranteed faction balance. Stronger gods may use eligible destructive Miracles against rival worshippers, Saints, Shrines or Temples; religious extinction is an allowed sandbox outcome.
- World consequences (death, migration, economy, political responses, organizational disruption) must emerge from world rules. Do not add artificial ethics penalties or instant conversion on temple capture, military victory, or priest death.
- The regional ability to cast high-tier/hostile Miracles is governed by local effective Devotion density **and** share of all gods' effective Presence; full contract is in [DIVINE_PRESENCE_MIRACLES.md](DIVINE_PRESENCE_MIRACLES.md).
- Local Presence derives from believers; Temple, clergy and Polity affect it only indirectly through believer activity/Devotion, not via mandatory additive territorial power.

## 7. Ownership, scalability and unresolved balance

- Individual owns affiliation/Devotion and personal agency. Religion owns religious role/institutional organization, Oracle attribution and petition aggregates. World supplies geography and physical outcomes; Polity owns its policies.
- Derived spatial influence may be cached in a grid/field instead of imposing religion fields on Settlement or borders. Keep cache distinct from authoritative people data.
- No fixed priest radius, temple buff, ritual cadence, priest staffing thresholds, receiver counts, building costs, or recruitment probabilities are finalized here.
- Issue #6 owns concrete Oracle representation, propagation and mortal calling pressure. Issue #7 owns Miracle catalog, tiers, costs, cooldowns and numerical spatial thresholds. Issue #9 owns detailed political decisions.
- This v1 design is a **specification**, not yet an implementation of these systems in `web-poc`.
