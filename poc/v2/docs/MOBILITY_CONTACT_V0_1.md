# Physical Contact, Scarce Resources & Missionary Oracle — PoC v0.2

**Status:** experimental. Target branch: `feature/opponent-difficulty-profiles-v0.3`; no changes to `main`.

## Contact and resource travel

- Physical encounter radius **5 map cells** (formerly 3). Contacts are recorded only when actual walkers overlap in space at the **same sampled tick moment**. Full evidence includes two people, faith snapshots, original settlement IDs, hour, coordinate, and separation. One pair is recorded no more than once per simulated day.
- Movement is still bounded cardinal-step walking (including mapped fords), not remote sermon teleportation. Residence stays at the original household. The generic contact log is shared by social, religious and future trade mechanisms.
- New mobility worlds place **six infinite stone quarries and two infinite gold deposits** at deterministic, sparse map locations. Common scattered stone in traversable terrain is disabled for these new worlds. The quarry may supply construction stone; gold is stored with the household/settlement but has **no trade or currency mechanic yet**.
- Resource visits consume real time, actual transport and deposit only on return; ordinary food production retains its previous balance. Special deposits require a longer stay (`specialOnsiteTicks=6`) and make camping meaningful.
- `config/mobility-contact-v0.1.json` holds the tunable encounter radius, trip rates, node counts, campsite durations, missionary rates and injury risk.

## Camping accident & Heal

A long rare-resource visit checks one independently hashed roll **once per trip** (nominal chance 12%, configurable), with **45 days injury cooldown** and no repeat hit before recovery. Health loss is 10–18 points with a 60-point health floor: the accident itself is nonfatal. Baseline daily hunger/health still works as previously; critical starvation remains a separate concern.

`campInjury` records its time, damage and location. At health 95 or more the injury is marked recovered; an ordinary Heal can restore health and clear the visual warning. The map displays a **red cross** above injured residents independently of faith/priest colors; the resident inspector displays the injury, current health, and Heal hint.

## Priest long-distance missions & Oracle identity

Priests may voluntarily visit actual populated foreign/neutral settlements, respecting their home's residence and path availability.

| Priest condition | Chance to depart on a work-day, when eligible |
|---|---:|
| Without Spread Oracle | 10% |
| With locally received active `religion.spread` Oracle | 65% |

A missionary remains at the destination for nine 8-hour ticks. A real encounter can be followed up by local preaching; the Spread Oracle adds a configurable **1.4×** Priest recruitment factor only for low-devotion or unaffiliated people who actually met the preacher. Issuing an Oracle without outcomes never changes faith. A 40+ committed rival is never directly shaken by regular speech: a Spread-based *core challenge* requires physical contact, a Priest, at least three recorded sermons, and **at least one previously verified voluntary recruit** attributable to that Oracle.

## Defense matrix

Defensive multiplier = row (receiving faith doctrine) versus column (credible challenger). No passive Devotion changes.

| Defender \ challenger | Default | Food | Nurture | Explore | Spread |
|---|---:|---:|---:|---:|---:|
| Default | 1 | 0.8 | 0.8 | 0.8 | 0.8 |
| Food | 1.2 | 1 | 0.4 | 1.6 | 0.6 |
| Nurture | 1.2 | 1.6 | 1 | 0.4 | 0.6 |
| Explore | 1.2 | 0.4 | 1.6 | 1 | 0.6 |
| Spread | 1.2 | 1.4 | 1.4 | 1.4 | 1 |

Only new `oracle-specialization-v0.1.json` with `spreadMatrixEnabled=true` applies Spread as a fifth doctrine. Existing saves without the flag keep their historical Spread-as-Default interpretation, as well as prior belief and resources.

## Test strategy (GitHub CI budget)

- Push: `.github/workflows/mobility-fast.yml`, targeted syntax + `npm run test:fast` + standalone bundle equality check. The fixed controls include 5-cell contact, perpetual deposits, camping injury one-shot/repeat guards, Heal, matrix ratios, missionary trips, save replay and legacy-save behavior.
- Manual only: historical eight-minute `oracle-specialization.yml` full suite and multi-seed 60–130 day evaluations. Do not run full long simulation for every trivial code change.
- Local targeted run: `cd poc/v2 && npm run test:fast`.
- Success means the moving people can actually meet, travel and be healed; **not** that core conversion rates, trading or final balance are solved.

## Compatibility

Existing saves with no mobility record remain on the previous disabled model. Worlds already saved under the earlier movement prototype retain their old resource map when restored; fixed quarries and gold spawn in **new** mobility worlds only. No role or religion is forcibly assigned during migration.
