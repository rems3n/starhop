# Brief: Mode 1 — Explore (owner of src/modes/explore/** and src/components/object/**)

Reference feel: Stellarium Web. The sky fills the screen; everything else floats and gets out of the way.

## Screen

Full-bleed `<SkyView>` (from `@/sky`) driven by `useSettings` (observer, bortle → limiting magnitude via
`BORTLE`, layers). Floating UI:

- **Search** (top-left on desktop, full-width on phone): `catalog.search(q)` as you type, keyboard
  navigable (↑/↓/Enter, `/` focuses, Esc closes), result rows show name + kind + constellation.
  Choosing one flies there (`flyTo`) and selects it.
- **Time bar** (bottom): current simulated date and time in the observer's time zone (`formatDate` /
  `formatTime` with `observer.tz`), buttons: Now, Play/Pause, slower/faster through fixed rates
  (−1 day/s … −1 hr/s, −10 min/s, −1 min/s, real time, 1 min/s, 10 min/s, 1 hr/s, 1 day/s — show the
  rate in words), step back/forward by a selectable unit (hour / day / sidereal day / month / year),
  and a date-time picker to jump anywhere. Subscribe to the engine's `time` event; never drive React
  state at 60 Hz.
- **Location** button showing the place name → modal: built-in list of ~80 cities worldwide with
  lat/lon/IANA tz (searchable; include a good spread of latitudes and both hemispheres, e.g. Brooklyn,
  London, Tromsø, Reykjavík, Cairo, Nairobi, Singapore, Quito, Sydney, Cape Town, Punta Arenas…),
  "Use my location" (Geolocation API; tz = browser's `Intl.DateTimeFormat().resolvedOptions().timeZone`),
  and manual lat/lon + time-zone entry. Saves to `useSettings.setObserver`.
- **Layers panel** (toggle button; collapsible): a Switch for every `LayerState` key, grouped
  (Constellations: lines, boundaries, names · Stars & objects: star names, deep-sky markers, planets,
  Milky Way · Guides: ecliptic, equatorial grid, azimuthal grid · Ground & air: horizon, ground,
  atmosphere). Persisted via `useSettings.setLayers`.
- **Light-pollution slider**: Bortle 1–9 with the class label, description and limiting magnitude from
  `BORTLE`, a live count of catalog stars at or above that limit that are currently above the horizon
  ("about 310 stars visible right now"), a hint that Brooklyn is roughly Bortle 8–9, and a one-tap
  "Compare: city / dark site" toggle (flip between the current value and Bortle 2 so the difference is
  obvious).
- **Info panel** for the selected object (right-hand drawer on desktop, bottom sheet on phone,
  closable): renders `<ObjectInfo variant="panel">`.
- Compass/zoom affordances: buttons for zoom in/out and "face N/E/S/W", current field of view and the
  centre direction (e.g. "Looking SSE, 34° up"). A small help popover listing mouse/touch/keyboard controls.
- `?target=<TargetRef>` in the URL: on load, fly to and select that target (resolve at the current time).
- `?fps=1` shows the engine's `getFps()` readout.

## Shared object components (`src/components/object/index.tsx`)

The prop contracts in that file are fixed (Learn and Quiz import them). Replace the placeholders:

- `ObjectInfo` — for stars, deep-sky objects, Sun/Moon/planets, constellations and asterisms:
  - title, designations, kind in plain words (e.g. "Red supergiant star", "Globular cluster — a ball of
    several hundred thousand ancient stars"), constellation (link to `/learn/constellation/<Abbr>`);
  - facts: apparent magnitude (with a plain-language gloss, "easy naked-eye star even from a city"),
    distance (`formatDistanceLy`), apparent size and physical size (blurb `physicalSize`), spectral type
    explained (colour, temperature class, giant/dwarf from the luminosity class), absolute magnitude /
    luminosity vs the Sun for stars; phase, distance in AU and angular size for bodies;
  - **what it is** (`getBlurb(...catalog.aliases(ref))` `about`; fall back to a sensible sentence built
    from type data);
  - **how to find it** (blurb `howToFind`; fallback computed from the catalog: constellation + offset
    and direction from the nearest star brighter than magnitude 2.5, in hand-spans via `handSpan`);
  - **when it is visible**: tonight from the observer's location (rise / highest / set times, current
    altitude and compass direction, tonight's visibility class in words) from `@/astro`, the
    `VisibilityStrip` for the year, and best evening months;
  - **what you need**: naked eye / binoculars / small telescope / telescope (`Dso.equip`; for stars from
    magnitude: ≤ 6.0 naked eye under a dark sky — and say whether it is visible at the user's current
    Bortle setting; blurb `whatYouSee`);
  - image gallery (`catalog.imagesFor(ref)`);
  - links: "Open full page" (`/learn/object/<encoded ref>`, panel variant only), "Quiz me" for
    constellations (`/quiz/find?con=<Abbr>`), and for constellations a short overview from
    `loadConstellationContent` with a link to the constellation page.
- `ImageGallery` — thumbnails → lightbox; every image shows its kind as a clear badge
  ("Photograph", "False colour", "Artist's impression", "Simulation") with `kindNote`, the telescope,
  the credit line, and the licence as a link, plus a link to the source page.
- `VisibilityStrip` — 12 month cells coloured/labelled evening / morning / all night / not visible
  (use `yearVisibility` from `@/astro`; text or pattern as well as colour, with a legend), current month
  marked. Must be cheap to render many times (the Learn calendar shows ~95 rows): memoise per target/observer.

## Notes

- Keep the engine instance across UI re-renders; talk to it through the `SkyController`.
- Phone: bottom sheet for info, time bar collapses to essentials, panels never cover the whole sky.
- Files: `src/modes/explore/**` (default export `ExplorePage` from `ExplorePage.tsx`), `src/components/object/**`,
  CSS with `.ex-` / `.obj-` prefixes, `docs/EXPLORE.md`.
