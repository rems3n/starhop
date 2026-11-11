# Practice: quizzes and progress (src/modes/quiz, mounted at /practice)

Seterra-style "find it on the map" plus Anki-style spaced review. Everything is static: questions are built in
the browser from the catalog (`public/data`) and authored content (`src/content`), answers go to
`useProgress.record()` (localStorage). Spec: `docs/briefs/quiz.md`.

Code map: `QuizRoutes.tsx` (routes) · `pages.tsx` (hub + one page per quiz type) · `Session.tsx` (one round:
question loop, timer, score, summary, recording) · `SkyStage.tsx` (sky questions: find, name, ringed objects) ·
`HopStage.tsx` (star-hop "follow the hop") · `logic/starhop.ts` · `logic/module.ts` (module quizzes) ·
`Dashboard.tsx` · `DifficultyPanel.tsx` · `logic/*.ts` (pure, tested in `tests/quiz-logic.test.ts` and
`tests/quiz-build.test.ts`) · `scripts/quiz/check.mjs` (headless walk-through, screenshots in `docs/shots/quiz/`).

## Routes

| Route | What |
| --- | --- |
| `/practice` | Hub: quiz types, round length, difficulty panel, Review button with the due count, "Practise a module" (all 8 with best scores), weakest constellations |
| `/practice/find[?con=Abbr]` | Find it (lasso). Starts at once; `con` = a one-question round on that constellation |
| `/practice/name[?con=Abbr]` | Name it. Setup (pick from 4 / type it) then round; with `con` starts at once on that constellation |
| `/practice/starhop[?hop=id]` | Star-hops. Setup (formats; this month's evenings / any season); with `hop` starts at once on that hop in both formats |
| `/practice/object` | Stars and objects: ringed star, marked deep-sky object, photo → which object, photo → which type |
| `/practice/story[?con=Abbr]` · `?story=<storyId>` | Myths. `con`: setup limited to that constellation. `story`: starts at once on exactly that myth — its authored questions (shuffled), "which constellation?", then its flashcard |
| `/practice/knowledge` | Sky knowledge: computed visibility questions + the lesson question bank (filter by course module) |
| `/practice/visibility[?con=Abbr]` | Visibility questions only (see below) |
| `/practice/lesson/:id` | That lesson's practice questions |
| `/practice/module/:id` | Closing quiz of a course module; records `setUnitScore(moduleId)` and shows pass/fail against `UNIT_PASS_SCORE` (80 %), with a link back to the module |
| `/practice/review` | All due items, weakest first, each in its own format; up to 20 per round |
| `/practice/weakest` | Find + name for the 5 weakest started constellations |
| `/practice/progress` | Dashboard |

Old `/quiz/*`, `/quiz/unit/:id` and `/progress` links are redirected by `src/App.tsx`. Every link uses `routes` (`src/lib/routes.ts`);
`/practice/weakest` has no helper yet and is built as `${routes.practice()}/weakest` (`weakestRoute()` in `pages.tsx`).

An unknown `con` is ignored (find/name fall back to the pool; story shows "no written story"). Add `?debug=1`
to any URL to expose `window.__quizQ` (current question) and `window.__quizSky` (sky controller) for scripts.

## Quiz types

- **Find it** — prompt "Find Orion"; draw one loop round it; scored with `scoreConstellationLasso`; the reveal
  draws the figure and name, rings missed main stars in `--bad`, and flies to the figure when any of its main
  stars is off-screen or hidden under the prompt panel / action bar.
- **Name it** — the constellation is emphasised (figure in amber; when lines are off in the difficulty, its
  boundary instead), all labels off. Pick from 4 (distractors below) or type it.
- **Stars and objects** — (a) bright named star ringed (mag ≤ 2.6; distractors of similar brightness); (b) Messier
  object or named showpiece (mag ≤ 7) marked (distractors of the same type first); (c) photo from
  `catalog.images` → which object; (d) what type of object is it (7 common types). Candidates follow the pool,
  widened to the whole sky if fewer than 6. A sub-mode with fewer than 4 candidates is greyed out.
- **Stories** — per myth: the authored `story.questions`; "Which constellation is this myth about?" (summary with
  the Latin, genitive and English names masked; wrong answers from other constellations that have stories,
  neighbours first; needs ≥ 4 such constellations); flashcards (front: constellation + title; back: summary and
  characters; self-graded). Constellations without stories are skipped.
- **Sky knowledge** — computed for the observer (`computeFacts`, cached per place/year): "Which of these is in the
  evening sky in mid-<month>?" (the three wrong answers are not visible that month, preferring ones that are up
  at some other season), "In which season is X best placed in the evening?" (only for a clear season), "Is X
  circumpolar from here?" (constellations within 1.5° of the limit are skipped), "Roughly how high does Polaris
  stand?" (northern observers ≥ 10° N), "Which planet is this tonight?" (only planets up tonight; real sky in
  alt-az at the planet's best time). Plus `lessons[].questions`.

