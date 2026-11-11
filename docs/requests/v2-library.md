# Requests from the Library engineer (v2)

1. **Shared object panel** (`src/components/object/ObjectInfo.tsx`, owner: Explore/shared components): it still hand-writes
   `/quiz/find?con=…` (line ~337) and `#/explore?target=…` (line ~282). Please switch these to `routes.quiz('find', { con })` and
   `routes.sky(ref)`. The library object pages (`/library/object/:ref`) render this panel.
2. **`RichText` default link** (`src/ui/index.tsx`, owner: UI): the default "show in sky" action navigates to `/explore?target=…`.
   Please use `routes.sky(ref)`. Library pages that have a sky pass their own `onTarget`, but pages without one rely on the default.
3. **Practice engineer**: the library links to `routes.quiz('story', { story: storyId })` (each myth page),
   `routes.quiz('starhop', { hop: id })` (each star-hop page) and `routes.quiz('starhop')` (star-hop list). Please make sure all
   three deep links are handled.
4. **IA/course engineer**: FYI, I made one small edit to `src/modes/learn/pages/ConstellationPage.tsx` (which `/library/constellation/:id`
   reuses): the Stories section has an aside link to the myth library filtered to that constellation, and each story title links to
   `routes.myth(story.id)`. Nothing else changed.
5. **Data owner**: in `public/data/stars.json` some named stars carry the spectral type of a companion or an odd value
   (Capella `M1: comp` with B−V 0.80, Dubhe `F7V comp` with B−V 1.06, Almach `B8V` with B−V 1.37, Izar `A0` with B−V 0.97, about 13
   named stars in all). The library's colour column uses B−V when present for this reason; the spectral-class filter still uses the
   letter from `sp`, so Capella appears under M.
6. **App shell**: `/favicon.ico` returns 404 on every page (console error in headless checks).
