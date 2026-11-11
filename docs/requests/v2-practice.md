# Requests from the practice engineer (v2)

1. **routes.ts — weakest helper** (owner: IA). Add `routes.weakest = () => '/practice/weakest'`. Until then
   `src/modes/quiz/pages.tsx` builds it as `` `${routes.practice()}/weakest` `` (`weakestRoute()`).
2. **Hard difficulty preset assumes the north** (owner: `src/store/settings`). `DIFFICULTY_PRESETS.hard.pool` is
   `hemisphere:N`. For a southern learner that is mostly the wrong sky. Suggest a pool spec that follows the
   observer (e.g. `hemisphere:own`, which `buildPool` would resolve from `observer.lat`), or `group:` specs from the
   course. I can add `hemisphere:own` to `logic/pools.ts` as soon as the preset uses it.
3. **courseModules without schema defaults** (owner: IA). `courseModules` in `src/content/index.ts` is the raw JSON, so
   `lessons`, `optional` are `undefined` on the anchors/seasons/beyond modules instead of the schema defaults (`[]`,
   `false`). Practice guards against it; parsing with `courseSchema` (or spreading defaults) would make `CourseModule`
   honest for everyone.
4. **SkyEmbed: lasso across the control column** (owner: sky-embed). In the find-it quiz a loop drawn round a large
   constellation can pass over the embed's control column (Layers / zoom / reset, top right); in the headless check this
   occasionally loses the stroke (no lasso result, about 1 in 30 loops). Suggest the controls ignore pointer events
   while a lasso stroke is in progress (or the engine captures the pointer on lasso start).
5. **SkyEmbed: reserved corner** (owner: sky-embed). The control column covers the top-right of every quiz sky. Practice
   now leaves it uncovered on phones for star-hop questions (`.qz-hop .qz-prompt`), but the find / name / object prompts
   (SkyStage) still span the full width on phones and sit under/over the controls. A CSS custom property such as
   `--sky-embed-controls-width` would let quiz panels make room consistently.
6. **Location header on phones** (owner: IA). At 390 px the location pill sits in the app header; fine now — earlier
   builds overlapped the session bar ("0 correct"). Please keep the session top bar (`.qz-top`) clear of it.