Distractors for constellation names (`constellationDistractors`): up to two of the target's 6 nearest
constellations, then same evening season, then remaining neighbours, then anything — always 3 distinct, never the
target. Text answers (`pickDistinct`) are de-duplicated ignoring case.

Typed names (`matchConstellation`): Latin name, IAU abbreviation or English name ("the Hunter" / "hunter"),
ignoring case, accents, spaces and punctuation. Typos on the Latin name: 0 for ≤ 4 letters, 1 for 5–8, 2 for 9+,
and only when the input is strictly closer to the target than to every other name and is not exactly another
constellation's name/abbreviation/English name — so "Ursa Minor" never passes for Ursa Major, "Corona Australis"
for Corona Borealis, "Leo Minor" for Leo, "Triangulum Australe" for Triangulum, "Piscis Austrinus" for Pisces.

- **Star-hops** — pool: hops from `starhops.json` usable from the learner's hemisphere (`hemisphere` N/S/both and
  `monthsNorth` / `monthsSouth` chosen by the sign of `observer.lat`), this month's evenings (month in the observer's
  time zone) or any season; ranked. Two formats share item `hop:<id>`:
  (a) *Follow the hop* (`HopQ`, `HopStage.tsx`, `<SkyEmbed controls="limited">`): star chart, labels off, lines and
  limiting magnitude from the difficulty; the start is ringed and named (the first path star, plus the second when the
  hop starts from a pattern); the steps are shown with the target masked (links to it, its names, Messier number).
  The view is fitted so the whole path sits in the open sky between the steps panel and the action bar (measured from
  the projected path and corrected over a few frames; a centre on the far side of a celestial pole turns the chart
  round 180°). The learner taps the star where the hop ends: the pick is the nearest star (to the limiting magnitude)
  or the target within `max(20 px (28 on touch), 2° of sky)`; right when it is the target or within 0.3° of it.
  Reveal: the path as an amber line, each star labelled ("Start · Merak", "1 · Dubhe", target in green), the miss
  ringed in red.
  (b) *Where does this hop lead?*: the numbered masked steps, four answers of the same kind near the target
  (named stars ≤ mag 3.5 within 40° (then 70°, then anywhere) not on the path; Messier/showpiece deep-sky objects,
  same type first; neighbouring constellations). A shape target (asterism) is replaced by the star the path ends
  on; hops ending on an empty point (a celestial pole, the galactic centre) are asked only in the sky.

## Module quiz (`composeModuleQuiz`, `logic/module.ts`)

Uses `resolveCourse(observer, catalog)` (`QuizData.course`). Up to 12 questions, sky questions first:
lessons modules → the module's lesson questions, round-robin over its lessons; starhops module → one question per
hop of `starhopIds` (or, when that is empty, the top `starhopCount` hops usable here), alternating the two formats,
keeping at least 4 slots for the star-hopping lesson; anchors / seasons / beyond → find-it and name-it (different
constellations where possible), 2 story questions (one per constellation, round-robin) and 2 visibility questions over
the module's constellations. A module with nothing to ask (e.g. its groups are still empty) shows "This module's
practice will be available soon". The old path-unit quiz (`/quiz/unit`) is gone; `composeUnitQuiz` remains for tests.

## Difficulty (`useSettings().difficulty`, persisted)

Independent settings: faintest star magnitude (slider 3.0–6.5, shows the star count), constellation lines,
boundaries, name labels, random sky rotation, start near the target (else a random direction ≥ 50° away at a 100°
field), question pool, countdown timer. The panel shows the matching preset or "Custom".

