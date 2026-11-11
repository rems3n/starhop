# Brief: make all written content location-neutral

The client: "it seems kind of random and customized to myself/my chat (e.g. Brooklyn, starting with winter, etc). This
app should be for anyone." The app now asks every learner for their location (`useSettings().observer`) and
computes what's visible from there. The written content still says "from Brooklyn", "at 40°N", "New York", and
assumes northern seasons. Fix the words — keep every fact true.

Read docs/CONTENT-BRIEF.md (rules still apply: never fabricate, refs must resolve, plain text), docs/briefs/v2.md
("Location-neutral rules"), and `src/content/schema.ts`.

## How to rewrite

- **Never name the client's city.** Replace "Brooklyn"/"New York"/"40°N"/"40.7°" with the general truth:
  - Visibility by latitude: "It never rises north of about 49°N" / "From mid-northern latitudes (the US, Europe,
    Japan) it stays low in the south; from the southern hemisphere it passes high overhead." Compute the latitude
    limits from declination: an object at declination δ never rises for observers north of latitude 90° + δ (δ < 0)
    and is circumpolar for observers north of 90° − δ. Round sensibly ("about").
  - Light pollution: "from a big city", "from a suburb", "under a dark rural sky" instead of Brooklyn.
  - Times: say "in the evening", "around midnight", "before dawn"; when a clock time is needed say "around 9 pm
    local time".
- **Seasons by months, and both hemispheres.** "Best on December–February evenings" rather than "a winter
  constellation". Where a season word adds meaning, write "northern winter (southern summer)". Don't call
  Scorpius "a summer constellation" without saying it is the southern winter's showpiece too.
- **Directions depend on hemisphere.** "Low in the south" is true only for northern observers. Write "low toward
  the equator side of the sky (south for northern observers, north for southern ones)" sparingly — usually better:
  "From mid-northern latitudes it is low in the south; from the southern hemisphere it is high overhead."
- **Hand-span distances, star names, myths, history: unchanged.** Don't rewrite text that has no location in it.
- **Templates:** where a number really should be the learner's own, you may use these tokens, which the app fills
  in at render time (they work in any lesson/constellation/object text field):
  `{{place}}` (e.g. "Sydney, Australia"), `{{lat}}` (e.g. "34°S"), `{{poleAltitude}}` (e.g. "34°"),
  `{{pole}}` ("north celestial pole" / "south celestial pole"), `{{poleStar}}` ("Polaris" / "the south celestial
  pole (no bright pole star)"), `{{equatorSide}}` ("south" / "north"), `{{circumpolarLimit}}` (e.g. "+56°": stars
  north of this declination never set — for southern observers "−56°" and south of it).
  Use them only where they make the sentence clearly better, and never inside `[[ref|label]]` links.
- Keep `questions`/`check` answers correct for every learner: if a question's answer depends on latitude, rewrite
  it to be location-independent (e.g. "From latitude 40°N, Polaris stands about how high?" is fine — it states the
  latitude in the question).

Validate after each file (`npm run validate -- <file>`). At the end, `grep -nE "Brooklyn|New York|40°N|40\.7"`
over your files must return nothing except where a sentence deliberately uses 40°N as a worked example inside a
question that states it.
