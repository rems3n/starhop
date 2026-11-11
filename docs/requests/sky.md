# Requests from the sky engine

No change to `src/types.ts` is needed. Two notes for other owners:

## 1. `src/data/catalog.ts`: optional files under the Vite dev server

`getJson(file, optional)` treats a missing optional file as "absent" only when the response is not OK.
The Vite dev server answers a missing `data/images.json` with `index.html` and status 200, so
`res.json()` throws and `useCatalog()` fails for every page until that file exists.
Suggested change: for optional files also return `undefined` when the content type is not JSON (or when
parsing fails). `src/sky/dev/main.tsx` carries a harness-only fetch guard for this; the app does not.

## 2. Spec wording: Polaris altitude

The sky-engine brief asks that Polaris land at "altitude ≈ 40.7° due north within 0.3°" from Brooklyn at
2026-11-10T02:00Z. Polaris is about 0.65° from the pole, and at that instant it is at altitude 41.14°,
azimuth 0.55° (astronomy-engine's own figure). The headless check therefore tests (a) agreement with
astronomy-engine within 0.3° (actual error < 0.001°), (b) Polaris within 1° of latitude / 1.5° of north,
and (c) that due north at altitude = latitude un-projects to the celestial pole.

## For Explore / Learn / Quiz authors

- Extra export: `getSkyStats(controller)` from `@/sky` (draw calls, vertices, frame ms) for a perf overlay.
- `MilkyWay` as typed is sufficient (data.md §2): the engine fills each level's rings together, even-odd.
