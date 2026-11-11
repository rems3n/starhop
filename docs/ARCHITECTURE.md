# Starhop — architecture and working agreements

Starhop is a browser planetarium with a built-in study and quiz system for a beginner whose goal is to
walk outside (Brooklyn, NY by default), identify every visible constellation, know its stories and
notable objects, and understand why the sky looks the way it does on any night.

Static site. No backend. Catalog data ships as static JSON; progress saves to localStorage.

## Stack

- TypeScript (strict) + React 18 + Vite. HashRouter and `base: './'`, so the build runs from any static host.
- Sky rendering: custom WebGL2 (no three.js) with a 2D canvas overlay for labels. One stereographic
  camera shared by shader and CPU code.
- Astronomy: `astronomy-engine` (MIT) for Sun/Moon/planets, precession/nutation, rise/set, eclipses.
- State: `zustand` with `persist` (localStorage). Validation of authored content: `zod`.
- Tests: `vitest` (`npm test`). Headless checks: `puppeteer-core` with `/usr/bin/google-chrome`.
- Fonts: Newsreader (reading/headings), Figtree (UI), bundled via @fontsource (OFL).

## Layout and ownership

```
public/data/            stars.json, stars-faint.json, constellations.json, dsos.json, milkyway.json, images.json
public/img/             local image gallery files
scripts/data/           data pipeline (downloads → public/data). `npm run data`
scripts/validate-content.ts   `npm run validate [-- <filter>…] [--links]`
src/types.ts            ALL shared contracts (catalog, sky engine API, astro results). Read this first.
src/content/schema.ts   zod schemas + types for authored content
src/content/            constellations/<Abbr>.json, lessons/<id>.json, objects/*.json, asterisms.json,
                        monthly.json, showers.json, path.json, index.ts (accessors)
src/data/catalog.ts     loadCatalog(), useCatalog(), buildCatalog(), catalog.resolve(ref), search, images
src/astro/              pure astronomy: frames, bodies, visibility, events, lasso scoring (+ tests in tests/)
src/sky/                SkyEngine (WebGL) + <SkyView> React wrapper
src/store/              settings.ts (observer, bortle, layers, quiz difficulty), progress.ts (SRS, mastery)
src/lib/                time.ts (time zones, demo time specs), format.ts
src/ui/                 shared primitives (Button, Switch, Segmented, Slider, Chip, Meter, Modal, RichText, Prose)
src/styles/             tokens.css (design tokens), ui.css (primitives)
src/modes/explore/      Mode 1
src/modes/learn/        Mode 2
src/modes/quiz/         Mode 3 (+ progress dashboard)
tests/                  vitest tests
docs/                   ARCHITECTURE.md (this), DATA.md, ASTRO.md, VERIFICATION.md, per-area notes
CREDITS.md              source + licence for every dataset, image, font and library
```

Rules for everyone working in this repo:

1. **Stay in your lane.** Only create/modify files in the directories you were assigned. Do not edit
   `src/types.ts`, `src/content/schema.ts`, `src/data/catalog.ts`, `src/store/*`, `src/ui/*`, `src/styles/*`,
   `src/App.tsx`, `package.json` or config files. If a shared contract is wrong or missing something you
   need, do not work around it silently: write the requested change in `docs/requests/<your-area>.md`
   and mention it in your final report. (Adding a local helper inside your own directory is always fine.)
2. **No new dependencies.** Everything needed is installed (see package.json). Do not run `npm install`.
3. **Do not run `git` commands** that change state (no commit/checkout/stash/reset). Other agents are
   working in the same tree at the same time.
4. Other agents' files may not exist yet or may be mid-edit. Code against the contracts in `src/types.ts`.
5. `npx tsc --noEmit` must pass for your files before you finish. Never use `any` to dodge a contract.
6. Angles are degrees, RA is degrees (0–360), azimuth 0 = N / 90 = E, catalog positions are J2000.
7. Only open-licensed data/images. Every external source gets a line in your area's credits fragment
   `docs/credits/<area>.md` (source, URL, licence, what was used). The lead merges these into CREDITS.md.
8. Write for a beginner. Plain words, no jargon without a one-line explanation.
9. Never fabricate: no invented myths, sources, URLs, measurements or image credits. Leave a field out
   and list it in your report rather than guess.

## Target references

