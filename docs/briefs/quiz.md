# Brief: Mode 3 — Quiz and progress (owner of src/modes/quiz/**)

Reference feel: Seterra for find-it (prompt, act on the map, instant feedback, score, retry) and Anki
for review (spaced repetition, honest self-grading). Default export `QuizRoutes({ progressOnly })` from
`src/modes/quiz/QuizRoutes.tsx` (nested routes under `/quiz/*`; with `progressOnly` render only the
dashboard — it is mounted at `/progress`).

## Common session model

A session = N questions (default 10, selectable 5/10/20/all) drawn from a pool, shown one at a time with
immediate feedback, a running score, optional timer, and an end summary (score, time, each miss with the
right answer, "Retry missed", "New round"). Every answer is recorded with `useProgress.record(itemId,
skill, grade, con)` using the item-id formats documented at the top of `src/store/progress.ts`
(correct → grade 2, or 3 if fast and unaided; wrong → 0; flashcards are self-graded Again/Hard/Good/Easy
→ 0/1/2/3). Question selection favours due and weak items (`dueItems`, `itemMastery`) and mixes in unseen
ones — document the mix.

Difficulty (`useSettings().difficulty`, persisted): independently adjustable —
star count (limiting magnitude slider with the number of stars shown), constellation lines on/off,
boundaries on/off, labels on/off, sky rotation random vs upright, starting view (centred near target vs
anywhere), question pool (anchors · by season · by hemisphere · tonight's sky · path unit · all 88),
timer on/off — plus one-tap Easy / Medium / Hard / Expert presets (`DIFFICULTY_PRESETS`); show which
preset matches, or "Custom".

Pools: `anchors` = `ANCHORS`; `season:<s>` / `hemisphere:<N|S>` from catalog constellations;
`tonight` = constellations visible tonight from the user's location (`tonight()` in `@/astro`);
`unit:<id>` from `pathUnits`; `all`.

## Quiz types and routes

- `/quiz` — hub: the quiz types, the difficulty panel, a "Review" button showing how many items are due,
  and the weakest constellations.
- `/quiz/find[?con=Abbr]` — **Find it**: prompt "Find Orion". Sky view (`@/sky`) in lasso mode: the
  learner draws a freehand loop. Score with `scoreConstellationLasso` from `@/astro` (rule documented in
  docs/ASTRO.md — show the one-line rule under a "How is this scored?" disclosure). Then reveal: the
  constellation's lines and name highlighted (`setHighlights`), the result message, missed stars ringed;
  Next. Sky setup: equatorial mount, ground/atmosphere/horizon off, Milky Way off, layers from the
  difficulty (lines, boundaries, labels), `limitingMag` from the difficulty, roll = random if "random
  rotation" else 0; start view centred within ~15° of the target at a field of view that fits it
  (`ResolvedTarget.fov`) with margin, or — "anywhere" — a random direction and a wide view so the
  learner has to navigate. Exception: pool `tonight` uses the real sky tonight at a sensible evening
  time in alt-az mount with the horizon shown (upright). Because drawing and moving share the pointer,
  provide an explicit, obvious Move / Draw toggle (and hold Space to move temporarily; right-drag and
  two-finger drag also move; wheel/pinch zoom always works), plus "Clear" and "Skip"/"Show me".
- `/quiz/name[?con=Abbr]` — **Name it**: a constellation is highlighted in the sky (its lines emphasised;
  when lines are off in the difficulty, emphasise its stars/region without drawing the figure — e.g.
  rings on its main stars or its boundary) with all labels off; answer by picking from 4 choices
  (distractors: neighbours and same-season constellations) or, in "type it" mode, by typing the name
  (accept Latin name or abbreviation, case- and accent-insensitive, small typo tolerance).
- `/quiz/object` — **Objects**: (a) a star is ringed in the sky → which star? (bright named stars; pool
  follows the constellation pool), (b) a deep-sky marker is ringed → which object? (Messier/showpieces),
  (c) an image from `catalog.images` → which object is this? and (d) what type of object is it?
  (galaxy / open cluster / globular cluster / emission nebula / planetary nebula / supernova remnant…).
  Selectable sub-modes; skip sub-modes with too little data.
- `/quiz/story[?con=Abbr][&story=id]` — **Stories** (content via `loadAllConstellationContent()` or one
  constellation): multiple-choice questions on characters and events (`story.questions`, item
  `story:<storyId>:<qId>`); "which constellation is this myth about?" built from a story's title/summary
  with the constellation's name masked; and flashcards (front: constellation + story title; back:
  summary and characters; self-graded; item `card:<storyId>`). Constellations with several myths are
  quizzed **per myth** — each story is its own item and appears separately on the dashboard.
- `/quiz/knowledge` — **Sky knowledge**: computed questions for the user's location using `@/astro` —
  "Which of these is visible in July evenings?" (`yearVisibility`), "In which season is Orion in the
  evening sky?" (`eveningSeason`), "Which planet is this tonight?" (a planet ringed in tonight's sky
  with labels off; only when at least one planet is up, with real distractors), "Is X circumpolar from
  here?", "Roughly how high does Polaris stand here?" — record as `vis:<Abbr|Body>` with skill
  `visibility` — plus the lesson question bank (`lessons[].questions`, item `know:<lessonId>:<qId>`,
  skill `knowledge`), filterable by lesson unit.
- `/quiz/lesson/:id` — just that lesson's questions. `/quiz/unit/:id` — end-of-unit quiz mixing find-it,
  name-it, story questions and that unit's lesson questions for the unit's constellations; on finish call
  `setUnitScore(unitId, score)` and show pass/fail against `UNIT_PASS_SCORE` with a link back to the path.
- `/quiz/review` — **Review**: all due items across types, weakest first, each presented in its own
  question format; shows "nothing due — next review in …" when empty.
- `/progress` (and `/quiz/progress`) — **Dashboard**: mastery per constellation across find / name /
  story / visibility (`constellationMastery`): all 88 as rows grouped by path unit, four cells each
  (empty = not started), sortable, with per-story breakdown on expand; overall numbers (constellations
  started/mastered, due now, accuracy last 7 days if derivable), lessons completed, unit scores; a
  "Practise weakest" action; and "Reset progress" behind a confirmation.

## Notes

- Timer: per-question countdown/elapsed; expiry counts as wrong. Keyboard: 1–4 pick a choice, Enter = next.
- Phone: sky-first; prompt bar on top, actions at the bottom within thumb reach.
- Missing content must not break quizzes (skip story questions for constellations without stories).
- Files: `src/modes/quiz/**`, CSS prefix `.qz-`, tests for pure logic (pool building, distractor
  selection, answer matching, session selection) in `tests/quiz-*.test.ts`, `docs/QUIZ.md`.
