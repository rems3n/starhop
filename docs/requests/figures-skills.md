# Requests from the skills-unit figure author

Nothing here blocks the figures; each item is worked around locally.

1. **Allow `@/types` in diagrams (or export `BORTLE` from the kit).** `magnitude-ruler.tsx` and
   `little-dipper-gauge.tsx` need the Bortle → limiting-magnitude table. Diagrams may import only the kit,
   astronomy-engine, `@/astro`, `@/data/catalog` and `@/store/settings`, so the table is copied locally with a
   comment. If `BORTLE` changes, those two copies must change too.
2. **Kit: pointer-to-viewBox helper for draggable diagrams.** `alt-az-dome.tsx` implements dragging locally
   (wrapper div with pointer handlers, client → viewBox conversion via `getBoundingClientRect`). A shared
   `useSvgPointer()` in the kit would save other authors from repeating it.
3. **Kit colours for a few non-theme hues.** Used as raw values because `C` has no equivalent: spectrum strip
   (`rod-cone-sensitivity`, computed `hsl()`), skin tone for hands (`hand-angle-geometry`, `hand-on-dipper` uses `C.amber`
   instead), warm sky-glow orange (`skyglow`, `airmass-glow`, `little-dipper-gauge`, `point-vs-diffuse`), nebula pink
   (`point-vs-diffuse`), building/ground fills (`#141a33`, `#262d4f`, as in the exemplars). Suggest `C.skin`, `C.glow`,
   `C.ground`.
4. **Kit `Svg` defs ids are global** (`fig-arrow`, `fig-glow`): every diagram on a page re-declares them. Harmless
   while they are identical, but a per-instance id (via `useId`) would be safer.
5. **Lesson body text still names Brooklyn** in these lessons (e.g. cardinal-directions S0/S1, hand-angles S1,
   light-pollution heading "What still works from Brooklyn"). Per the coordinator, the location pass will handle body
   text; my captions and boxes are location-neutral.