Anything in the sky is addressed by a `TargetRef` string (`src/types.ts`): `star:Vega`, `star:α Ori`,
`star:27989` (HYG id), `dso:M42`, `con:Ori`, `body:Mars`, `asterism:summer-triangle`, `radec:83.8,-5.4`,
`altaz:180,45`, `point:north|south|east|west|zenith|ncp|scp`. `catalog.resolve(ref, {date, observer})`
returns a `ResolvedTarget` with J2000 `ra`/`dec`. Authored text links to the sky with `[[ref|label]]`.

## Sky engine contract (src/sky)

```tsx
import { SkyView } from '@/sky';
<SkyView options={{ observer, time, layers, limitingMag, view, inputMode }} onReady={(c: SkyController) => …} className="…" />
```

- `<SkyView>` fills its parent (position it with CSS), creates one engine, and never re-creates it when
  props change; all later changes go through the `SkyController` (see `src/types.ts` for every method/event).
- Several SkyViews may exist over the app's life (Explore, lesson demos, quiz); only one is on screen at a time.
- Camera: stereographic; `ViewState { mount, lon, lat, roll, fov }`. `altaz` mount keeps the horizon level;
  `equatorial` mount with `roll` is used by quizzes ("random rotation") with ground/atmosphere/horizon off.
- Layers: `LayerState`. Limiting magnitude = faintest star drawn; Bortle class → limiting magnitude via `BORTLE`.
- `setHighlights(Highlight[])` replaces all annotations (constellation emphasis, object rings, polylines,
  angle arcs with labels, circles, labels, trails). Lessons, signposts and quiz reveals rely on it.
- Input modes: `navigate` (drag pan with inertia, wheel/pinch zoom, click = select → `select` event),
  `lasso` (one-finger/left-button freehand draw → `lasso` event with CSS-pixel points; wheel/pinch still zoom,
  right-drag or two-finger drag pans), `none`.
- Performance budget: 60 fps while panning/zooming with ~9,000 stars (and ~26,000 with faint stars) on a laptop.

## Astronomy contract (src/astro)

Pure functions, no React, no DOM. Exported from `src/astro/index.ts`. Result types are in `src/types.ts`.
Documented in `docs/ASTRO.md` (signatures, rules, accuracy).

## Stores

- `useSettings` (`src/store/settings.ts`): `observer`, `bortle`, `layers`, `redMode`, `difficulty` + setters, `DIFFICULTY_PRESETS`.
- `useProgress` (`src/store/progress.ts`): `record(itemId, skill, grade, con?)`, `markLessonDone`, `setUnitScore`,
  `markSeen`; helpers `dueItems`, `itemMastery`, `constellationMastery`, `UNIT_PASS_SCORE`. Item id formats are
  documented at the top of that file — use them exactly so the dashboard adds up.

## Routes

`/explore[?target=<TargetRef>]` · `/learn/*` · `/quiz/*` · `/progress`. Deep links other modes may rely on:

- `/explore?target=<ref>` — open Explore centred on and selecting that object
- `/learn/constellation/<Abbr>` — constellation page
- `/learn/lesson/<lessonId>` — lesson
- `/learn/object/<encodeURIComponent(ref)>` — object page
- `/learn/signpost/<asterismId>` — signpost guide
- `/quiz/unit/<pathUnitId>` — end-of-unit quiz (records `setUnitScore`)
- `/quiz/lesson/<lessonId>` — a lesson's practice questions as a quiz

## Design direction

A field guide for the night, not a dashboard. The sky is the hero and is always full-bleed where it
appears; controls float over it in translucent panels and get out of the way.

- Colour: deep blue-violet night (`--night-*`, never pure black), warm starlight text (`--text`),
  Arcturus amber (`--amber`) for the one primary action and current state, Vega blue (`--vega`) for links
  into the sky. Good/bad feedback uses `--good` / `--bad`. Use the tokens; do not introduce new colours.
- Type: Newsreader for headings and all long-form reading (class `prose`), Figtree for controls and data.
  Sentence case everywhere. No all-caps labels, no decorative eyebrows, no emoji as icons.
- Layout: Learn pages are reading pages (≤ 66ch prose column) with the sky demo beside the text on
  desktop and above it on phones. Quiz screens are sky-first with a slim prompt bar.
- Desktop-first, usable on a phone: at ≤ 720px the nav becomes a bottom tab bar (already done in `ui.css`);
  side panels become bottom sheets; tap targets ≥ 38px.
- Motion only in response to the user (fly-to, panel open). Respect `prefers-reduced-motion`.
- Red night-vision mode is global (`html[data-red]`) and needs nothing from individual screens.
- CSS: plain CSS files next to your components, class prefix per mode (`.ex-`, `.ln-`, `.qz-`, `.sky-`).
