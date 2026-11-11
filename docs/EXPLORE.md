# Explore mode and the shared object components

Owner files: `src/modes/explore/**`, `src/components/object/**`, `tests/explore-*.test.ts`, `scripts/explore/**`.

## Explore (`src/modes/explore`)

| File | What it is |
| --- | --- |
| `ExplorePage.tsx` | The screen. One `<SkyView>`; everything else floats over it. Owns selection, the `?target=` deep link, page keys, and the coarse "panel time". |
| `SearchBox.tsx` | `catalog.search` as you type. ↑/↓/Enter, `/` focuses, Esc clears then closes. Rows: name, kind, constellation. |
| `TimeBar.tsx` | Clock in `observer.tz`, play/pause, slower/faster, step by unit, Now, date-time picker ("Tonight at 9 pm"). |
| `timeRates.ts` | Pure: the nine fixed rates, rate in words, `stepTime` (hour / day / sidereal day / month / year), picker value conversion, "Looking SSE, 34° up". |
| `SkyPanels.tsx` | Layers panel (a switch per `LayerState` key, four groups) and the light-pollution panel (Bortle slider, live star count, compare toggle). |
| `skyCount.ts` | Pure: stars above the horizon at a limiting magnitude (main catalog + faint stars beyond 6.5). |
| `LocationDialog.tsx`, `cities.ts` | 92 built-in places, accent-insensitive search, "Use my location", manual latitude/longitude/time zone with validation. |
| `HelpPanel.tsx`, `icons.tsx`, `explore.css` | Controls list, inline SVG icons, styles (`.ex-`). |

How it talks to the engine:

- Engine options are read once. After that `useSettings` → `setObserver` / `setLimitingMag(BORTLE[n-1].limitingMag)` / `setLayers`.
- React never follows the clock frame by frame. The time bar re-renders only when the formatted minute changes. The info panel
  and star count get a coarse `date`: updated when simulated time has moved a minute and at most every 400 ms, plus a 1 s trailing check.
- Selecting (click, search, link in the panel, `?target=`) calls `setSelection`, adds constellation boundary/label or asterism
  polylines through `setHighlights`, flies there, and writes `?target=<canonical ref>` with `replace` so the URL can be shared.
  `point:`/`altaz:`/`radec:` targets only move the view.
- Fly-to field of view: constellations and asterisms use the catalog's suggested frame; single objects never zoom out and stop at 40° (20° for deep-sky objects) so the surroundings stay visible.
- If the selected object is below the horizon the panel offers "Jump to <time>, when it is highest in the dark" (`visibilityOn().bestTime`).
- `?fps=1` appends the engine's `getFps()` to the readout. `window.__explore` is the controller (used by the headless check).

Keys: `/` search · Space play/pause · Esc closes the open popover, then the info panel · arrows and +/− belong to the engine (sky focused).

Phone (≤ 720 px): search and tools span the top; the time bar shows clock, step, play and a "more" toggle for rate/unit/Now;
the info panel is a bottom sheet with a short peek (title and kind) above the time bar and an opened state of at most 62 % of the screen.

## Object components (`src/components/object`)

Exports (contracts unchanged): `ObjectInfo`, `ImageGallery`, `VisibilityStrip`, type `VisibilityTarget`.

- `ObjectInfo.tsx` — header (name, designations, kind in plain words, constellation link), "What it is", facts, "How to find it",
  "When it is visible", "What you need", pictures, links. `variant="page"` is two columns from 900 px with larger type.
  It reads `useSettings().bortle` for the "at your current sky setting" sentences.
- `describe.ts` — all wording that is computed rather than authored (pure, tested): star kind from the spectral type
  (`parseSpectral`, `starKind`, `spectralExplanation`), magnitude gloss, luminosity against the Sun, deep-sky kinds, `dsoNeedsDarkSky`,
  `fallbackAbout`, `fallbackHowToFind`, month ranges.
- `targets.ts` — `visTargetOf(resolved, catalog)`: body id, constellation/asterism star points, or one position.
- `VisibilityStrip.tsx` — 12 cells with a text code (`eve`, `morn`, `all`, `–`) as well as colour, hatching on "morning", legend, current month outlined.
  Results are cached per target + place (+ year for bodies) in a module map and the component is `memo`-ised, so ~95 rows cost one computation each.
- `ImageGallery.tsx` — thumbnails with a kind badge on every image; lightbox with kind + `kindNote`, telescope, credit, licence link, source link; ←/→ and Esc.

Fallbacks when content is missing:

| Missing | Shown instead |
| --- | --- |
| blurb `about` | A sentence from type, constellation and distance (`fallbackAbout`). |
| blurb `howToFind` | Constellation + hand-span offset and direction from the nearest star brighter than magnitude 2.5, marked "worked out from the star catalog". |
| blurb `physicalSize` | For deep-sky objects: width from apparent size × distance, marked as computed. Bodies: diameter against Earth. |
| blurb `whatYouSee` | Equipment chip and a generic sentence only. |
| constellation content | Computed overview (meaning, area rank, brightest star, zodiac) and the computed directions. |
| images | No "Pictures" section. |

Equipment caveat: `Dso.equip` comes from magnitude alone. Nebulae and galaxies wider than 60′ get a "Needs a dark sky" chip and a
sentence explaining low surface brightness; the blurb's `whatYouSee` is shown directly under the chips. At Bortle 7–9 other faint
fuzzy objects get a warning that the minimum equipment will not be enough.

Wording rules worth knowing: class A is called "white" and M "red" (the conventional names); a luminosity class is read only from the
first star of a composite type; `Ia`…`Ib` → supergiant, `II` bright giant, `III` giant, `IV` subgiant, `V` main-sequence, prefixes
`d`/`g`/`sd` are honoured; `W…`, `C`/`N`/`R`, `S`, `D…` get their own names. Luminosity is visual (from absolute magnitude, Sun = +4.83).

## Checks

- `npx vitest run tests/explore-` — 62 tests of the pure logic (spectral wording over the whole catalog, fallback directions for every
  constellation and deep-sky object, rate stepping, clock stepping across daylight-saving changes, city list and search, star count).
- `node scripts/explore/check.mjs` (dev server on 5201) — drives the real page in headless Chrome, asserts behaviour and no console
  errors, and writes the screenshots in `docs/shots/explore/`.

## Known limits

- The engine centres a target in the whole canvas, not in the part left visible beside the drawer or above the phone sheet (see `docs/requests/explore.md`).
- "Stars visible right now" counts catalog stars above the horizon at the limiting magnitude; it ignores haze near the horizon and moonlight.
- City coordinates and time zones were entered by hand from general knowledge (rounded to 4 decimals); a test checks every zone is valid and consistent with the longitude.
- Rise/highest/set for a constellation or asterism are those of its middle point.
