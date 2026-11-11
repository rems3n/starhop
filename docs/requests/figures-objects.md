# Requests from the objects-unit figure author (kit.tsx not edited)

Implemented locally; consider promoting to `kit.tsx`:

1. **Photo credits inside diagrams.** `stellar-life-paths`, `hubble-sequence` and `eye-vs-camera` draw shipped
   photos with SVG `<image>` and print their credits in a `<p className="fig-credit">` under the readout. A kit
   `PhotoCredits` component (same format as `Figure.tsx`'s `Credit`) would keep this consistent.
2. **Blackbody colour** (`tempColor(T)` in `diagrams/_objects-lib.ts`): Planck + CIE → sRGB. Useful to any author
   colouring stars; could live in the kit or `src/lib`.
3. **Unique SVG ids.** Several diagrams use fixed `<defs>` ids (fine while each diagram appears once per screen).
   A kit `useSvgId()` helper would make two copies of one diagram on the same screen safe.
4. Same as figures-motion: please keep the registry glob at `./diagrams/*.tsx` so `_objects-lib.ts` is not treated
   as a diagram.
