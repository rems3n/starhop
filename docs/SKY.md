# Sky engine (`src/sky`)

The interactive sky view every mode embeds. WebGL2 for the sky itself, a 2D canvas on top for text and
annotations, one stereographic camera shared by both.

```tsx
import { SkyView } from '@/sky';
<SkyView options={{ observer, time, layers, limitingMag, view, inputMode }} onReady={(c) => …} />
// non-React: createSkyEngine(container, catalog, options) → SkyController
```

`SkyView` fills its parent, shows "Loading the sky…" until the catalog is in, creates one engine, calls
`onReady` once after the first frame, never re-creates the engine when props change (use the controller),
and destroys it on unmount. React StrictMode's double mount is handled: the first engine is destroyed before
its first frame, so `onReady` fires only for the one that stays (checked headlessly).

## Files

| File | What it holds |
| --- | --- |
| `camera.ts` | Pure maths: mount matrices, stereographic project/unproject, fov scale, clip predicate, great-circle subdivision. No DOM. |
| `color.ts` | Pure appearance rules: B−V → colour, magnitude → size/brightness, twilight limit, light pollution, Milky Way visibility, CSS colour parsing. |
| `ephemeris.ts` | The only astronomy-engine calls: J2000 → (North, East, Up) matrix, Sun/Moon/planet positions, sizes, magnitudes. |
| `shaders.ts`, `renderer.ts` | GLSL and the WebGL2 renderer (buffers, passes, context loss). |
| `milkyway.ts` | Paints the Milky Way contours into a texture, once. |
| `art.ts` | Constellation illustrations, pure maths: anchor matrix, image grid → sphere, texture-array packing, fade curve. |
| `labels.ts` | Label atlas (text drawn once, stamped each frame) and the collision box list. |
| `overlay.ts` | Everything on the 2D canvas. |
| `highlights.ts` | `Highlight[]` → ready-to-project geometry. |
| `pick.ts` | Pure picking priority, lasso helpers. |
| `engine.ts` | Clock, camera state, input, frame loop, the `SkyController`. |
| `SkyView.tsx`, `index.ts`, `sky.css` | React wrapper and public exports. |
| `dev/main.tsx` + `/sky-dev.html` | Dev harness. |

## Camera

- A direction is a unit vector. Catalog positions are J2000 unit vectors and never change.
- Stereographic projection: a direction at angle θ from the view centre lands at radius `tan(θ/2)`.
  The vertical `fov` (1°–160°) spans the canvas height.
- `altaz` mount: `lon`/`lat` are azimuth/altitude, the horizon stays level, altitude is clamped to ±90°.
  `equatorial` mount: `lon`/`lat` are RA/Dec; celestial north is turned **clockwise** from screen-up by `roll`.
- The sky is drawn as seen from inside: facing south, east is on the left.
- One 3×3 matrix (J2000 → view) per frame. In the altaz mount it is `mount × R`, where `R` is
  astronomy-engine's `Rotation_EQJ_HOR` (precession, nutation, Earth rotation) with the west axis flipped to east.
- No atmospheric refraction (objects at the horizon are drawn ~0.5° lower than they appear in reality).

## Rendering

GPU buffers are filled once. A frame is a few uniforms and 6–20 draw calls.

Pass order (WebGL):

1. **Sky background** – one full-screen triangle. Each pixel is un-projected in the fragment shader.
   Night colour comes from `--night-950`. With the *atmosphere* layer: day blue, a warm twilight band that
   hugs the horizon towards the Sun's azimuth, and a grey-orange light-pollution dome driven by
   `limitingMag` (full at ≤ 4.5, almost none at ≥ 6.5). The **Milky Way** is added here from a 1024×512
   equirectangular texture (see below); it is gone at `limitingMag` ≤ 5.0 and in twilight.
   With atmosphere off the sky is a flat dark colour with no hint of where the horizon is (quiz mode).
1b. **Constellation illustrations** (layer `constellationArt`, off by default) – Stellarium's drawings (see below),
   additive, behind lines and stars, one instanced draw call.
2. **Lines** – equatorial grid, azimuthal grid (same buffer, horizon matrix), ecliptic, IAU boundaries
   (dimmer, shared edges drawn once), constellation figures. Every line is pre-cut into great-circle pieces
   ≤ 2.5°, drawn as instanced screen-space quads with a soft edge.
