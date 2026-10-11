# World of God — PoC v2 development guidance

This folder is the **experimental browser PoC**, not the authoritative design spec.
Before changing mechanics, consult `../../docs/CORE_PRINCIPLES.md`,
`../../docs/POPULATION_MODEL.md` and `docs/ARCHITECTURE.md`.

- Keep changes within `poc/v2/` for Web experiments. Do not silently modify
  `main` formal specifications, the Godot project, or root-level Web MVP-0.
- Maintain separate source files: HTML, `src/sim.js`, `src/app.js`,
  `assets/`, editable `config/`, `docs/`, `tests/`, and `tools/`.
- **Never edit or commit `dist/`**; it is an optional generated artifact.
- `src/sim.js` is authoritative for simulation state and must be DOM-free.
  `src/app.js` only handles rendering, input, saves and runtime profile loading.
- Put experimental adjustable values in
  `config/balance-agriculture-v0.1.json`. Preserve Original as an A/B control;
  its JSON is a read-only snapshot of the kernel defaults.
- God expresses intent; the World determines execution. No forced worker,
  family or settlement quotas and no food or building materials created by UI.
- Preserve resource transfers, reachable common food, deterministic Seed/Profile/
  timed-action replay and compatibility with existing Web save JSON.
- Prefer a playable reasonable candidate and short targeted checks over
  elaborate balancing. After mechanical edits run `npm test`,
  `npm run smoke` and `npm run check:agriculture`.
- Keep main viewport map and Miracle/Oracle controls visible together without
  document or list vertical scrolling. Use tabs, bounded selection and pages.
