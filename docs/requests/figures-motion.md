# Requests from the motion-unit figure author (kit.tsx not edited)

Implemented locally in `src/modes/learn/figures/diagrams/_motion-sky.ts`; consider promoting to `kit.tsx`:

1. **`useObserver()` + place presets** (`placeOptions`, `placeOf`): a "You (lat)" preset from settings plus
   North Pole / Tromsø / Equator / Sydney / South Pole. Several authors will need latitude sliders.
2. **`localDate(y, m, d, h, tz)` / `tzOffsetMin`**: "9 pm local time on the 15th" for any IANA zone.
3. **Projection helpers**: `hadecToAltAz`, `altAzToHaDec`, `makeStereo` (horizon-level stereographic view).
4. **A compact select control** for long option lists: `ChoiceControl` with 6–7 options wraps to two rows on
   a phone (sky-zones-latitude "Follow a star", the "Go to" presets).
5. **Diagram helpers that are not diagrams**: please keep the registry glob at `./diagrams/*.tsx` (helper is
   `.ts`), or allow a `_` prefix to be skipped explicitly.
