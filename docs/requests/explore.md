# Requests from Explore

None of these block Explore; each has a workaround in my own files.

## 1. Sky engine: centre a target in the unobstructed part of the view

`flyTo` centres the target in the whole canvas. With the info drawer open (400 px on the right) or the phone sheet open
(bottom 60 %), the true centre of what the user can see is elsewhere, and on a phone the selected object can end up under the sheet.
Suggested contract addition: `setViewPadding({ top, right, bottom, left })` (CSS px) honoured by `flyTo` and double-click centring,
or a `flyTo(..., { offsetPx: { x, y } })` option. Workaround today: none; the drawer is narrow enough on desktop, and the phone sheet starts as a short peek.

## 2. Sky engine: `flyTo` to something below the horizon shows the ground

Expected, but nothing tells the caller. Explore computes altitude itself and offers "jump to its best time tonight". No change needed; noting the behaviour.

## 3. Sky engine: no way to learn that the engine's rate or time was changed elsewhere

`time` fires for the clock but there is no `rate` event; the time bar polls `getTimeRate()` once a second to keep the play/pause button right.

## 4. Sky engine: selection does not draw asterisms

`setSelection('asterism:…')` draws a single object ring at the centroid. Explore adds the polylines with `setHighlights`.
The engine could draw the asterism's `lines` itself, as it does a constellation's.

## 5. `src/styles/ui.css`: phone tab bar overflows at 390 px

The four tabs plus "Night vision" are wider than a 390 px screen; the last button is cut off ("Night visio"). Not Explore's file.

## 6. `catalog.search`: bodies carry `ra: 0, dec: 0`

Search results for the Sun, Moon and planets are returned without a position. Explore re-resolves by `ref`, so it is harmless there, but any caller that uses the result's `ra`/`dec` directly would point at the wrong place.

## 7. `src/data/catalog.ts`: optional data files and the Vite dev server (resolved for now)

A missing `data/images.json` is answered by the dev server with `index.html` and status 200, which the loader would fail to parse.
`images.json` exists now, so this no longer bites, but checking the content type (as `src/sky/dev/main.tsx` does) would make the loader robust.
