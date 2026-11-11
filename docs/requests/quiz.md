# Requests from Quiz (src/modes/quiz)

1. **Sky engine: planet and deep-sky labels cannot be switched off on their own.** `LayerState` has
   `constellationNames` and `starNames` but the `planets` and `dsoMarkers` layers always print names, which gives
   the answer away in "Which planet is this?" / "Which object is marked?". Quiz works around it by turning both
   layers off and drawing its own ring/dot over the sky (`SkyMarker` in `SkyStage.tsx`). Wanted: a
   `planetNames` / `dsoNames` flag in `LayerState` (or have `starNames: false` cover them).
2. **Sky engine: `flyTo` has no screen padding.** Quiz screens float a prompt panel over the top of the sky and an
   action bar over the bottom, so a figure centred by `flyTo` can sit partly under the prompt. Quiz flies a little
   wider than the fit to compensate. Wanted: `flyTo(ref, { fov, durationMs, padding: { top, bottom, left, right } })`
   in CSS px, centring the target in the uncovered area.
