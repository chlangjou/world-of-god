# Religion Competition v0.3 — Miracle Evidence → Faith

**Status:** Experimental Web PoC v2 (2026-10-12). This layer extends the existing deterministic `src/sim.js`, without changing authoritative `main/docs/` specifications. Existing 20 / 40 devotion thresholds and the distinction between physical Miracles and received Oracles remain intact.

## Design: the God should break a stalemate by producing believable evidence

A Miracle changes the physical world first. Only an **observed, attributable, meaningful outcome** can produce faith evidence. The evidence is credited to the God who performed the action, not whichever religion the person previously followed. Both player and AI use the same code, probabilities, cooldowns, world measurements and existing person Devotion field.

| Action | Required real consequence | Direct recipient's own-faith increase | Other witnesses |
| --- | --- | --- | --- |
| Heal | At least 7 actual health points recovered in one cast | Base 19, scaled by amount healed (~17–25) | Base +3 nearby |
| Efficiency | An eligible blessed individual subsequently completes actual productive work (food, gather or construction); status without output does not count | Base +14, once per cast per worker | Base +2 near successful worker |
| Rain | A currently open local `food-water` petition, same God and region, followed by **moisture improvement > 0.08** and **>= 8 units of local Food labor** within 60 days | +12 to actual petitioners, once per petition | Base +3 near prayer center |
| Harvest | Actual positive increase in existing standing crop stock (no Food spontaneously delivered to inventory) | No direct personal credit | Base +2 near relevant fields |
| Ripening | Timed blessing causes >= 2.5 additional units of real crop growth over the non-blessed result (requires non-full crop stock) | No direct personal credit | Base +2 near relevant fields |

Rain without relevant prayers, minor scratches too small to matter, Efficiency cast with no productive use, unsuccessful crops and invalid/cooldown-blocked casts cannot manufacture the corresponding Faith credit. Natural weather or unrelated remote food production cannot fulfill a Rain request. A single rainstorm may legitimately answer distinct nearby requests if each has a separate real recipient group and satisfies the local criteria.

## Attribution and individual choice

- **Own followers** recognize their God and can gain Devotion immediately when the tangible consequence actually occurs.
- **Unaligned and opposing believers** need at least one nearby witness from the acting religion within the configured 11-cell attribution radius, ideally a Saint or Priest. The source is stronger when one of those roles is present; a nearby ordinary believer gives 72% attribution. Miracles with no identifiable religious source still heal or grow crops, but do not automatically recruit or undermine other religions.
- **Nearby witnesses** within a configurable 7-cell radius around a genuinely benefiting person or improved field get much smaller effects. Each group is evaluated once per outcome; many patients in one cast do not multiply the same witness's reward.
- **Rival affiliation remains personal:** attributable rival miracles may reduce even 40+ Devotion at 65% of the observed evidence. They do **not** cause an immediate allegiance swap. Ordinary Priest preaching still cannot erode 40+.
- **Unaligned / doubtful recipients** accumulate a compact, God-specific temporary `miracleInterest` score (90-day expiry). At a real seven-day religious decision pulse, significant interest (threshold 10) creates a bounded, receptivity-dependent opportunity to accept the faith. This is an exceptional personal evidence path, not a forced player command. Ordinary family/sermon influences still apply.
- Repeat bonuses from the same God, Miracle kind and recipient/witness role are damped for 28 days (direct 50%; witnesses 25%). There is no unbounded permanent history of each exposure; records are limited to God/type/role last-credit times.

## Oracle and prayer symmetry

The `religion.spread` Oracle still requires a real Saint receiver and real subsequent local preaching. Actual Oracle-influenced sermons now provide a modest separate recruitment opportunity, not merely a higher chance to spend time speaking. The prior first-mover bug has been repaired: **both Gods complete their weekly social religion pulses before shared sermon counters are cleared**. The original alternating update order remains.

The rival God also has its own non-UI prayer collection and regional needs state, retaining normal local economic and environmental prerequisites. Its Rain is evaluated against its **own** real prayer, and evidence is credited only to its religion; the player's prayer panel/fast-forward notification remains scoped to the player's followers. Pre-existing personal / regional player prayers and old saves are preserved.

The `checkFulfillment` food evidence is now tracked by its own local Settlement or founding-area labor account. This is accounting of **existing actual Food produced**, not extra Food, and avoids answering an AI village's request with the player's distant work.

## Playability and presentation

The History feed records actual major faith evidence; the resident inspector reveals the latest witnessed source and signed faith change, or a still-active God-specific interest in a faith before affiliation. Real opponent Miracle persuasion of an existing player believer produces a critical pause notice for accelerated playback; ordinary minor repeated witness influence is throttled to avoid constant interruptions.

## Tunables / compatibility

All parameters are in `config/religion-propagation-v0.1.json` as new optional numeric fields. The profile's original ID is retained for backward compatibility, even though this behavior is named Religion Competition v0.3. `restore()` normalizes absent values and opponent prayer fields without relocating people or regenerating resources. New-world v0.2 separated origins and optional older v0.1 mixed competition both remain supported. AI decision policy remains a simple fixed-interval heuristic (with injury-first triage and occasional Efficiency preference), not an optimized difficulty profile; the faith evidence rules themselves are symmetric.

## Tests and limitations

`tests/miracle-faith-evidence.test.cjs` contains eleven targeted cases for significant vs trivial Heal, nearby witnesses, conditional 40+ rival doubt, unaffiliated miracle interest, player alarms, productive Efficiency, physical Harvest and delayed Ripening, matched Rain (including AI), and deterministic save/replay. Existing religion/priest/divine/opponent/native-world regressions continue to apply.

Deferred: richer long-range missionary travel; nuanced recognition of which deity caused an unheralded miracle; multi-God claims over the same answered request; Temple rituals; prayer UI for the AI itself; explicit confidence overlays / Religion×Region Fervor; full AI difficulty profiles and formal browser usability playtesting. No `Miracle: cast` command changes Faith merely because the player pressed a button.
