# Lesson brief (lesson, signpost and guide writers)

Read `docs/CONTENT-BRIEF.md` first — its hard rules (schemas are law, never fabricate, references must
resolve, plain text) apply here too. This file adds what is specific to lessons.

## What a lesson is

A short unit (3–8 minutes) in the style of Brilliant/Duolingo: a few small sections, each making one
point in 1–3 short paragraphs, most with an **interactive demo in the live sky view**, ending in
practice questions. Schema: `lessonSchema` in `src/content/schema.ts`, one file per lesson at
`src/content/lessons/<id>.json`. The lesson ids and units are fixed (they are referenced by the guided
path); use exactly the ids you were given.

- 350–700 words of body text per lesson in total. Lead with what the learner will be able to do.
- Every lesson has at least one demo; most sections should have one. `tryIt` gives a concrete thing to
  do outdoors tonight from a city.
- `keyPoints`: 3–5 one-line takeaways. `questions`: 4–6 multiple-choice questions that test
  understanding rather than recall of wording (4 distinct plausible choices; vary `answerIndex`).
- Numbers must be right. Check anything you are not certain of (Wikipedia API, see the content brief),
  and compute anything about dates/positions with `astronomy-engine` in Node rather than from memory
  (`node -e "const A=require('astronomy-engine'); …"` from the project root).
- Do not hard-code "this year" facts that go stale in body text (the app has a live Events page).
  If a demo needs a real date (a retrograde loop, an eclipse), compute it and use an absolute time spec.

## Demos: what the sky view can do

A demo is `{ title, controls, steps[] }`. The learner steps through `steps` with Next/Back; each step
sets up the sky and shows a caption. Each step **starts from the app defaults and the learner's
location, then applies the fields you give** (steps do not inherit from earlier steps, so repeat what
must persist).

Defaults: observer = the learner's saved location (Brooklyn, NY unless changed); time = tonight 21:00;
view = facing south, altitude 35°, field of view 100°, alt-az mount; layers = constellation lines,
constellation names, star names, planets, horizon, ground, atmosphere, Milky Way ON; boundaries,
grids, ecliptic, DSO markers OFF; Bortle = the learner's setting.

Step fields (all optional except `caption`):

- `observer`: `"user"` or a fixed place `{ name, lat, lon, tz }` (IANA tz), e.g. Quito, Sydney, Tromsø.
- `time`: `"now"` | `"tonight HH:MM"` | `"YYYY-MM-DD HH:MM"` | `"month:<1-12> HH:MM"` (15th of that
  month this year) — always local time at the observer.
- `rate`: simulated seconds per real second while the step is shown (3600 = an hour per second,
  86400 = a day per second; use 86164 to step exactly one sidereal day per second — stars stand still
  and the Sun/planets drift). Omit for a frozen sky.
- `view`: `{ target }` (any TargetRef, centred) or `{ az, alt }`; `fov` 1–160; `mount: 'equatorial'`
  for a horizon-free star-chart view (north up).
- `layers`: any of constellationLines, constellationBoundaries, constellationNames, starNames,
  dsoMarkers, planets, ecliptic, equatorialGrid, azimuthalGrid, horizon, ground, atmosphere, milkyWay.
- `bortle`: 1–9 (sets the faintest stars shown; 9 = inner city, 1 = pristine).
- `highlights`: drawn over the sky —
  - `{ type: 'constellation', id, lines?, boundary?, label? }`
  - `{ type: 'object', ref, label? }` ring around an object (label true = its name, or custom text)
  - `{ type: 'polyline', points: [refs…], closed?, label?, dashed? }` e.g. an asterism or a star-hop
  - `{ type: 'angle', from, to, label? }` an arc between two targets with the separation in degrees
  - `{ type: 'circle', center, radiusDeg, label? }` e.g. a 5° binocular field, the circumpolar circle
  - `{ type: 'label', at, text }`
  - `{ type: 'trail', ref, from, to, stepHours, frame?: 'stars' | 'horizon', dateLabels? }` the path of
    a body among the stars (planet retrograde loops, the Moon's monthly lap, the Sun along the
    ecliptic) or across the local sky (`frame: 'horizon'`: the Sun's daily arc on different dates,
    a star's nightly circle). `from`/`to` are `"YYYY-MM-DD HH:MM"` local times.
- Useful point targets: `point:north|south|east|west|zenith`, `point:ncp` (north celestial pole),
  `altaz:<az>,<alt>`, `radec:<raDeg>,<decDeg>`.

`controls` adds widgets under the sky so the learner can play after reading the caption:
`play` (run/pause time), `time-scrub` (slide through the night), `date-step` (± day at the same clock
time), `month-step` (± month at the same clock time), `latitude` (slider from 90°N to 90°S),
`bortle` (light-pollution slider).

Example step:

```json
{
  "caption": "Two fists up from the horizon is about 20°. The Pointer stars at the end of the Big Dipper's bowl are 5° apart: three fingers.",
  "time": "month:4 21:00",
  "view": { "target": "asterism:big-dipper", "fov": 60 },
  "layers": { "constellationNames": false },
  "highlights": [
    { "type": "angle", "from": "star:Dubhe", "to": "star:Merak" },
    { "type": "angle", "from": "star:Dubhe", "to": "star:Polaris", "label": "28° — about three fists" }
  ]
}
```

You cannot preview demos (the player is being built in parallel). Make them robust: choose times when
the target really is above the horizon at 40.7°N (verify with astronomy-engine), keep fields of view
generous, and never depend on something being exactly at the screen edge.

## Asterism ids (fixed)

`big-dipper`, `little-dipper`, `cassiopeia-w`, `orions-belt`, `winter-hexagon`, `winter-triangle`,
`spring-arc`, `sickle-of-leo`, `summer-triangle`, `northern-cross`, `great-square`, `keystone`,
`teapot`, `southern-cross`. Signposts (full guide pages with hops): `big-dipper`, `winter-hexagon`,
`spring-arc`, `summer-triangle`, `great-square`.
