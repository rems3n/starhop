# Lesson figures: brief for figure authors

The learner asked for many more images, diagrams and interactions in the lessons, in the spirit of
Bennett et al., *The Cosmic Perspective: The Solar System*. Use that book's **teaching approach**; never copy
its figures, layouts, wording or photos (they are copyrighted). Everything you draw must be original, and every
photo must be open-licensed.

## What "the Bennett approach" means here

- **Annotated figures.** A drawing with callouts (`Callout` in the kit) that name each part and say in a few
  words what it does: "Fovea — sharpest vision: cones only". The figure teaches on its own.
- **Captions that state the point**, not the subject. Weak: "The Moon's phases." Strong: "The Moon is always
  half lit by the Sun; the phase is how much of that lit half faces us."
- **Process diagrams** for things that happen in steps (numbered `Step` markers only for real sequences).
- **Scale analogies** for sizes and distances ("if the Sun were a grapefruit, Earth would be a ball-point tip
  15 metres away"). Compute them; do not copy the book's numbers.
- **Side-by-side comparisons** (open vs globular cluster; emission vs reflection nebula; city vs dark sky).
- **Think about it** boxes: a question to pause on, then an answer the learner reveals (`thinkAbout`).
- **Common misconceptions** boxes: the myth and what is really going on (`misconception`). Use them where the
  myth is genuinely common: seasons caused by distance, phases caused by Earth's shadow, a "dark side" of the
  Moon, Polaris being the brightest star, eclipses every month, stars twinkling because they are far…
- **See it for yourself** = the existing `tryIt` field ("Try it outside").
- **Quick check** (`check`): one multiple-choice question right after a section, Brilliant-style. Not graded.

## Interactivity standard

Prefer figures the learner can *do something* with: a slider that moves time or latitude, a toggle that switches
a condition (daylight/starlight, city/dark site), Play to animate a process (Mars's retrograde loop forming,
the Moon going round). Each interactive diagram has a `Readout` line that explains the current state in plain
words and changes as the controls change. A static annotated diagram is fine when nothing needs to move.

## Where things go (lesson JSON, `src/content/schema.ts`)

Each lesson section may have:

```json
"figures": [
  { "type": "diagram", "id": "eye-retina", "params": { "light": "night" }, "caption": "…teaching caption…" },
  { "type": "image", "image": { …FigureImage… }, "caption": "…" },
  { "type": "gallery", "images": [ …2–4 FigureImage… ], "caption": "…" }
],
"thinkAbout": { "question": "…", "answer": "…" },
"misconception": { "myth": "…", "fact": "…" },
"check": { "id": "check-…", "prompt": "…", "choices": ["…", "…", "…", "…"], "answerIndex": 0, "explanation": "…" }
```

They render after the section's text, in that order (figures, misconception, think about it, quick check, try it).
Sections with a sky `demo` show the demo on the right on desktop; figures sit in the text column. Use at most two
figures per section, and keep the text column readable.

**Targets per lesson:** at least 3 figures (most of them interactive diagrams), at least 1 think-about-it, a
misconception where a real one exists, 1–2 quick checks. Every section should get something unless it is a short
practical list. You may edit the lesson's body text lightly so it refers to the figure ("as the figure shows…")
or to cut sentences the figure now explains better — keep facts consistent, and keep the end-of-lesson
`questions` valid.

## Writing a diagram

One file per diagram in `src/modes/learn/figures/diagrams/<id>.tsx` (the id is the file name; the registry picks
it up automatically). Copy the structure of the two exemplars:

- `eye-retina.tsx` — annotated cross-section + magnified detail, toggle + slider + readout
- `dark-adaptation-curve.tsx` — computed graph with a moving marker, play button, reset

Rules:

- Import only from `react` and `../kit` (plus `astronomy-engine` or `@/astro` / `@/data/catalog` /
  `@/store/settings` when the figure should compute real positions, e.g. sunrise azimuth for the learner's
  location). No new npm packages.
- Export `meta: DiagramMeta` (title, one-line summary, params) and a default component taking `DiagramProps`.
- Draw with `<Svg w h title desc>` (viewBox; scales to the column). Design for 720 px wide, aspect ratio 16:9 to
  2:1, and make sure labels stay readable when the column is 340 px wide (phone): text ≥ 12 px in viewBox units
  at 720 width, nothing important in the outer 8 px, no label overlaps.
- Colours: only `C.*` from the kit (theme tokens). Labels get a halo automatically (`fig-label`).
- Accuracy: every number in a figure is computed or checked (astronomy-engine for positions/dates; Wikipedia via
  the API for physical facts). Where you simplify (sizes not to scale, inclinations exaggerated), say so in the
  figure ("not to scale", "tilt exaggerated ×5").
- Accessibility: meaningful `title`/`desc`; controls are real inputs/buttons with labels; animations stop when
  paused; respect `usePrefersReducedMotion()` (no auto-play under reduced motion).
- Performance: no animation runs unless the learner pressed Play (or it is a gentle 1-time intro); stop timers on
  unmount.

## Images

- New photos go in `public/img/lessons/<kebab-name>.jpg` (JPEG, longest side ≤ 960 px, ≤ 250 KB, metadata
  stripped; PIL or ImageMagick are installed). You may also reuse the existing gallery photos in `public/img/`
  (e.g. `img/M42-1.jpg`): copy their kind/credit/licence fields from `public/data/images.json`.
- Sources: Wikimedia Commons API (polite User-Agent, ≥ 1.5 s between requests, back off on 429; request
  thumbnails at width 960 or 330 via `iiurlwidth`), NASA (public domain). Accept only public domain, CC0, CC BY,
  CC BY-SA. Read `extmetadata` for licence, author and credit; never invent credits; skip files without a clear
  author/licence.
- `kind`: photograph | false-color | micrograph | illustration | artist-impression | simulation | chart, with a
  `kindNote` saying how it was made where the source says so.
- Prefer a drawn diagram over a downloaded one; use photos for what only a photo shows (real retina micrograph,
  star trails, a city vs dark sky, an eclipse, a meteor, objects through a telescope).

## Verify before you finish

1. `npx tsc --noEmit` clean; `npm run validate -- lessons/<your lessons>` 0 errors.
2. Screenshot every new figure in a real browser (dev server on your own port + puppeteer-core with
   executablePath '/usr/bin/google-chrome', args `--no-sandbox --use-gl=angle --use-angle=swiftshader
   --enable-unsafe-swiftshader --ignore-gpu-blocklist`) at desktop width and at 390 px, in at least two control
   states. LOOK at them (Read tool) and fix overlaps, clipping, unreadable text, wrong geometry. Lesson URLs:
   `#/learn/lesson/<id>`; sections are reached with the Continue button. No console errors.
3. Put screenshots in `docs/shots/figures/` (git-ignored).
