# Learn mode (`src/modes/learn`)

Default export `LearnRoutes` (`LearnRoutes.tsx`), nested under `/learn/*`. CSS in `learn.css`, prefix `.ln-`.

## Routes

Learn is only the course (`src/content/course.json`, resolved per location by `resolveCourse` in `src/content/course.ts`).

| Route | Page | Notes |
| --- | --- | --- |
| `/learn` | `pages/Home.tsx` | One "Continue where you left off" action, then the 8 modules as a numbered path (purpose, objectives — collapsed on phones — counts, progress, Start/Continue) |
| `/learn/module/:id` | `ModulePage.tsx` | Purpose, objectives, lessons / star-hops / constellation groups for the learner's location, progress, "Practice this module" (`routes.moduleQuiz`) |
| `/learn/lesson/:id` | `LessonPage.tsx` | "Module N · Lesson k of n" with previous/next in the module; after the questions, "Next lesson" follows course order |

`logic/course.ts`: `lessonPlace`, `moduleProgress` (lessons done, constellations seen/mastered — find-it mastery ≥ 0.8 —
and the module quiz score stored by the practice section with `setUnitScore(moduleId, score)`), `courseOverview`,
`useCourse`. Tonight / month / calendar / events pages still live in `pages/` and are mounted under `/tonight` by
`src/modes/tonight/TonightRoutes.tsx`; ConstellationPage / ObjectPage / SignpostPage are reused by the Library.
Old `/learn/*` routes redirect (see `LearnRoutes.tsx`).

## How it fits together

- **Scenes.** `logic/scene.ts` defines `SkyScene`: place, time, rate, all layers, Bortle/limiting magnitude,
  camera, highlights. Pages build a scene with pure functions (`makeScene`, `resolveDemoStep`,
  `placeTarget` in `logic/place.ts`) and hand it to `components/SkyStage.tsx`, which owns the one
  `<SkyView>` on the page and calls `applyScene(controller, scene)` whenever the scene object changes
  (so memoise it). SkyStage also draws the clock, Reset and "Open in Explore".
- **Demo player** (`components/DemoPlayer.tsx` + `resolveDemoStep`) follows `docs/LESSON-BRIEF.md`:
  every step starts from `DEMO_LAYERS`, tonight 21:00, south/35°/100°/alt-az, the learner's place and
  Bortle, then applies only the step's fields. `observer` may be a fixed place; `time` goes through
  `parseTimeSpec` in the step observer's zone; `view.target` is resolved at that time and place
  (alt-az: its azimuth/altitude; equatorial: its RA/Dec); `bortle` → `BORTLE[n-1].limitingMag`;
  highlights go to `setHighlights` unchanged except that trail `from`/`to` local times are converted
  to ISO instants in the observer's zone. Widgets (`logic/controls.ts`): play (step `rate`, or 30 min/s),
  time-scrub (4 pm–8 am around the step's night; whole day for a daytime step), date-step (±1, ±7 days,
  same clock time), month-step, latitude (90°N…90°S, same longitude/zone), bortle. Widgets talk to the
  controller directly, so the learner's panning survives; their state is cleared on every step and on Reset.
- **Where to show a thing.** `placeTarget`: the real sky at the target's best time tonight when it is
  visible tonight, otherwise a north-up equatorial chart with ground/horizon/atmosphere off and a note.
  `pickEvening` (signposts): tonight at 9 pm if the pattern is up, else a mid-month 9 pm from its best months.
- **Path** (`logic/path.ts`): `pathOverview` gives each unit its checklist, summary, state
  (passed / current / up-next / later) and next step. Units are never locked. A lesson id with no file
  is shown as "not written yet" and never blocks.
- **Calendar** (`logic/calendar.ts`): rows are computed eight at a time with `runChunked` (a timer tick
  between batches) and cached per place and year at module level.
- **Learn's own saved state**: `starhop.learn.v1` (`hooks.ts`, `useLearnLocal`) keeps which asterism
  pages were opened, because the shared progress store only tracks constellations.
- `[[ref|label]]` links on a page with a sky view call `showInSky` (select + fly, with a note if the
  target is below the horizon); on pages without one they fall back to Explore.

## Checks

- `npx vitest run tests/learn-*.test.ts` — demo-step resolution (incl. every authored step), controls,
  path progress, tonight grouping and phrases, placement, stick figures, calendar rows/sort/chunking.
- `node scripts/learn/walk-demos.mjs [lessonId…]` — opens every demo step in the real app
  (`npx vite --port 5202 --strictPort` first), presses the real Next button, and checks that the engine
  holds what the scene asked for, the target is centred and above the horizon, highlights are on
  screen, the caption matches, and the console is clean. Lines starting `CONTENT` are about the lesson
  text, not the player.
- `node scripts/learn/shots.mjs [filter…]` — screenshots into `docs/shots/learn/`.
- `window.__learnSky` / `window.__learnScene` expose the current controller and scene for these scripts.

## Known limits

- `month:<n>` time specs and the monthly pages use the current calendar year (as specified), so in
  November "January" is last January. Fixed stars are unaffected; planets in such steps are where they
  were then.
- Changing latitude with the slider keeps the camera's azimuth/altitude, which is the point of the
  control; it does not re-centre on the step's target.
- A typed-in location uses the device's time zone (there is no zone lookup offline).
- "Open in Explore" passes only the target; Explore has no deep link for time or place.
