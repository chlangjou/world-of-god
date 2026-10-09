# Oracle and Divine Calling — v1 Contract

Status: **Issue #6 design converged (2026-10-09)**. This is the authoritative Oracle v1 design; balance and implementation details remain tunable.
Related: [Religion / Priesthood / Temple v1](RELIGION_PRIESTHOOD_TEMPLE.md), [Faith checkpoint](FAITH_RELIGION_ORACLE_DRAFT.md), [Simulation architecture](SIMULATION_ARCHITECTURE.md), [Core gameplay loop](GAMEPLAY_LOOP.md), [Issue #6](https://github.com/chlangjou/world-of-god/issues/6).

> **God expresses intent; world determines execution.**
>
> Oracle can strongly influence willing, highly devoted mortals. "Avoiding RTS" is a design direction, **not** an artificial obedience penalty. The stable invariant is that an Oracle supplies motive/pressure; it never directly mutates mundane actions or overrides feasibility.

## 1. Distinct concerns: divine reception, social propagation, worldly decisions

```text
God issues an intent
  └─ directly to Saint/Saintess only (single Saint or Saints in radius)
       └─ Saint understands core intent reliably; chooses local interpretation
            └─ Saint / Priest / social network communicates to people
                 └─ individuals / households / settlements / polities decide and act
                      └─ world outcomes; possible religious attribution
```

- A **Saint / Saintess** is the *only* direct receiver of Oracle. Divine reception and core understanding are reliable for an eligible addressed Saint; interpretation of methods varies with local knowledge and circumstances. Saint qualification is distinct from priestly rank, public prestige and political authority. A Saint may also preach without a Priest.
- **Priests** preach, repeat, organize and interpret in social context; they cannot themselves receive a new raw Oracle by virtue of office. Informal social travel/transmission is allowed.
- **Prayer** still goes from believers directly to God without Saints/Temples; Ritual Priests may aggregate petitions. Prayer is a different channel.
- More Saints create more independently located receiving/propagation origins, **not** a compulsory performance multiplier or automatic compliance. Saints arise and succeed according to #8; no direct God-controlled relocation/appointment of citizens.

## 2. Addressing and targeting are separate

- **Single:** God chooses one eligible Saint to receive one intent.
- **Radius:** God specifies a center/radius, selecting all eligible Saints of that God currently in the area. **Radius is only a batch convenience**, not a persistent area-of-effect, common Oracle, or shared lifecycle. Each Saint receives an **independent Oracle assignment** with its own identity, expiry, quota charge and lock. A batch/provenance identifier may connect the UI action without coupling lifecycles.
- Saints outside the selected reception scope get no direct notification. They may later hear the news socially; that is **not** direct reception and spends no quota.
- Different Saints may receive different intents; nearby Saints may independently receive the same or contradictory intents.
- Intended audience is separate from receiver selection: **named calling** (God proposes a particular person) and **open calling** (community identifies volunteers/leader) share the same Oracle mechanism. Public/settlement/religion missions differ only in intended audience and downstream decision domain.
- Each God addresses its **own Saints**. Religious Calling/Fervor from that God does not directly control or award the rival God's followers. Shared-world consequences, witnessed evidence and ordinary conversion dynamics may still affect people across religions.

## 3. Per-Saint reception quota and active-type lock

Each living Saint has an independent replenishing reception quota. First-pass tunable defaults:

| Setting | v1 first-pass value | Rule |
| --- | --- | --- |
| `quotaCapacity` | 4 | Upper bound per Saint |
| `quotaInitial` | 4 | Initial quota at activation |
| `quotaRefillPeriod` | 3 simulated months | Each elapsed period regenerates 1, up to the cap |
| `issueCost` | 1 | Each successfully issued Saint assignment costs 1 |
| `conclusionCost` | 1 | God declaring the purpose achieved and ending **one Saint's assignment** costs 1 |
| `cancelOverdraftFloor` | -1 | Conclusion may temporarily take quota from 0 to -1, but not below |
| `intentTypeLock` | on | A Saint cannot hold two concurrently active assignments of the same canonical intent type |

- Ordinary issuance requires available quota **>= 1**. A conclusion is allowed when resulting balance stays **>= -1**; at -1 further cancellation/issuance must wait for refill. Natural expiry or Saint death costs nothing.
- The 3-month period uses **simulation time**, not real time; pause, fast-forward, save/reload preserve meaning. Refill does not require a rolling annual event history.
- Canonical intent **type** is structured (e.g. `food.reserve`, `population.grow`) rather than the exact display wording. The lock is **per Saint**, not per God, region, follower, religion or Priest. No target-population lock and no cross-Saint coordination are needed.
- Different types can coexist even when they compete. Same-type Oracles **on different Saints** are allowed, even in the same settlement. Different Gods do not share locks.
- A radius batch evaluates each Saint independently; insufficient quota/type lock blocks only that Saint's assignment, not the rest. The UI should show which recipients succeeded or were blocked.
- Repeated issuance after conclusion is still subject to quota and bounded, saturating Fervor; ending/reissuing is **not** a fresh unlimited Divine Power bonus.

## 4. Per-Saint Oracle lifecycle

```text
issued -> received/active -> propagated / understood / acted on (parallel, non-global)
                          \-> expired (deadline)
                          \-> concluded (God declares purpose achieved; quota cost)
                          \-> terminated (owning Saint dies; automatic, no quota cost)
```

- **Only these three events end an assignment:** its configured deadline, God declaring its purpose achieved, or **death of its owning Saint**. Successful mundane outcomes alone do not auto-end it. Other Oracle assignments never silently replace/cancel it.
- Initial duration is **intent-appropriate** (quarters, seasons, years or a meaningful forecast horizon). Player can adjust time scale when needed. Long duration means continued relevance, **not** permanently maximum influence. Expiry and influence decline remain separate concepts. Later recipients inherit **remaining** validity, not a restarted clock.
- Faith/Calling attention should often have an initial sustained period followed by **slow fading on seasonal/annual scales**; Priest sermons maintain awareness subject to saturation and cannot extend a divine deadline. Exact curves are configurable.
- A conclusion terminates the addressed Saint assignment only; simultaneous radius assignments remain independent unless God explicitly concludes each of them (and pays each receiver's conclusion cost).
- **Saint death:** immediately terminate *all* active Oracles owned by that Saint. Priests stop promoting those Oracles; any temporary Calling attributable solely to them may be dropped and residents may directly forget them without complex notification logistics. Do **not** transfer them to a successor. If other Saints independently carry equivalent Oracles, those continue.
- Expiry/conclusion/death stops religious pressure, **not world time or causality**. Completed construction, relationships, births, political decisions and sensible ongoing work remain, subject to fresh ordinary world decisions. Past durable Devotion changes backed by actual evidence are not automatically reverted.

## 5. Overlap, competition and mortal agency

- Two active Oracles never auto-cancel because their intents conflict. Mortals who encounter them weigh their pressures alongside actual needs, danger, skills, time, social support and current constraints. Religion does not assign an occupation, force a march, set production, force reproduction or decide a war directly.
- **Feasibility first:** impossible actions or missing indispensable resources cannot be willed into reality. For remaining plausible actions, personal/household needs and circumstances usually dominate, but **high Devotion may create very strong willing compliance and accepted sacrifice**. Do not introduce special "anti-RTS" friction solely to reduce obedience.
- When an Oracle aligns with what people already need or want, it can be more effective **without** an artificial additional compliance bonus. Social/religious organizations can improve real prerequisites (food, logistics, family support), enabling further willing participation.
- For a named calling, the named person chooses acceptance; others choose whether to follow or support. For an open calling, society identifies candidates autonomously. Responses can be partial; executing the requested activity does not guarantee the desired world outcome.

## 6. Oracle Resonance, temporary Fervor and Divine Power

- **Oracle Resonance** is a context-dependent match of an understood intent with real mortal needs/wishes, **not** a permanent per-person attribute.
- Matching desire and believable divine origin can create **temporary Faith Boost / Fervor** and stronger participation before any Miracle or completed outcome. Existing Devotion partially increases religious receptiveness; an action can still appeal to an unbeliever for secular reasons.
- **Temporary Fervor is not permanent Devotion.** It may produce a limited, declining, **non-additively stacked** bonus to Divine Power generation. Significant durable Devotion changes normally depend on real fulfillment/contradiction and credible attribution. A clearly answered personal prayer may support a small durable shift with credible evidence, not automatic permanent conversion.
- Base effective Devotion contribution weights remain **0:1:2:4:8** (#5). Apply any Fervor generation bonus to the existing contribution for the *relevant religion/region*, sum into the existing **global Divine Power pool**. Do not mint local spendable pools; do not modify Local Divine Presence/density/dominance or bypass #7 spatial Miracle gates.
- Multiple Saints and repeated preaching may improve reach/attention, but must not act as linear bonus generators. A bounded, saturated Religion × Region Fervor effect suffices; **no separate follower lock, per-person repetition ledger or cross-Saint lock** is necessary.
- Concluding and reissuing, or overlapping equivalent messages, cannot reset existing Fervor to an unlimited full award. Exact cap, decay and dedup/saturation policy are balance parameters rather than new identity locks on believers.

## 7. Memory, ownership and performance

- Religion manages Oracle attribution, the active per-Saint assignments and compact local propagation/Fervor aggregates. Individual owns religious affiliation, Devotion and decisions; Household/Settlement/Polity own their respective world choices.
- Avoid unconditionally storing individual histories of every sermon, Oracle, emotion or faith boost. Use active Oracle state, Religion × Region/Settlement summaries and current person/household conditions; retain a small temporary person state only if it genuinely changes outcomes.
- Do not update every living individual every frame when an Oracle is received. Decision-time or event-driven evaluation with bounded aggregate state is preferred.
- Keep significant completed/failed/misinterpreted outcomes and useful causality in History; discard trivial repeated exposure. Evidence attribution should reflect actual causal/semantic ties, not temporal coincidence.
- Conceptual assignment data: `oracleId`, `godId`, `saintId`, `intentType`, `intentPayload`, `audiencePredicate`, `issuedAt`, `expiresAt`, `status`, optional `batchId` and bounded local interpretation/propagation references. This is **not a frozen storage schema**. No mandatory list of affected follower IDs.

## 8. Tunable parameters and ownership boundaries

Parameterize independently: quota capacity/initial/refill/cost/overdraft, type categorization, duration preset and player-adjustable limits, attention hold/decay curve, sermon effectiveness and saturation, resonance sensitivity, temporary Fervor cap/decay, bounded DP-generation bonus and global cap. Difficulty may select profile values, **not change who owns mortal decisions**.

- #6 owns divine delivery, per-Saint quota/lock/lifecycle, religious transmission contract, and Calling input into decision making.
- #4 owns economic feasibility/occupation choices; #9 owns governance, policy and war decisions.
- #5 owns the base Devotion/Divine Power economy and durable faith adjustment; #7 owns Miracle physical effects, costs, cooldown and spatial eligibility.
- This is a **design specification**, not a claim that `web-poc` already implements these features.

## 9. Acceptance / regression scenarios

1. A single addressed Saint with 1 quota receives one Oracle; a Saint outside radius receives none. Radius containing three Saints creates **three independent assignments** with separate quota/locks/expiry.
2. Same type to same Saint while active is blocked. Same type to adjacent Saint succeeds. Another type to original Saint is allowed if quota permits. Rival God's Saint is not an eligible direct receiver.
3. Each 3 simulated months add 1 quota up to 4. Issue at 0 is rejected; conclude at 0 reaches -1; conclude again at -1 is rejected; refill to 0 still does not permit new issuance until >=1.
4. Conclusion of Saint A's Oracle does not conclude the equal-content Oracle on Saint B. Ordinary expiry spends zero quota. Mundane success by itself does not expire/auto-conclude an Oracle.
5. Death of Saint A immediately terminates all A's active Oracles, halts Priest promotion of A's assignments and removes their temporary pressure without erasing mundane outcomes or valid Oracle assignments owned by other Saints. Successor does not inherit A's assignments.
6. Two different types giving conflicting pressure may coexist and be heard by the same resident. A highly devoted, capable and well-supplied resident may readily obey; an underfed resident cannot perform a resource-impossible expedition. No special anti-RTS obedience limiter.
7. Oracle aligned to local need raises bounded temporary Fervor but not automatic permanent Devotion. Multiple nearby Saints/sermons cannot linearly stack Divine Power, and a reissue cannot infinitely reset the bonus.
8. Duration/decay, quota and boost values change through ruleset parameters without changing assignment ownership. Pausing, speeding and saving preserve simulated-time semantics and deterministic replay within a supported ruleset.
