# Notes: skills lessons and asterisms

Files: `src/content/lessons/{dark-adaptation,cardinal-directions,hand-angles,star-hopping,reading-magnitude,altitude-azimuth,light-pollution}.json`, `src/content/asterisms.json`.

## How numbers were checked

- Angular separations: great-circle separation from J2000 coordinates in HYG v4.1 (`scripts/data/raw/hyg-v41.csv`), then every `angle` highlight label in my files re-checked against `public/data/stars.json` / `dsos.json` through `buildCatalog().resolve()` (tolerance 0.8°): 0 mismatches.
- Altitudes/azimuths, sunrise azimuths, noon altitudes: `astronomy-engine`, observer 40.6782°N 73.9442°W.
- Star counts: counted in HYG v4.1.

## Computed separations (degrees)

Big Dipper: Dubhe–Merak 5.4; Dubhe–Megrez 10.2; Megrez–Phecda 4.5; Merak–Phecda 7.9; Dubhe–Alkaid 25.7; Mizar–Alcor 0.2; Dubhe–Polaris 28.7 (line Merak→Dubhe misses Polaris by 1.9); Alioth–Polaris 34.7, Polaris–γ Cas 28.6 (straight, bend 0°); Polaris–Errai 11.8 (bend 5° from Pointer line); Mizar–Thuban 10.7, Thuban–Kochab 10.6; Alkaid–Arcturus 30.7; Megrez→Phecda→Regulus 46.7 (bend 4°); Megrez→Merak→Castor 43.1 (bend 1°); Castor–Pollux 4.5; Phecda–Alula Borealis 21.5; Merak–Tania Borealis 15.2; Merak–Talitha 20.3; Dubhe–Muscida 18.2; pairs: Alulas 1.6, Tanias 1.7, Talitha–κ UMa 1.2.
Little Dipper: Polaris–Kochab 16.6; Polaris–Pherkad 18.9; Kochab–Pherkad 3.2. Magnitudes: Polaris 1.97, Kochab 2.07, Pherkad 3.00, ε 4.21, ζ 4.29, Yildun 4.35, η 4.95.
Cassiopeia: Caph–Segin 13.3; Polaris–Caph 30.3.
Orion/Hexagon: Belt (Alnitak–Mintaka) 2.7; Betelgeuse–Rigel 18.6; Betelgeuse–Alnilam 9.8; Rigel–Alnilam 8.8; Alnitak–Sirius 21.7 (line off by 2.6); Mintaka–Aldebaran 21.8 (line passes 5.2 south of Aldebaran); Aldebaran–M45 13.8; Betelgeuse–Procyon 26.0; Sirius–Procyon 25.7; Sirius–Betelgeuse 27.1; Betelgeuse–Castor 33.7 (bend 7° from Rigel→Betelgeuse), Betelgeuse–Pollux 33.2; Alnilam–Elnath 29.9, Elnath–Capella 17.5 (bend 1°); Capella–Mirfak 19.1; M45–Mirfak 26.1; hexagon sides Sirius–Procyon 25.7, Procyon–Pollux 22.8, Castor–Capella 30.0, Capella–Aldebaran 30.7, Aldebaran–Rigel 26.5, Rigel–Sirius 23.7; Sirius–Capella 65.8.
Spring: Arcturus–Spica 32.8; Arcturus–Izar 10.4, –Seginus 19.5, –Nekkar 23.4; Arcturus–Alphecca 19.7; Alphecca–ζ Her 15.3 (bend 4°); Arcturus–Vega 59.1 (Alphecca at 19.7, ζ Her at 35.0 along it); Arcturus–Denebola 35.3, Spica–Denebola 35.1; Denebola–Regulus 24.6; Algorab–Spica 14.5 (γ Crv→Algorab line hits Spica within 0.6); Alkaid–Cor Caroli 14.4. Sickle: Regulus–μ Leo 14.5.
Summer: Vega–Deneb 23.8; Vega–Altair 34.2; Deneb–Altair 38.0; Vega–Sheliak 6.0, –Sulafat 7.6; Deneb–Albireo 22.3; Aljanah–Fawaris 16.2; Altair–Tarazed 2.1, –Alshain 2.7; Vega–π Her 16.3; Keystone sides 6.7/7.3/4.1/6.6; η Her–M13 2.5; Altair–Nunki 37.7 (bend 6° from Deneb→Altair); Vega–Rasalhague 29.6, Rasalhague–Antares 42.1 (bend 3°); Antares–Alnasl 21.5; Altair–Sualocin 13.8; Altair–γ Sge 10.8; Vega–Eltanin 14.5 (bend 8° from Altair→Vega); Eltanin–Rastaban 4.1. Teapot: Alnasl–Ascella 12.3; Kaus Borealis–Kaus Australis 9.0.
Autumn: Square sides 12.9/14.2/14.0/16.5; Markab–Homam 7.2, Markab–Enif 20.4; Alpheratz–Mirach 14.5; Mirach–Almach 12.5; Mirach–μ And 3.9, μ And–M31 3.9 (straight); Almach–Mirfak 15.8 (bend 7°), Almach–Algol 12.1; Alpheratz–Caph 30.1 (bend 5° from Algenib→Alpheratz), Caph–Polaris 30.3; Alpheratz–Hamal 27.1 (bend 5° from Scheat→Alpheratz); Hamal–Sheratan 3.9; Mirach–Hamal 17.4; Markab–γ Psc 12.3; Markab–Fomalhaut 44.9 (bend 3°).
Southern Cross: Gacrux–Acrux 6.0; Acrux to south celestial pole 26.9 (4.5 × long arm); Hadar–Rigil Kentaurus 4.4; Hadar–Mimosa 9.5; Acrux dec −63.1 → rises only south of 26.9°N.

