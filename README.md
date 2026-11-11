# Starhop — learn the night sky

A browser planetarium with a built-in study and quiz system, made for a beginner who wants to walk outside,
recognise every constellation they can see, know its stories and notable objects, and understand why the sky
looks the way it does on any night. Default location: Brooklyn, NY.

- **Explore** — a smooth, Stellarium-style sky: drag, zoom, search and fly to anything, set place and time,
  run the clock, toggle 13 layers, and compare a city sky with a dark site using the Bortle 1–9 slider.
  Click anything for what it is, how to find it, when it is up, what you need to see it, and photos.
- **Learn** — a guided path (15 anchor constellations, then season by season, then the far south), 24 short
  lessons with live sky demos, Tonight, monthly guides, a visibility calendar, seasonal signposts,
  year-ahead events, and a page for every one of the 88 constellations with its stories.
- **Quiz** — find-it (draw a loop around the constellation), name-it, objects, stories, sky knowledge,
  adjustable difficulty with presets, spaced repetition, and a mastery dashboard.

Everything runs in the browser. There is no backend: the catalog ships as static files and progress is saved
in the browser (localStorage).

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm start` | Serve `dist/` (zero-dependency Node server, honours `$PORT`) |
| `npm test` | Unit tests: astronomy (incl. checks against JPL Horizons and astropy), lasso scoring, visibility, data, sky camera, Explore/Learn/Quiz logic |
| `npm run validate` | Check every content file against its schema and the catalog; add `-- --links` to re-check every story link |
| `npm run data` | Rebuild `public/data/*.json` from the source catalogs (downloads on first run) |

## Deploy to Railway

The repo is ready for Railway as a single service; `railway.json` sets the build and start commands.

1. Push this folder to a GitHub repository.
2. In Railway: **New Project → Deploy from GitHub repo** and pick the repository.
3. Railway runs `npm install`, `npm run build`, then `npm start`, which serves `dist/` on Railway's `$PORT`
   with gzip and long-lived caching for hashed assets.
4. **Settings → Networking → Generate Domain** to get a public URL.

Any other static host works too: upload the contents of `dist/` (the app uses hash routing and relative paths,
so it runs from any sub-path with no server rewrites).

With the Railway CLI instead: `railway init`, then `railway up` from this folder.

## How it is built

| Part | Choice | Why |
| --- | --- | --- |
| App | TypeScript, React 18, Vite | Your default; fast builds, code-splitting per mode and per constellation page |
| Sky | Custom WebGL2 renderer + 2D canvas overlay for labels | Stars live in static GPU buffers and are transformed by one matrix per frame, so 9,000–28,000 stars cost a handful of draw calls; nothing is redrawn while idle. A general 3-D library would add weight without helping a sky-dome projection. |
| Projection | Stereographic | Keeps constellation shapes undistorted at wide fields of view, as planetarium apps do |
| Astronomy | astronomy-engine | Accurate Sun/Moon/planets, precession, rise/set and eclipses in pure JS (MIT) |
| State | zustand + localStorage | Small; settings and progress persist with no backend |
| Content | JSON files checked by zod schemas | Writers and code share one contract; `npm run validate` catches broken references |

More detail: `docs/ARCHITECTURE.md`, `docs/SKY.md`, `docs/ASTRO.md`, `docs/DATA.md`, `docs/EXPLORE.md`,
`docs/LEARN.md`, `docs/QUIZ.md`, `docs/IMAGES.md`.

## Data

| File | Contents | Source |
| --- | --- | --- |
| `stars.json` | 8,920 stars to magnitude 6.5 with names, Bayer/Flamsteed designations, spectral type, distance, colour | HYG v4.1 |
| `stars-faint.json` | 19,575 more stars to magnitude 7.6, loaded only for dark-sky settings | HYG v4.1 |
| `constellations.json` | All 88: stick figures, IAU boundaries, names, areas, main stars | d3-celestial, IAU |
| `dsos.json` | 599 deep-sky objects: all Messier and Caldwell, NGC/IC to magnitude 10, famous extras | OpenNGC, Wikipedia |
| `milkyway.json` | Milky Way brightness contours | d3-celestial |
| `images.json` + `public/img/` | 210 images of 167 objects, each labelled photograph or false colour, with telescope, credit and licence | Wikimedia Commons (public domain, CC0, CC BY, CC BY-SA) |

Sources and licences for everything are in `CREDITS.md`.

## Accuracy checks

See `docs/VERIFICATION.md` for the full tables; the reference data are stored in `tests/fixtures/` so the
checks run offline with `npm test`.

| Compared | Reference | Worst difference |
| --- | --- | --- |
| Sun, Moon and 7 planets: altitude/azimuth and RA/Dec from Brooklyn, 7 instants in 2026–27 | JPL Horizons | 0.004° |
| Rise, transit and set of Sun, Moon and 4 planets, 4 dates (71 events) | JPL Horizons | 0.96 minutes |
| 10 bright stars: altitude/azimuth, 4 dates | astropy | 0.006° |
| 12 Aug 2026 partial solar eclipse from New York | published local circumstances | under 1 minute, 9.4 % covered |
| 28 Aug 2026 lunar eclipse contact times | published times | about 1 minute |
| Meteor shower peaks (2026–27) | IMO / American Meteor Society | within the published peak window |
| Sky renderer: Polaris, Moon and planets on screen vs astronomy-engine; east-left when facing south | — | under 0.001° |

Star positions are J2000 catalog positions without proper motion; by 2026 the largest error among bright stars is
α Centauri at about 0.03°, far below what the eye can see.

### Find-it scoring rule (lasso)

Your loop is closed automatically. It is **correct** when it encloses at least 70 % of the constellation's main
stars (for figures with 4 or fewer main stars, at most one may be missed and at least 2 must be inside) **and** it
does not take in too much else: at most max(2, half the enclosed count) main stars of other constellations (stars that sit inside the target's own outline, such as Corvus inside Hydra's curve, are not held against you), and an
area no more than 4× the constellation's outline after padding it (so small or thin figures still get a fair
allowance). Main stars = figure stars of magnitude 4.6 or brighter (at least the 4 brightest). The result explains
itself ("You got 5 of 7 main stars, but the loop also took in most of Taurus"). Details and constants:
`docs/ASTRO.md`; unit tests cover every constellation in `tests/lasso.test.ts`.

## Privacy

No accounts, no analytics, no network calls after the page loads. "Use my location" asks the browser for your
position once and stores only the latitude, longitude and time zone in your browser.
