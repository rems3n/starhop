# Starhop — learn the night sky

A browser planetarium with a built-in course, reference library and practice system, for anyone who wants to walk
outside, recognise every constellation they can see, know its stories and notable objects, and understand why the
sky looks the way it does on any night — wherever they are on Earth.

- **Sky** — a smooth, Stellarium-style sky map: drag, zoom, search and fly to anything, set place and time, run the
  clock, toggle 14 layers (including illustrated constellation figures), and compare a city sky with a dark site using
  the Bortle 1–9 slider. Click anything for what it is, how to find it, when it is up, what you need to see it, and photos.
- **Tonight** — what is up tonight from your location, monthly sky guides, a visibility calendar and year-ahead events.
- **Learn** — a course in 8 modules (how to look · how the sky moves · finding your way · your first constellations ·
  season by season · Sun, Moon and planets · what's out there · beyond your horizon). Each module states what you will
  be able to do, and ends with a quiz. 24 lessons with live sky demos, interactive diagrams, photos, "think about it",
  misconception and quick-check boxes. The constellation modules are computed for your latitude, so a learner in Sydney
  gets the Southern Cross where one in London gets the Plough.
- **Library** — searchable, filterable lists: all 88 constellations, all 120 myths (each with its own page and quiz),
  27 ranked star-hops, asterisms, 450 named stars, ~600 deep-sky objects, the Sun, Moon and planets.
- **Practice** — find-it (draw a loop around the constellation), name-it, objects, stories, star-hops, sky knowledge,
  module quizzes, adjustable difficulty with presets, spaced repetition, and a progress dashboard.

Every embedded sky view has the same layer and light-pollution filters as the full map.

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
| `npm test` | Unit tests: astronomy (incl. checks against JPL Horizons and astropy), lasso scoring, visibility, data, sky camera and art mapping, course resolution, library, quiz logic |
| `node scripts/final/smoke.mjs` | Browser smoke test of every section (desktop + phone, northern + southern learner) against a running build |
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

More detail: `docs/ARCHITECTURE.md`, `docs/briefs/v2.md` (sections and routes), `docs/FIGURES.md` (lesson figures), `docs/SKY.md`, `docs/ASTRO.md`, `docs/DATA.md`, `docs/EXPLORE.md`,
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
| `public/img/lessons/` | Photos used in lesson figures | Wikimedia Commons, NASA, ESO, NOIRLab (open licences) |
| `constellation-art.json` + `public/art/` | 85 constellation illustrations pinned to their stars | Johan Meuris / Stellarium (Free Art License) |
| `src/content/starhops.json` | 27 ranked star-hops with computed distances and months, both hemispheres | Written for this app |

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

## Assistant ("Ask Starhop")

A chat panel (button at the bottom left of every app page) that acts on the app: "show me Orion", "turn off lines",
"show the sky from Sydney tonight at 10", "is there a lesson on moon phases?". Corrections work as follow-ups
("no, the star"), and every change has an Undo.

- **How it works.** Every action is a tool defined once in `shared/ai-tools.json` and implemented in `src/ai/actions.ts`
  using the same stores and sky controller as the buttons. Plain commands are matched in the browser
  (`src/ai/local.ts`) and run instantly with no network call. Everything else goes to `POST /api/chat`
  (`scripts/ai.mjs`), which calls the Anthropic Messages API with the tool list; the browser runs the returned tool
  calls and reports the results until the model replies (`src/ai/chat.ts`).
- **Setup.** Set `ANTHROPIC_API_KEY` on the server (Railway: service → Variables). Without it the panel still handles
  plain commands and says the full assistant is unavailable. Optional: `STARHOP_AI_MODEL` (default
  `claude-haiku-5-5`), `STARHOP_AI_DAILY_LIMIT` (default 3000 requests a day across all visitors).
- **Web search.** With a key set, the model can also search the web (Anthropic's server-side web search tool, at most
  two searches a request) for things Starhop's data does not cover; replies list their sources. Turn it off with
  `STARHOP_AI_WEB_SEARCH=off`. Searches are billed by Anthropic on top of tokens.
- **Guards.** The server owns the system prompt and tools, validates every message, limits each visitor to 20 requests
  a minute and 300 a day, and caps replies at 700 tokens. Set a spend limit on the API key as well.
- **Tests.** `tests/ai-local.test.ts` (matcher, schema, validation) and `node scripts/final/assistant-e2e.mjs`
  (browser run against a scripted stand-in for the model). The static site alone (`vite preview`, any static host)
  has no `/api`, so only plain commands work there.

## Live sky and Atlas

The sky map has two modes (switch above the time bar). **Live sky** is the sky from your location at the map's time,
with a real horizon. **Atlas** is a chart of the whole sky with no horizon and no time of day. Anything asked for by
name (search box, assistant, links from other pages) is shown so that it is actually in view
(`src/modes/explore/present.ts`): in the live sky if it is up in the dark now; otherwise the clock moves to its best
time tonight; otherwise the map switches to the atlas. A notice at the top says what happened and offers the way back.