## Brooklyn sky checks (astronomy-engine)

- Sunrise azimuth: 20 Mar 89°, 21 Jun 58°, 21 Dec 121°. Noon altitude: 73° / 49° / 26°. Solar noon ≈ 12:57 EDT (June), 11:54 EST (December).
- Polaris 0.62° from the pole of date (2026); altitude ≈ 41°. Polaris is the 48th brightest star in HYG.
- Demo times checked for target altitude: Apr 15 21:00 (Dipper 47–70°), May 15 22:00 (Arcturus 60°, Spica 37°), Jan 15 21:00 (Orion 41–53°, Sirius 26°, Pleiades 70°), Feb 15 20:00 (Sirius 31°, Procyon 47°, Aldebaran 61°), Jul 15 22:00 (Little Dipper bowl 54–57°), Aug 15 21:00/22:00/23:00 (Altair 47°/55°/58°, az 129°/149°/175°), Dec 15 21:00 (Pleiades 69°).
- Star counts (whole sky): mag ≤ 3.8: 414; ≤ 4.8: 1,295; ≤ 6.5: 8,920.
- Magnitude ratios: Sirius vs Polaris 23.6×; Sirius vs mag 6.5: 1,528×.

## Sources read

- Wikipedia (API, this session): "Adaptation (eye)" (cones 9–10 min, rods 30–45 min, eye 20–30 min overall; rods insensitive to long wavelengths; rods sparse in fovea), "Bortle scale" (John E. Bortle, Sky & Telescope, February 2001; classes 1–9), "Apparent magnitude" (Pogson 1856, ratio 2.512, Sirius −1.46, full Moon −12.74, Sun −26.83, naked-eye limit ≈ 6.5).
- HYG v4.1 for star magnitudes, distances (Sirius 8.6 ly) and absolute magnitudes (Sirius 1.45, Sun 4.85).
- Bortle class → limiting magnitude follows the app's own `BORTLE` table in `src/types.ts`.

## Not verified against a fetched source (general knowledge)

- Wikipedia "Averted vision" and "Absolute magnitude" fetches were rate-limited; averted vision and the 10 parsec = 32.6 light-year definition are standard but were not re-read this session.
- Hand-width angles (1°, 5°, 10°, 20–25°) are the standard rule of thumb; only the Dipper calibration distances were computed.
- "Three leaps of the gazelle" as the Arabic name for the three star pairs of Ursa Major's paws.
- Typical Bortle classes for suburbs/rural areas, and Brooklyn as class 8–9.
- Planet magnitudes are given only as ranges (Jupiter −2 to −3, Venus about −4 or brighter).

## Conventions used in asterisms.json

- Closed figures (hexagon, triangles, Great Square, Keystone) list each corner once with `closed: true`; open or multi-line figures have `closed: false` and explicit lines.
- `southern-cross.bestMonths` is `[]` because the field means evening months at mid-northern latitudes and the Cross never rises there.
- Cor Caroli is referenced as `star:α2 CVn` (see docs/requests/content-skills.md).
