# Requests from the ecliptic-unit figure author

1. **Shared helper module in `figures/diagrams/`.** My 21 diagrams share astronomy wrappers (J2000 ecliptic positions,
   zodiac boundary longitudes, sunrise/day length for the learner's location, rise/set intervals, time-zone formatting)
   and a phase-shape path (`litPath`, a lit sphere seen at any phase angle). They live in
   `src/modes/learn/figures/diagrams/ecliptic-common.ts`. The registry only globs `*.tsx`, so this `.ts` file is not
   treated as a diagram. If other authors want `litPath` or `useObserver`, consider moving them into `kit.tsx`.
2. **Kit: two-line callout labels.** Several figures needed a label split over two lines (e.g. "greatest eastern /
   elongation"); I used two `Label`s. A `lines` prop on `Label` would help.
3. **Kit: text without a halo.** `Label` always gets the `fig-label` halo; a label drawn on a filled shape (the "Sun"
   on the scale model's Sun disc) needs a plain `<text>`, which I wrote by hand. An `halo={false}` option would avoid that.
4. **Learn (not mine), seen while testing:** for a few minutes `src/modes/learn/logic/course.ts` threw
   "Cannot read properties of undefined (reading 'includes')" in `lessonPlace`, which blanked every lesson page. It was
   fixed by the time I finished, but a guard for a lesson missing from `path.json` would make lesson pages robust to it.
