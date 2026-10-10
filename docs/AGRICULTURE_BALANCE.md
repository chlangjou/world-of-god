# World of God — Agriculture Balance Formula & Verification v0.1

**Status:** Agriculture v0.1 is now an **optional experimental Web PoC runtime profile** on `web-mvp-0`; Original remains selectable. The historical formula and micro-model results below are calibration references, not runtime outcome guarantees. Authoritative God–World rules on `main` are unchanged.

**Source snapshot:** `chlangjou/world-of-god` / `web-mvp-0`, commit `c57d8268f2f9283799aaf6ff2bade9101b43b440`, `sim.js` Git blob SHA `52b73c277b1a6111fa787374aeb5d300747d2e9f` (identical to the v0.2.1 local archive). The actual world generator and farmland locations/fertility were used. Workers may reach a tile if it lies within ±9 cells of **at least one initial household**; does not simulate later relocations.

## Profile ownership and how to reproduce

- `config/balance-default.json` is a **read-only snapshot** of the current game `sim.js` defaults; it is not loaded by the game.
- `config/balance-agriculture-v0.1.json` contains the **active optional** Agriculture parameters. The browser loads it when Agriculture is selected; `npm run build` embeds the same JSON for the standalone HTML.
- This report compares equilibrium capacity against season-transition microtests using those profile assumptions, not a completed integration or a promise of identical player behavior.
- `node tools/agriculture-balance-check.mjs --check` reproduces map-based capacity and 40-seed checks from `sim.js` map generation.
- `node tools/agriculture-climate-check.mjs --check` checks soil-response lag and crop-stock conservation in a separate bounded micro-model.
- The Web PoC uses the original production model unless Agriculture is selected; the Agriculture route uses seasonal river moisture, explicit per-field crop stock, bounded harvesting and actual-workday skill progression. Climate windows and crop-stock cap are provisional JSON parameters.

**Interpretation:** the 10–20% normal food-labor goal counts **work-capable equivalent full workdays** (not total residents), while rainy 6–8% and drought 40–50% are season-level diagnostic choices rather than enforced jobs. Expected season coverage depends on available plots and may be below target in some worlds.

## 1. Fixed test population

- 40 total residents: **16 work-capable adults** (each requires 0.38 Food/day), **24 dependents** (0.25 Food/day).
- Total daily demand: `D = 16 * 0.38 + 24 * 0.25 = 12.08 Food/day`.
- Farm-worker shares refer to **work-capable adult-equivalent working days**, not total residents or an enforced assignment quota. E.g., 8% of 16 adults = 1.28 adult workdays/day averaged across time.
- For comparison: with 24 adults and 16 dependents, food demand is 13.12/day. If a single fixed plot set must feed 60 residents (36 adults, 24 dependents), the demand is 19.68/day; existing 118 plots cannot support that level outside favorable conditions. Plot/settlement expansion is a later scaling issue.

## 2. Spatial and seasonal moisture formula

River distance `d` is measured from the **river bank** (the game marks river approximately where `abs(x-riverX(y)) < 1.6`), not the centerline. For the candidate influence curve:

```
I(d) = 0.95                                      for d ≤ 5
     = 0.95 * (15 - d) / 10                     for 5 < d < 15
     = 0                                         for d ≥ 15

M(d,s) = clamp01( B[s] + (1 - B[s]) * I(d) * A[s] )
```

| Season | Background B | River water availability A | Interpretation |
|---|---:|---:|---|
| Rainy | 0.76 | 1.00 | Wide wet area; high productive potential |
| Ordinary | 0.46 | 0.54 | Moderate river benefit |
| Drought | 0.12 | 0.40 | River still helps but cannot eliminate drought |

The formula gives a *target moisture*, not an instruction to overwrite soil state at every tick. In a dynamic game, moisture should relax over time and accept extra Rain/Drought effects.

## 3. Land regeneration, working skill and harvest capacity

For tile `i` with fertility `F_i` and moisture `M_i`:

