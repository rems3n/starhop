# v2 sky-embed: notes and requests

`<SkyEmbed>` (src/components/sky-embed) is in use. The props contract is unchanged. These items are for other owners.

## How it behaves (for page authors)

- `onReady` gives you a thin wrapper around the engine controller. Whatever **your page** last set through it
  (layers, limiting magnitude, view, time, rate, observer, highlights, selection) is what the embed's Reset puts back.
  Changes the learner makes in the embed are never written to the settings store, and your next `setLayers` /
  `applyScene` always wins.
- After Reset the embed root dispatches a bubbling `SKY_EMBED_RESET_EVENT` (`'skyembed:reset'`). Listen for it if
  you keep UI state that should clear too (Learn's `SkyStage` does this to call its `onReset`).
- Placement: the toolbar sits top-right. A page can move it with CSS custom properties through `style`:
  `--se-bar-top`, `--se-bar-shift` (translateY) and `--se-panel-top` (the quiz centres it on the right edge).
- Below 560 px wide the panel becomes a bottom sheet inside the embed (max 60% of its height).

## Requests

1. **IA / course (src/modes/learn/**)**: `src/modes/learn/pages/ConstellationPage.tsx` is now unreachable
   (`/learn/constellation/:id` redirects to the library). I removed its "Star names / Boundary" switches in favour of
   the embed. Delete the file when convenient. `exploreHref` in `learn/hooks.ts` is no longer used by `SkyStage`.
2. **Library (src/modes/library/components/LibSky.tsx)**: already on `SkyEmbed`. Its embed Reset restores the
   scene through the tracked controller, so nothing is needed. If library pages keep local UI state tied to the sky
   (e.g. a selected main star or hop), listen for `SKY_EMBED_RESET_EVENT` to clear it.
3. **Practice (src/modes/quiz/**)**: the quiz uses `controls="limited"` with `quizAllowedLayers(diff, q.kind)`
   (exported from `@/components/sky-embed`). If a new sky question kind is added (e.g. star-hop), it gets lines /
   boundaries per difficulty, the Milky Way and the guide grids, but never names, ground, horizon or atmosphere
   unless the function is extended for it.
4. **Explore (src/modes/explore/SkyPanels.tsx)**: the light-pollution hint still says "Brooklyn is roughly
   Bortle 8–9", which breaks the location-neutral rule. The embed's groups mirror `LAYER_GROUPS`; if those labels
   change, update `EMBED_LAYER_GROUPS` in `src/components/sky-embed/layers.ts` too (or import one from the other).