3. **Stars** – `gl.POINTS`, one vertex per star (J2000 vector, magnitude, colour), additive blending.
   The catalog is sorted by magnitude, so the limiting magnitude is just the draw count (binary search);
   the last 0.45 mag fades rather than pops. Size and brightness come from magnitude (`color.ts`), bright
   stars get a halo, colour comes from B−V. Faint stars (`stars-faint.json`) are a second buffer, fetched
   only once `limitingMag` > 6.5. With atmosphere on, the limit drops through twilight
   (`twilightLimit`) and no star is drawn in daylight.
4. **Sun, Moon, planets** – one small quad each. Planets: coloured disc + glow. Sun: disc + glare.
   Moon: a lit sphere, with the light direction computed from the Sun's position, so the phase and the
   tilt of the bright limb are right. Discs have a minimum on-screen size and their true angular size
   once that is larger. With atmosphere on, planets fade in daylight according to their magnitude.
5. **Ground + horizon line** – one full-screen triangle; opaque, graded and lightly textured below the
   mathematical horizon, with an anti-aliased horizon line.

On the 2D overlay canvas, in this order: cardinal letters (N, NE, …) on the horizon, grid degree labels,
planet names, deep-sky symbols, constellation names, star names, deep-sky names, highlights, selection
marker, lasso.

- **Text** is rendered once per string into an atlas (Figtree Variable, dark halo) and stamped with
  `drawImage`. The atlas is rebuilt when the font finishes loading or the device pixel ratio changes.
- **Collision**: a label is skipped if its box overlaps one already placed (star/deep-sky labels try
  right, left, above, below first). Highlight labels reserve their space first.
- **Constellation names** sit at the catalog's label anchor, most prominent constellations first, at most
  26/40/88 depending on zoom, fading out below a 14° field.
- **Star names**: proper names down to a magnitude that grows as you zoom in (about 2.0 at a 100° field,
  3.4 at 40°, 4.5 at 20°), never for stars the limiting magnitude hides. Bayer letters for unnamed stars
  appear from a 55° field inwards.
- **Deep-sky symbols**: galaxy = ellipse, open cluster = dotted circle, globular = circle with cross,
  nebula = square, planetary nebula = circle with four ticks, anything else = diamond. Brighter first
  (Messier objects get a head start), more as you zoom; true size once larger than the minimum symbol.
- **Clipping**: stereographic projection blows up behind the viewer. Any line piece with an end further
  than 3× the screen half-diagonal from the centre is dropped (`clipZ` / `isClipSafe`), in the shader
  and on the overlay alike. Because pieces are ≤ 2.5° long this never removes anything visible.

### Milky Way texture

`milkyway.json` contours are filled level by level (even-odd, all rings of a level and all three RA-wrapped
copies in one path), each level adding light, then blurred. Rings that run all the way round the sky (the
two edges of the band in level 1) are closed over the north pole so even-odd leaves the band between them.

### Constellation illustrations

`public/data/constellation-art.json` + `public/art/<Abbr>.webp` (85 drawings, ~320 KiB; built by
`scripts/data/build-art.ts`). Nothing is fetched until the layer is first switched on; the index and all images then
load once per page (shared by every engine) and the compressed blobs are kept so a lost WebGL context can re-upload.

- **Placement** (as in Stellarium): each drawing has three anchor pixels pinned to three stars. `anchorMatrix` solves
  the 3×3 M with M·(x, y, 1)ᵀ = each star's J2000 unit vector; a grid over the image (cells ≈ 3°, 6–40 per side) is
  mapped through M and normalised onto the sphere.
- **Drawing**: one instance per grid cell (four corner vectors, uv rectangle, layer, figure index), transformed in the
  vertex shader with `w = 1 + z` so the texture is perspective-correct; a cell with any corner past the clip distance
  is dropped whole (same rule as line pieces), so nothing streaks. All drawings live in one R8 `TEXTURE_2D_ARRAY` of
  512² layers with mipmaps (256 and 128 px drawings packed four or sixteen to a layer: 43 layers, ~15 MB with mips).
