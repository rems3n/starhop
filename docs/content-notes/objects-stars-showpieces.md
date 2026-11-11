# Notes: objects/stars.json, objects/solar-system.json, objects/showpieces.json

## Files
- `src/content/objects/solar-system.json` — 9 entries (body:Sun … body:Neptune). howToFind is timeless; Sun entry carries the solar-safety warning.
- `src/content/objects/stars.json` — 92 entries keyed `star:<IAU name>`; Gamma Velorum ("Regor", not an IAU name, absent from the catalog's names) is keyed `star:γ2 Vel`.
- `src/content/objects/showpieces.json` — 66 entries. Catalog ids used for specials: `dso:Mel25` (Hyades), `dso:Cr399` (Coathanger), `dso:LMC`, `dso:SMC`, `dso:C99` (Coalsack), `dso:B33` (Horsehead), `dso:NGC2237` (Rosette), `dso:IC1805` (Heart), `dso:IC1848` (Soul), `dso:NGC6960`/`dso:NGC6992` (Veil west/east).

## Sources
- English Wikipedia, fetched 2026-11-10 through the API in batches (wikitext via `prop=revisions`, 50 titles/request, plus `prop=extracts&exintro`, 20 titles/request; User-Agent "StarhopContent/1.0 (educational)"; backed off on HTTP 429, which was frequent). One article per star (by Bayer-designation title, following redirects), per planet/Sun/Moon, and per deep-sky object. Used for: spectral class, distance, radius/luminosity, name etymology, double-star separations and magnitudes, variable periods and ranges, cluster/nebula/galaxy distances and sizes.
- Distances not stated in an article's lead were taken from the catalog (HYG v4.1, Hipparcos-based) and rounded.
- `physicalSize` is given only where the Wikipedia infobox/article gives a size or radius.

## Star-hop geometry
- Separations and directions were computed from HYG v4.1 and OpenNGC coordinates (the same sources the catalog is built from), then re-checked against `public/data` with the script saved beside this file as `objects-hop-check.ts.txt` (run with `npx tsx`): it resolves every key and every inline link through `buildCatalog` and prints the separation and direction of the target from each linked star. All directions in the text were compared with that output.
- Conventions in the text: fist at arm's length ≈ 10°; finger-width ≈ 2°; north = +Dec, east = increasing RA. "Never rises from Brooklyn" is used for declination south of −49°; objects between about −36° and −49° are described as very low / practically out of reach, with their maximum altitude (90° − 40.7° + Dec).

## Validation
`npm run validate -- objects/stars objects/solar-system objects/showpieces` → 0 errors, 0 warnings with the catalog present (all keys and links resolve, including NGC 281 and NGC 1365).

## Left out or hedged because uncertain
- Nunki: name origin (Babylonian) not confirmed in the text fetched — omitted. Sargas: only "of Sumerian origin, meaning unknown". Kochab, Miaplacidus: origin stated as uncertain. Scheat: etymology omitted (Wikipedia gives alternatives). Albireo: stated as a product of mistranslation, no meaning. Pollux, Castor, Alcyone, Bellatrix(Latin), Canopus: no Arabic etymology given; Canopus etymology omitted (speculative).
- Distances that sources disagree on are given as ranges or "roughly": Betelgeuse (400–600 ly), Deneb (~2,000 ly), Alnilam (1,200–2,000 ly), Algenib (400–470 ly), Acrux (320–350 ly), Polaris (430–450 ly), Saturn Nebula, Blue Snowball, California Nebula, NGC 1365, NGC 663, NGC 1502, NGC 2362.
- Luminosities are rounded heavily ("several hundred", "tens of thousands") because Wikipedia's figures vary between revisions.
- "Regor" story (Roger Chaffee / Apollo 1) is worded "said to have been coined"; Enif's reported 1972 flare, Antares companion details, Mirach's Ghost details beyond the name, and exact star counts for most clusters were omitted.
- NGC 6752 "usually ranked fourth" brightest globular — hedged.
- Wikipedia article "Melotte 15" does not exist; nothing depends on it.