```
landDaily_i  = q * F_i * (M_i / 0.90)^0.8
landDaily    = sum_i landDaily_i

H             = sum_i ( F_i * (M_i / 0.90)^3 ) / sum_i F_i
skillFactor(S)= 0.6 + 0.8*S
workerDaily   = 9.5 * skillFactor(S) * H
laborDaily    = activeAdultWorkdays * workerDaily

foodProducedDaily = min(landDaily, laborDaily)
supplyRatio = foodProducedDaily / dailyNeed
```

**Recommended candidate:** `q=0.20` units/tile/day at 90% moisture and full fertility. The previous candidate `q=0.2113` matches one 118-tile map, but overshoots when testing more map seeds. The worker model is a *coarse area-based workday*, not one tile per worker per day. A future implementation must preserve actual tile crop-stock and inventory conservation: harvested output cannot exceed accumulated unharvested growth.

Skill model:

```
S(workdays) = 1 - (1 - 0.45) * exp(-workdays/550)
```

This is **actual agricultural workdays**, not years merely elapsed in the world. Skill increases from 45% to 71.4% after 360 farm workdays, 85.2% after 720 and 92.3% after 1,080. A person farming only 20% of calendar days will reach **62.9%** after 1,080 calendar days; reaching 92.3% in about three years requires a substantially dedicated farmer. The base skill effect at 45% is 0.96× and at 92.3% is ~1.338×.

## 4. Calculation results using real map seed `calm-river`

Its current generator creates **118 reachable crop tiles**, mean fertility **0.7095**.

| Season | Average target moisture | Land sustainable capacity | Land capacity / 40-person need | Worker output/shift at 45% skill | Worker output/shift at 92.3% skill |
|---|---:|---:|---:|---:|---:|
| Rain | 93.8% | 17.37 | 143.8% | 10.65 | 14.84 |
| Ordinary | 67.6% | 13.39 | 110.9% | 4.14 | 5.78 |
| Drought | 38.1% | 8.48 | 70.2% | 0.87 | 1.21 |

Test labor shares for mature (~92.3%) agricultural specialists (actual supply limited by **both** land and labor):

| Season | Adult labor allocated to food | Daily food | Supply / need | Interpretation |
|---|---:|---:|---:|---|
| Rain | 6% | 14.25 | 118% | Enough to eat; smaller reserve gain |
| Rain | 8% | 17.37 | 144% | Approaches rainy land ceiling |
| Ordinary | 10% | 9.24 | 76% | Too few workers |
| Ordinary | 15% | 13.39 | 111% | Meets need, modest reserve |
| Ordinary | 20% | 13.39 | 111% | More workers cannot exceed land ceiling |
| Drought | 40% | 7.73 | 64% | Must use reserves |
| Drought | 50% | 8.48 | 70% | Land caps output; more labor cannot solve drought |

In the same map at **45% starting skill**, ordinary-season break-even labor is about **18.2%** of work-capable adults. With 92.3%-skill specialists, break-even is about **13.1%**. Thus the intended **10–20%** normal band is plausible without enforcing jobs, assuming suitable weather and specialization.

## 5. Map-to-map variation (same settings)

All four named test seeds match the generation rules exactly:

| Seed | Reachable crop tiles | Rain land coverage | Ordinary land coverage | Drought land coverage |
|---|---:|---:|---:|---:|
| `calm-river` | 118 | 143.8% | 110.9% | 70.2% |
| `valley-spring-01` | 112 | 138.5% | 107.8% | 70.2% |
| `river-dawn-01` | 133 | 157.6% | 121.1% | 76.0% |
| `test-seed` | 134 | 160.7% | 124.2% | 79.3% |

Across **40 additional seeded maps**, with identical fixed parameters and 40-person demand, average potential land coverage is approximately **151% Rain / 117% Ordinary / 74% Drought**. Ranges (min–max) are approximately **128–170% / 99–131% / 63–84%**. Variation mostly comes from the generator creating 107–142 reachable farm tiles and their local fertility/distances. The 150% / 115% / 60–80% targets should be interpreted as **scenario-level reference values or averages**, **not** hard guarantees for every random seed.

