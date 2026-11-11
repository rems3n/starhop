# Requests from Learn mode

## Sky engine (src/sky)

1. **Trail highlight times are parsed in the browser's zone.** `highlights.ts` does `Date.parse(h.from)`.
   The lesson brief says `from`/`to` are `"YYYY-MM-DD HH:MM"` local times *at the observer*. With a
   space instead of `T` this is also non-standard (works in Chrome, `NaN` in some engines).
   Workaround in Learn: `normaliseHighlights` converts them to ISO instants in the observer's zone before
   `setHighlights`. Explore/Quiz would need the same if they ever pass authored trails. Suggested fix:
   parse with `parseTimeSpec(h.from, observer)` inside the engine.
2. **Label collisions between highlight labels and star names** (e.g. "Polaris" under the "29°" angle
   label on the Big Dipper signpost, "Dubhe" under a polyline label). Cosmetic.
3. Nice to have: `flyTo` that can change mount, and a way to frame two targets at once (Learn computes
   the midpoint and a field of view itself for signpost hops).

## Shared store (src/store/progress.ts)

- There is no place to record that an asterism/signpost page was read. Learn keeps its own small
  store (`starhop.learn.v1`). If the progress dashboard should count signposts, add
  `asterismsSeen` + `markAsterismSeen` to `useProgress` and Learn will switch over.

## Shared object components (src/components/object)

- At the width of Learn's text column (about 300 px per inner column) the `VisibilityStrip` labels in
  `ObjectInfo variant="page"` run into each other ("mornmornmorn"). See `docs/shots/learn/object.png`.

## App shell (src/App.tsx / ui.css)

- At 390 px the bottom tab bar clips the "Night vision" button ("Red" / cut off).

## Catalog data

- `stars.json` lists Capella's companion as a separate bright star named "Gl 194B" (magnitude ≤ 1.5),
  so it appears in `tonight().brightStars`. The monthly page de-duplicates; the Tonight list shows what
  `tonight()` returns.

## Explore deep link

- `/explore?target=` cannot carry a time or place, so "Open in Explore" from a demo opens the target
  in the current sky, not the demo's moment.
