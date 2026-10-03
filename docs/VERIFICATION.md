# Pacing revision verification · 2026-10-03 UTC

**Current result: 35 automated tests passed, 0 failed** (21 core, 9 pacing, 5 UI contracts), plus syntax checks and the offline build. The historical report below records the prior 25-test release, not the current total. Real-browser QA remains blocked/unverified; no mock DOM result is claimed as browser QA.

Added coverage: exact UI defaults for all presets; two rains and rain+blessing; easy/normal/hard refill budgets; zero-faith 24s easy recovery and100 cap; repeated-click costs and non-witnessed rain; bounded/recoverable doubt and zero-faith clamp; old save compatibility;27 unattended 30-minute worlds and3 sustained 10-minute intervention loops. Detailed before/after measurements, rules and limits are in [PACING.md](PACING.md).

The original difficulty-order test now measures40 ticks before the100-power cap (180 ticks saturated the faster modes); the autonomous drought test observes292 ticks instead of232 because corrected meal consumption delays scarcity. These are intentional measured changes, not removed assertions.

---

# First playable verification · 2026-10-02

## Result

**25 automated checks passed** on Node 24.19.0. Standalone build passed. Real-browser visual and interaction QA remains **unverified** because the available browser environment blocked the local preview.

## Passed

- `npm test`: 21 simulation tests + 4 browser-independent UI contract tests, 25 passed / 0 failed.
- `npm run build`: creates the self-contained offline `World-of-God.html`, with no external script, CSS, fonts, images or runtime packages.
- `node --check core.js` and `node --check app.js`.
- Same seed / config / ticked input → byte-equivalent simulation state.
- JSON save/load continuation, including PRNG, active rain and staged oracle.
- All three terrain presets, 24 people, 8 households, 2 towns; long headless runs of 3,000 ticks per preset remain within numeric bounds and valid save shape.
- Difficulty variation changes only spendable-power accumulation, not world simulation.
- Rain moisture/cost, blessing growth/expiry, no direct food spawning.
- Oracle sequential stages, acceptance, deferral, refusal, completion and failure.
- Invalid targets, insufficient power and active-oracle repeat requests do not spend power.
- Zero-faith Divine Spark recovery; autonomous food pressure and drought.
- Bounded RAM history (80) and action log (120), monotonic event identity.
- Corrupt/hostile-shaped JSON validation returns errors without uncaught failure.
- UI event-binding harness covers Genesis, begin, rain, oracle, pause, save/load, custom settings, invalid-save handling and standalone resource isolation. This uses a lightweight simulated DOM/canvas, **not a browser engine**.
- Independent headless review separately exercised deterministic continuation, all oracle outcomes, three-preset long runs, difficulty isolation and zero-follower recovery.

## Bugs found and fixed during review

1. Two simultaneously visible divine signs could alternate `lastSign`, increasing the same person's faith repeatedly. Changed to monotonic event-ID processing; regression test verifies each sign is witnessed once.
2. Fractional map-edge rain input was accepted but failed save validation. Matched accepted coordinate bounds to stored state; regression added.
3. Malformed null entity entries could cause save-validation exceptions. Guarded entities and added corrupt-shape tests.
4. History archive view originally fetched every archived event into memory. Changed to a reverse cursor capped at 200; long-term history stays in IndexedDB.
5. JSON imports now get a new history branch to avoid overwriting a prior timeline.

## Actual browser QA: blocked, not passed

Attempted the installed Chromium through Playwright. The runtime rejected the browser's local socket operation, including a reviewed escalated attempt. The cloud browser then rejected `http://localhost:8000` (`ERR_BLOCKED_BY_CLIENT`) and disallowed the `file:` scheme. No access restriction was bypassed and no public deployment was created to work around it.

Consequently these remain unverified in a real browser:

- Visual composition, fonts, Canvas rendering and mobile responsive layout.
- Actual pointer/keyboard interaction and browser download behavior.
- IndexedDB write/read durability, localStorage quota handling and file-origin differences.
- Safari / Firefox / Edge compatibility, performance and accessibility beyond semantic labels/focus styles.

The app warns if persistent storage is unavailable, and offers JSON export/import. `README.md` includes an optional localhost workflow. These are implemented fallbacks, not claims of cross-browser verification.

## Provisional game-design limits

- Two settlements and households are pre-existing. Settlement emergence and S0→S1 progression are not simulated.
- Demography is fixed; residents do not die and health has a floor. No births, relationship simulation, politics, migration or construction.
- Weather follows a deterministic repeating schedule; ecology and economy are intentionally small.
- Household data represents membership and home positions, not a full domestic economy.
- Oracle consequences adjust individual assessment; institutional religion and interpretation networks are deferred.
- Full historical export, replay UI and version migration are deferred. Save export contains current state plus recent events only.
- Defaults are provisional inferred preferences: relaxed river-valley setting, 6/24 initial followers, nature-mediated miracles, agency and inspectable consequences. They are easy to change in Genesis.

## Suggested first human playtest

Open `World-of-God.html`, start the default river valley, cast rain on farmland, issue an oracle, advance at 3×, inspect its changing reasons, save, refresh, and confirm the same paused world resumes. Then export/import a JSON save and inspect the dry and island presets. Report whether the first intervention feels meaningful, whether people’s choices are readable, and whether waiting is interesting.

## Web PoC branch publication recheck · 2026-10-03 UTC

Re-ran `npm test` (25 passed, 0 failed), `npm run build`, and JavaScript syntax checks before publication to `web-poc`. This is the same experimental gameplay implementation as the delivered first-playable artifact, with branch-context documentation updates. The current main base includes `docs/POPULATION_MODEL.md`, preserved unchanged; its full demographic model is not implemented here. Real-browser QA remains blocked/unverified as described above.