| Preset | Mag | Lines | Bound. | Labels | Rotation | Start near | Pool | Timer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Easy | 4.0 | on | off | off | upright | yes | anchors | off |
| Medium | 4.8 | off | off | off | upright | yes | anchors | off |
| Hard | 5.5 | off | off | off | upright | no | northern hemisphere | on |
| Expert | 6.5 | off | off | off | random | no | all 88 | on |

Pools (`buildPool`): `anchors` (the 15, authored order) · `season:<winter|spring|summer|autumn|north-circumpolar|far-south>`
(labelled by months: "December–February evenings" …) · `hemisphere:<N|S>` · `tonight` (constellations not "not-visible"
in `tonight()`) · `group:<moduleId>/<groupId>` (the course's constellation groups for this location) · `unit:<pathUnitId>`
(legacy, no longer offered) · `all`. Unknown spec → anchors.

Sky set-up: star-chart mode = equatorial mount, ground/atmosphere/horizon/Milky Way/grids off, planets and
deep-sky layers off (they always print names — see `docs/requests/quiz.md`), lines/boundaries/labels from the
difficulty, roll random or 0, start within ~15° of the target at a field that fits it (`ResolvedTarget.fov` ×
1.12, widened on portrait screens). Pool `tonight` (find it only): real sky at 9 pm local or end of nautical
twilight if later (or the constellation's own best time if it is not up then), alt-az, horizon and ground on,
upright.

Timer (when on), seconds: find 60 (100 when "anywhere"), name 20 (typed 30), ringed object 20, multiple choice
30; flashcards untimed. Expiry counts as wrong. Keys: 1–4 pick, Enter = next / start, Space = show flashcard or
(find it) move while held.

## Session selection mix (`selectSession`)

Candidates are the item ids the round could ask (e.g. `find:<Abbr>` for the pool). They are bucketed:

- **due** — attempted and `due ≤ now`, sorted weakest first (`itemMastery` ascending, then earliest due);
- **weak** — attempted, not due, mastery < 0.6, weakest first;
- **new** — never attempted (random order);
- **rest** — attempted, not due, mastery ≥ 0.6 (random order).

For a round of `n`: `round(n × 0.5)` slots from due, `round(n × 0.25)` from weak, the remainder from new
(n = 10 → 5 / 3 / 2; n = 20 → 10 / 5 / 5; n = 5 → 3 / 1 / 1). Slots a bucket cannot fill are handed on in the
order due → new → weak → rest. The chosen ids are shuffled. "All", or `n` ≥ the candidate count, asks every
candidate once in random order. A beginner therefore gets all-new rounds; a caught-up learner gets new material.
Sky knowledge asks for `n + 4` ids and keeps the first `n` that build (some computed kinds do not apply to every
constellation). Review ignores the mix: every due item, weakest first, 20 per round.

## Grades (`gradeFor`, SM-2 in `src/store/progress.ts`)

| Answer | Grade |
| --- | --- |
| Wrong, "I don't know", "Show me", out of time | 0 (again — due in 10 minutes) |
| Right | 2 (good) |
| Right, quick and unaided | 3 (easy) |
| Flashcard Again / Hard / Good / Easy | 0 / 1 / 2 / 3 |

"Quick" = within 15 s (find), 6 s (name pick, ringed object), 10 s (name typed), 8 s (multiple choice).
"Aided" = find it with lines or labels on; name it (pick) with lines on; nothing else counts as aided.
Within one session an item is credited for success once: when several questions share an item (e.g. the four
angles of `/practice/visibility?con=Ori`, all `vis:Ori`), only the first right answer is recorded, so one sitting
cannot push its interval out several steps. Wrong answers are always recorded.

## Item ids (as in `src/store/progress.ts`)

| Id | Skill | Counts toward |
| --- | --- | --- |
| `find:<Abbr>` | find | that constellation |
| `name:<Abbr>` | name | that constellation |
| `story:<storyId>:<qId>` — `qId` = authored question id, or `which` for "which constellation?" | story | the story's constellation |
| `card:<storyId>` | story | the story's constellation |
| `vis:<Abbr>` (month/season/circumpolar/Polaris → `vis:UMi`) · `vis:<Planet>` | visibility | the constellation (planets: none) |
| `object:<TargetRef>` — canonical ref, e.g. `object:star:<HYG id>`, `object:dso:M42`, `object:body:Moon` (photo questions) | object | the object's constellation |
| `know:<lessonId>:<qId>` | knowledge | none |
| `hop:<starhopId>` | object (the store's `Skill` union is fixed) | none |

Several object sub-modes share one item (`object:dso:M42` can be asked as "marked in the sky", "photo" or
"type"); each time it is due one format is picked at random.

## Unit quiz (`composeUnitQuiz`)

One find-it and one name-it for every constellation of the unit (shuffled, asked first), then — shuffled
together — up to 4 story questions (one per myth, round-robin over the unit's constellations so one with five
myths does not take every slot) and up to 6 lesson questions (round-robin over the unit's lessons). Score =
right ÷ asked; stored with `setUnitScore` (the store keeps the best); pass at `UNIT_PASS_SCORE` (80 %).

## Find it: the lasso UX

- The stage opens in **Draw**: one-finger / left-button drag draws a freehand loop; releasing it scores at once.
- An explicit **Draw / Move** toggle sits in the bottom action bar. In Move, drag pans the sky. Holding **Space**
  switches to Move while held; right-drag and two-finger drag always pan; wheel / pinch always zoom.
- **Clear** removes a loop; **Show me** reveals the answer (graded as a miss).
- A loop too small to mean anything is discarded with a hint instead of being scored.
- After the answer: the figure and name are highlighted, missed main stars ringed, the one-line rule sits under
  **How is this scored?**, and **Next** (Enter) moves on.

Scoring rule (full detail in [docs/ASTRO.md — lasso.ts](ASTRO.md#lassots--circle-the-constellation)): the loop
counts when it holds at least 70 % of the constellation's main stars (those bright enough to be drawn at the
current limiting magnitude), takes in no more than a couple of other constellations' main stars, and is not more
than about four times the size of the figure. The figure is padded by 15 % of its size, at least 30 px (44 px on touch screens).

## Dashboard (`/practice/progress`)

Overall stats; **Module quizzes** (best score per course module, linking to its quiz); **Star-hops** (mastery of each
`hop:<id>`, hops usable from this hemisphere first, first 10 then "Show all"); **Myths** (per-myth mastery = mean of its
`story:<id>:*` and `card:<id>` items, weakest first; "Show all" lists the untouched ones; each links to the myth page
and to `/practice/story?story=`); then all 88 constellations, four cells each — Find, Name, Myths, When visible.
"Course order" groups them by the course's constellation groups for this location (module, then months), then
"Other constellations"; before the course is resolved, by evening months. Expanding a row shows one line per myth with a
Practise link, plus Find it / Name it / When is it up? / Read its page. "Reset progress" sits behind a confirmation.

## Known limitations

- "Accuracy, last 7 days" is approximate: the store keeps only each item's latest grade and time, so it is the
  share of items practised in the last 7 days whose latest answer was right.
- Planet and deep-sky rings are drawn by the quiz over the sky (the engine cannot hide those layers' names);
  `flyTo` has no padding, so the reveal flies a bit wider than the fit. Both are requested in
  `docs/requests/quiz.md`.
- Name-it with lines off shows the IAU boundary rather than rings on the main stars.
- The real-sky "tonight" set-up applies to find-it only; name-it and objects always use the star-chart view.
- `/practice/story?con=` opens the (filtered) setup screen rather than starting at once, so the learner can choose
  flashcards or questions (`?story=` starts at once); `/practice/knowledge` ignores `con` (use `/practice/visibility?con=`).
- The Hard preset's pool is `hemisphere:N` (in `src/store/settings`, not owned here) — see `docs/requests/v2-practice.md`.
- A constellation straddling the circumpolar limit with no clear season may have no visibility question at all
  from a given latitude; `/practice/visibility?con=` then says so.
- The headless check (`scripts/quiz/check.mjs`) needs the desktop tab parked while the phone tab renders: two
  software-rendered WebGL skies at once can stall the browser.

Run it: `npx vite --port 5234 --strictPort` in one terminal, then `QUIZ_URL=http://localhost:5234/ node scripts/quiz/check.mjs`.