- **Look**: the `--sky-lines` hue lifted towards white, added at ~0.26 × image luminance. Fades with daylight
  (`(1 − day)²`), out below a ~5° field and by 30 % at very wide fields. Constellations with a `constellation`
  highlight, or a selected constellation, are drawn 2.3× brighter.
- Puppis, Vela and Serpens have no drawing of their own: Carina's shows the whole ship Argo Navis and Ophiuchus'
  includes the serpent.

## Highlights (`setHighlights`, replaces all)

Prepared once into unit-vector geometry (≤ 2° steps), then projected each frame on the overlay with a dark
underlay so they read over stars, ground and daylight. Default colour `--sky-highlight`.

| Type | Drawn as |
| --- | --- |
| `constellation` | Thick figure lines (unless `lines: false`); dashed boundary if `boundary`; name if `label`. Works with the line/boundary/name layers off. |
| `object` | Ring (grows with the object's real size), optional name or custom label to its right. |
| `polyline` | Great-circle legs between targets; `closed`, `dashed`; `label` at the centroid. |
| `angle` | Great-circle arc with end dots; separation printed beside the midpoint ("19°", "4.3°", "30′") unless `label` is given. |
| `circle` | Small circle of `radiusDeg`; `label` above its top. |
| `label` | Text at a target (above it for objects, centred for bare points). |
| `trail` | Target position sampled every `stepHours`. `frame: 'stars'` (default) is against the stars (retrograde loops; the body is re-computed per sample). `frame: 'horizon'` is across the local sky (diurnal arcs; sampled at ≤ 10 min internally). `dateLabels` adds dots and at most ~8 labels: clock times for spans ≤ 48 h, dates otherwise, in the observer's time zone. |

Highlights that refer to `body:`, `altaz:` or `point:` targets are re-resolved as the clock moves. Unknown
targets are skipped with one console warning. Highlights are drawn even below the horizon.

Selection (`setSelection`, or a click): a ring that settles onto the object in 0.3 s (instant with
reduced motion); for a constellation, its figure is emphasised instead. `showSelection: false` hides it.

## Interaction

- **navigate**: drag pans (the sky point under the pointer stays under it) with inertia; wheel / pinch zoom
  towards the pointer (eased); double-click or double-tap centres; arrow keys pan and `+`/`−` zoom when
  the view has focus; click or tap picks within 14 CSS px.
  Pick priority: Sun/Moon/planets → named stars and deep-sky objects whose marker is on screen →
  a constellation name (pointer inside its label) → any other visible star. Emits `select`
  (`null` for empty sky). The cursor shows a pointer over pickable things.
- **lasso**: left-drag or one finger draws a freehand loop in amber; on release it is closed, stays on
  screen until `clearLasso()` or the next stroke, and `lasso` is emitted with ≤ 300 CSS-pixel points.
  Wheel/pinch still zoom; right-drag or two fingers pan.
- **none**: no interaction.
- `flyTo(ref, { fov?, durationMs? })`: eased move (900 ms default, instant with reduced motion); keeps the
  current field unless `fov` is given; a new `flyTo`, `setView` or a user drag ends it (the promise still resolves).
- `setView({ mount })` alone keeps looking at the same piece of sky.
- Clock: `timeRate` simulated seconds per real second (0, negative allowed). Sky rotation is refreshed
  when simulated time moves 0.15 s, bodies when it moves 20 s. `time` and `view` events are throttled to
  10 Hz with a trailing emit.
- **Idle = no work**: frames are drawn only when something changed. With the clock running slowly the
  engine sleeps until the sky has turned about a third of a pixel (at most 1 s).
- `project(ra, dec)` → CSS px + `visible` (on screen and, with ground on, above the horizon);
  `unproject(x, y)`; `getSize()`; `getFps()` (frames in the last second of activity; keeps its last
  value while idle).
- Device pixel ratio capped at 2, `ResizeObserver`, WebGL context loss/restore handled, `destroy()` frees
  every GL object, listener and timer and removes the canvases.

## Dev harness and checks

```
npx vite --port 5199 --strictPort        # then open /sky-dev.html
node scripts/sky/check.mjs               # errors, screenshots → docs/sky-shots/, correctness (19 checks)
node scripts/sky/perf.mjs                # performance numbers below
npx vitest run tests/sky-                # 35 unit tests (camera, appearance, picking, geometry)
```

Correctness checks (Brooklyn, 2026-11-10T02:00Z) compare against astronomy-engine's own `Horizon` results
and a projection written out separately in the script:

- Polaris: `project()` agrees with astronomy-engine's alt/az to < 0.001°. Polaris itself is at altitude
  41.14°, 0.55° east of north, because it sits about 0.65° from the pole; the pixel at exactly due north,
  altitude 40.68° un-projects to the celestial pole.
- Facing south, east is left and west is right; Betelgeuse is upper-left of Rigel on the meridian.
- Moon, Sun and planets: < 0.001° from astronomy-engine, and clicking the reference pixel picks each body.
- Drag, wheel-zoom anchoring, flyTo, lasso, StrictMode, idle (0 frames in 1 s), no console or WebGL errors.

## Performance

**The 60 fps budget is met by design, backed by the measurements below. It has not been measured on real
laptop hardware:** this sandbox only has software GL (SwiftShader), which rasterises every pixel on the CPU.

Design: static GPU buffers; one matrix per frame; limiting magnitude = draw count; no per-frame geometry
uploads; per-frame CPU work is label/marker placement for at most ~2,000 candidate stars, 597 deep-sky
objects and 88 constellations with early exits; text is stamped from an atlas; typed-array scratch
buffers; no rendering while idle.

Measured with `scripts/sky/perf.mjs`: 1280×800, DPR 1, 5 s scripted continuous pan + zoom after a 2 s warm-up.

| Scenario | Main-thread script per frame (Chrome trace) | Layout + paint per frame | Engine frame, in-page median | Draw calls | Vertices | fps under SwiftShader |
| --- | --- | --- | --- | --- | --- | --- |
| 8,834 stars, default layers | 2.2 ms | 0.08 ms | 3.1 ms | 7 | 16,876 | 6.4 |
| 28,495 stars, default layers | 2.3 ms | 0.09 ms | 5.3 ms | 8 | 36,537 | 6.1 |
| 28,495 stars, every layer + 10 highlights | 3.7 ms | 0.13 ms | 10.2 ms | 12 | 89,289 | 3.3 |

Constellation illustrations (9k stars, default layers, same run twice; the sandbox was shared with other jobs, so
absolute numbers drifted): +1 draw call, +30,304 vertices (7,576 instanced cells), WebGL command time 0.5 ms with or
without the layer, main-thread script per frame within run-to-run noise (4.2–5.6 ms in both). SwiftShader fps drops
(about 4 → 2) because the extra full-sky additive fill is rasterised on the CPU; on a GPU that fill is trivial.

Reading these honestly:

- The trace figures meet the < 4 ms target. The in-page medians are wall-clock times taken while
  SwiftShader's raster threads occupy every core, and the 2D canvas is also software-rasterised here; in
  the last two rows they are above 4 ms. With a still field of view the overlay measured 0.4 ms per frame.
  Which figure a real laptop lands nearer to is not known from this sandbox.
- Almost all of the script time is the 2D overlay; issuing the WebGL commands takes 0.6–0.9 ms.
- The low fps is SwiftShader filling two full-screen shader passes on the CPU. It says nothing useful
  about a GPU, where those passes are the cheap part.
- Not measured: fill-rate at DPR 2 on an integrated GPU. The two full-screen passes do one `atan` and one
  `asin` per pixel when the Milky Way is on; if that ever proves heavy, turning the Milky Way layer off
  removes them.

## Known limitations

- No refraction, no extinction near the horizon, no Moon-glow washing out stars.
- Galaxy ellipses use the catalog's axis ratio but a fixed tilt (the data has no position angle).
- Saturn has no rings; the Moon has no surface markings (no image textures are used).
- Uranus and Neptune are always drawn at night, whatever the limiting magnitude.
- Label collision is greedy and recomputed each frame, so a label can swap sides while panning.
- Highlight labels dodge each other only vertically; a very crowded set can still overlap.
- Faint stars (`stars-faint.json`) are render-only: no labels, not pickable.
- Trails are capped at 3,000 samples (the step is widened beyond that).
- Trail date labels use the observer's time zone, so a trail starting at 00:00 UTC reads as the evening before in New York.
- `getFps()` reports the last active second; it does not fall to 0 when the view goes idle.