Moving the river-effect cutoff from 10 to 20 cells changes land capacity modestly when farm plots cluster near the river; for `calm-river` with the earlier `q=0.2113` candidate, rainy capacity shifts ~149% to ~154%, ordinary ~113% to ~120%, drought ~69% to ~78%. A 5-cell 95% plateau and 15-cell cutoff remain reasonable, but **moisture response over time** matters much more for short rainy spells.

## 6. Micro-test: short seasons, crop-stock conservation and lag

To ensure the equilibrium formula is not mistaken for actual day-by-day yield, a **separate small deterministic accumulator** was tested with per-tile crop stocks:

- Soils approach seasonal target exponentially with time constant `τ` days.
- Each plot generates `landDaily_i` daily; unharvested crop stock is capped at **two days of the best-season regeneration** (deliberate test assumption, not an agreed game setting).
- Workers harvest no more than available crop stock or labor capacity; exact mass balance is asserted (generation = harvest + leftover stock + discarded overflow, accounting for initial stock).
- Existing Web PoC weather rhythm has only **21 rainy / 123 ordinary / 16 drought days per 160-day cycle**, with Rain arriving in short 6–8-day spells.

With `q=0.20`, mature specialists and shares **8% Rain / 15% Ordinary / 50% Drought**:

| Soil response τ | Rain realized output / need | Ordinary | Drought |
|---|---:|---:|---:|
| 1 day | 142.7% | 110.9% | 71.8% |
| 3 days | 114.8% | 114.4% | 77.2% |
| 5 days | 94.2% | 116.1% | 83.0% |

**Crucial limitation:** 150% rainy *equilibrium potential* is not 150% realized output in a six-day rainfall spell if soil wetting and crop availability lag. For a longer **40-day rainy / 100-day ordinary / 20-day drought** hypothetical pattern with `τ=3`, realized shares become approximately **137.8% / 111.7% / 75.5%**. Both patterns are exploratory and not yet agreed seasonal pacing.

Mass-balance error was less than floating-point tolerance; no food was created by harvesting more than a plot's existing crop stock. Under *fixed* 8%/15%/50% labor shares the model also shows a substantial net annual surplus; therefore actual gameplay should let labor decrease when reserves are ample, and later add appropriate storage loss/capacity. Do not force population percentages as job quotas.

## 7. Candidate and remaining implementation checks

**Suggested first candidate:** 5-cell river plateau at 95%, linearly declining to zero at 15 cells measured from bank; seasonal (B,A) = (0.76,1.00), (0.46,0.54), (0.12,0.40); land coefficient **q=0.20**, land moisture power **0.8**; worker-at-50%-skill baseline **9.5** units per full food workday and worker moisture power **3**; learning `S=1-(1-S0) exp(-workdays/550)` with starting S0 ~0.4–0.5.

1. **Use formula as a reference and regression oracle, not production output code that magically fabricates inventory.** A real implementation must represent replenishment in crop state and harvesting as an actual transfer.
2. **Decide seasonal cadence and soil-response τ** before expecting the same rainy/drought percentages in the interactive game. Keep Rain Miracle a distinct event-driven addition to physical moisture; avoid overwriting its effect with the climate target.
3. **Validate specialization and time allocation:** the same 1–3 people may become expert food workers over years. 10–20% is a fraction of adult-equivalent work time, not proof that every resident reaches 92% skill.
4. **Revisit land-to-population scaling** when the settlement exceeds ~40 residents, because this fixed plot group cannot sustainably feed ~60 without more usable farmland or other food sources.
5. **Use short microtests first**, then a small headless game regression after integration; a full 2,200-day playthrough is not the first calibration tool.

**Verification commands:**

```sh
node tools/agriculture-balance-check.mjs --check
node tools/agriculture-climate-check.mjs --check
node tools/agriculture-balance-check.mjs --json   # machine-readable analysis
npm test  # game regression suite (run independently; no game logic changes)
```

The historical numbers in this report were generated using the analytical scripts. The selectable runtime profile now exists on `web-mvp-0`; validate actual gameplay separately via seeded no-Miracle runs and the Web PoC.
