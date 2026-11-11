# Brief: Mode 2 — Learn (owner of src/modes/learn/**)

Reference feel: Duolingo/Brilliant for the path and lessons; a good field guide for the reference pages.
Default export `LearnRoutes` from `src/modes/learn/LearnRoutes.tsx` (nested `<Routes>` under `/learn/*`).
Content comes from `@/content` (see `src/content/index.ts` and `schema.ts`), numbers from `@/astro`,
the sky from `@/sky`, shared object components from `@/components/object`.

## Routes

- `/learn` — home. The guided path is the spine: stage 1 "Anchors" (5 units), stage 2 "Season by
  season", stage 3 "Far south" from `pathUnits`, each unit a card with its lessons, constellations,
  progress (lessons done, constellations seen, unit quiz score) and a clear "Continue" action for the
  next thing to do. A unit is passed at `UNIT_PASS_SCORE`; later units show as "up next"/"later" but
  are never hard-locked (the learner may skip ahead). Also on the home page: a compact Tonight card,
  and entry points to the reference sections below.
- `/learn/unit/:id` — one unit: blurb, ordered checklist (lessons → constellation pages → asterisms →
  unit quiz at `/quiz/unit/:id`).
- `/learn/lessons` — all lessons grouped by unit (skills, motion, ecliptic, objects) with done marks.
- `/learn/lesson/:id` — lesson player: sections in order, each with its text (`Prose`, `tryIt`
  call-out) and, when present, the interactive demo; key points; then the practice questions one at a
  time (`McqQuestion`), recording each answer with `useProgress.record('know:<lessonId>:<qId>',
  'knowledge', grade)` (correct → 2, wrong → 0) and calling `markLessonDone` when finished; "Next
  lesson" / back to unit. For objects lessons show `examples` as cards that open the object in the
  lesson's sky view or its object page.
- **Demo player** (the heart of 2a): interprets `Demo` exactly as specified in `docs/LESSON-BRIEF.md`
  ("Demos: what the sky view can do" — defaults, per-step reset, time specs via `parseTimeSpec`,
  observer, rate, view, layers, bortle, highlights, and the `controls` widgets: play, time-scrub,
  date-step, month-step, latitude, bortle). One `<SkyView>` per demo; step Next/Back with the caption;
  a "Reset" for when the learner has wandered; "Open in Explore". Demo sky is navigable.
- `/learn/tonight` — Tonight panel for the user's location (`tonight()` from `@/astro`): sunset, end
  of twilight, Moon phase and rise/set, then what's up: planets, bright stars and constellations with
  best time, direction (compass word) and altitude in plain language ("high in the southeast around
  9 pm"), grouped as early evening / late evening / after midnight / before dawn; each row opens the
  object in a sky view preset to that time. Date picker to look at another night.
- `/learn/month/:m` (and an index) — monthly sky guides: the authored guide (`monthlyGuides`) plus
  live computed sections for the user's latitude and the current year: constellations well placed at
  ~9 pm, bright stars, planets visible that month with evening/morning labels, best viewing times, and
  a sky view of mid-month at 9 pm.
- `/learn/calendar` — visibility calendar: rows = all 88 constellations (group/filter by season, path
  unit, anchors; sort by name or by when visible) and the planets; columns = 12 months; cell =
  evening / morning / all night / not visible for the user's location (`VisibilityStrip` or
  `yearVisibility` directly — compute lazily/chunked so the page stays responsive), legend, current
  month marked, row click → page. Planets are computed for the current year and labelled as such.
- `/learn/signposts` and `/learn/signpost/:id` — the five seasonal signposts (asterisms with
  `signpost: true`): a sky view showing the asterism (polyline highlight from its `lines`), how to
  find it, and its `hops` as a list — selecting a hop draws that hop's highlights and flies to it.
  Other asterisms are listed with a compact view.
- `/learn/events` — year-ahead events (`yearEvents(now, observer, showers)`): oppositions,
  conjunctions, elongations, meteor shower peaks (with Moon interference), eclipses, solstices and
  equinoxes; filter by kind; "visible from here" emphasis; each opens a sky view at that moment.
- `/learn/constellations` — index of all 88: searchable, filter by season / anchors / hemisphere /
  visible tonight, each card shows name, English meaning, a tiny stick figure drawn from catalog lines
  (SVG), mastery, and whether it is up tonight.
- `/learn/constellation/:id` — the constellation page: name, meaning, genitive, abbreviation, area
  rank; a sky view centred on it with its lines highlighted (controls to toggle labels/boundary and
  to show the main stars one by one); how to find it; what it looks like; main stars (click → ring it
  in the sky view); notable objects (equipment chip, thumbnail from `catalog.imagesFor`, link to the
  object page); best months and the year strip for the user's location, plus "tonight" status; **stories**
  — each myth as its own block: title, culture, 2–3 sentence summary, "Read the story" expanding the
  retelling, "From: <ancient sources>", and the outbound "Full version" link (opens in a new tab,
  shows the site name); the origin/history; facts; the learner's mastery for this constellation
  (find / name / story / visibility) with buttons into the quizzes (`/quiz/find?con=`, `/quiz/name?con=`,
  `/quiz/story?con=`); previous/next within its path unit. Call `markSeen(id)`. Modern constellations
  with no stories show the naming history prominently instead. If a constellation's content file is
  missing, show the catalog-derived basics and say the write-up is not available yet.
- `/learn/objects` — the object lessons (unit "objects") and a browsable catalogue: Messier list,
  showpieces, bright stars, planets (filter by type / equipment / visible tonight).
- `/learn/object/:ref` — object page: `<ObjectInfo variant="page">` beside a sky view centred on it.

## Notes

- Reading pages use the `prose` class and a ≤ 66ch column; sky beside text on desktop, above on phone.
- All `[[ref|label]]` links inside a page that has a sky view should fly that sky view (`RichText onTarget`).
- Everything location-dependent uses `useSettings().observer`; show the location name with a link to change it (Explore's location dialog lives in Explore — link there or reuse a small picker).
- Files: `src/modes/learn/**`, CSS prefix `.ln-`, `docs/LEARN.md`.
