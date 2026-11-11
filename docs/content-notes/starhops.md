# Star-hop library notes (src/content/starhops.json)

27 hops, rank 1 = most widely taught. Hemisphere split: 9 N only, 6 S only, 12 both.

## Sources consulted

- Project files: `src/content/lessons/star-hopping.json` (existing pointer/arc demos), `src/content/asterisms.json`
  (signpost ids used in `from`/`to` and inline links), `public/data/stars.json` and `dsos.json` (all positions,
  magnitudes and distances quoted).
- Popularity ranking: a web search (Nov 2026) on beginner star-hopping guides returned, among others, BBC Sky at Night
  ("How to star-hop the night sky", skyatnightmagazine.com), High Point Scientific ("Star Hopping 101" and "Top 10 Star
  Hopping Targets"), Space.com ("easiest star hops for beginners") and the Irish Astronomical Society ("Starhopping for
  Beginners"). These were used only to confirm which hops are standard (Pointers to Polaris, arc to Arcturus/Spica,
  Belt to Sirius/Aldebaran, Southern Cross and Pointers to the pole); the pages were not read in full and no wording
  was taken from them. The order of ranks 11–27 is an editorial judgment.
- No external facts beyond common knowledge and the catalog: object facts used are Canopus second-brightest star
  (catalog mag −0.62), Aldebaran 66.6 ly vs Hyades 151 ly (catalog), Albireo gold/blue double, the False Cross,
  the Kids beside Capella, the Coalsack as a dust cloud. Galactic center = Sgr A* J2000 (RA 17h45m40s, Dec −29°00′28″)
  → `radec:266.417,-29.008`.

## Ranking decisions

Top 10 follows the brief's order except the Southern Cross → south celestial pole hop, moved from 7 to 5: it is the
southern counterpart of rank 1, appears in every southern-sky beginner guide, and putting it in the top five keeps a
southern hop in the first screen of the list.

## Method

Script (scratchpad, not committed): reads `public/data/*.json` through `buildCatalog`, so refs resolve exactly as in the
app. Separations are great-circle angles between catalog J2000 positions; `distanceDeg` = sum of legs along `path`.
Pointer quality was checked as the cross-track offset of the target from the great circle through the pointer pair;
pairs were chosen for the smallest offset (e.g. Alnilam→Meissa for Capella, 2.4°; Algenib→Alpheratz→Caph for Polaris,
0.3° at Polaris; Megrez→Merak for Castor, 0.6°). Notable misses stated in the text: Merak→Dubhe misses Polaris by 1.9°;
Mintaka→Aldebaran line misses by 5.2°; Cassiopeia's V points about 13° off M31 (≈3.5° miss), so the step says "about".
Pointers' perpendicular bisector passes 2.9° from the south celestial pole (step says "within a few degrees").

Visibility: astronomy-engine, observers at 40°N 0°E and 34°S 0°E (so UT = local mean time), the 15th of each month
of 2026 at 21:00; if the Sun is above −12° then, the first 5-minute step after it reaches −12°. A month counts when
every path point is ≥ 15° up; the target only needs ≥ 10° when its highest possible altitude from that latitude is
< 30° ("intrinsically low", marked (low) below). J2000 positions were used without precession (≈0.4° error, negligible).

| Rank | id | path | legs (°) | total | months 40°N | months 34°S | hemi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | pointers-to-polaris | Merak → Dubhe → Polaris | 5.4 + 28.7 | 34.1 | 1,2,3,4,5,6,7,8,12 | — (low) | N |
| 2 | arc-to-arcturus-spica | Alioth → Mizar → Alkaid → Arcturus → Spica | 4.4 + 6.7 + 30.7 + 32.8 | 74.5 | 4,5,6,7 | — | N |
| 3 | belt-to-sirius | Mintaka → Alnilam → Alnitak → Sirius | 1.4 + 1.4 + 21.7 | 24.4 | 1,2,3 | 1,2,3,12 | both |
| 4 | belt-to-aldebaran-pleiades | Alnitak → Alnilam → Mintaka → Aldebaran → M45 | 1.4 + 1.4 + 21.8 + 13.7 | 38.2 | 1,2,3,12 | 1,2,12 | both |
| 5 | southern-cross-to-pole | Gacrux → Acrux → scp | 6 + 26.9 | 32.9 | — (low) | 1,2,3,4,5,6,7,8 | S |
| 6 | dipper-to-regulus | Megrez → Phecda → Regulus | 4.5 + 46.7 | 51.2 | 2,3,4,5,6 | — | N |
| 7 | cassiopeia-to-andromeda-galaxy | γ Cas → Schedar → M31 | 4.7 + 15.3 | 20 | 1,2,8,9,10,11,12 | — (low) | N |
| 8 | pointers-to-southern-cross | Rigil Kentaurus → Hadar → Gacrux | 4.4 + 12.4 | 16.8 | — (low) | 2,3,4,5,6,7,8 | S |
| 9 | summer-triangle | Vega → Deneb → Altair | 23.8 + 38 | 61.9 | 7,8,9,10,11 | — | N |
| 10 | dipper-to-castor-pollux | Megrez → Merak → Castor → Pollux | 10.1 + 43.1 + 4.5 | 57.7 | 1,2,3,4,5 | — (low) | N |
| 11 | shoulders-to-procyon | Bellatrix → Betelgeuse → Procyon | 7.5 + 26 | 33.5 | 1,2,3 | 1,2,3 | both |
| 12 | great-square-to-andromeda-galaxy | Alpheratz → δ And → Mirach → μ And → M31 | 6.9 + 7.9 + 3.9 + 3.9 | 22.6 | 1,8,9,10,11,12 | 11 (low) | both |
| 13 | great-square-to-fomalhaut | Scheat → Markab → Fomalhaut | 12.9 + 44.9 | 57.7 | 9,10,11 (low) | 9,10,11 | both |
| 14 | pleiades-to-hyades | M45 → Mel25 → Aldebaran | 12.4 + 2.3 | 14.6 | 1,2,3,11,12 | 1,2,12 | both |
| 15 | orion-to-capella | Alnilam → Meissa → Capella | 11.1 + 36.3 | 47.4 | 1,2,3,12 | — (low) | N |
| 16 | vega-to-albireo | Vega → Albireo | 15.6 | 15.6 | 6,7,8,9,10,11 | 8 (low) | both |
| 17 | antares-to-galactic-center | Antares → Kaus Media → Alnasl → 266.417,-29.008 | 24.8 + 3.3 + 4.6 | 32.7 | 7,8 (low) | 5,6,7,8,9 | both |
| 18 | sirius-to-canopus | Sirius → Canopus | 36.2 | 36.2 | — (low) | 1,2,3,4,12 | S |
| 19 | arcturus-to-m13 | Arcturus → Alphecca → ζ Her → M13 | 19.7 + 15.3 + 4.9 | 39.8 | 4,5,6,7,8 | 6,7 (low) | both |
| 20 | cassiopeia-to-double-cluster | γ Cas → Ruchbah → NGC869 → Mirfak | 3.6 + 7.6 + 12.1 | 23.3 | 1,2,3,9,10,11,12 | — (low) | N |
| 21 | corvus-to-spica | Gienah → Algorab → Spica | 3.5 + 14.5 | 18 | 4,5,6 | 3,4,5,6,7 | both |
| 22 | great-square-to-polaris | Algenib → Alpheratz → Caph → Polaris | 14 + 30.1 + 30.3 | 74.3 | 1,9,10,11,12 | — (low) | N |
| 23 | leo-to-coma-cluster | Regulus → Denebola → Mel111 | 24.6 + 14.3 | 38.9 | 2,3,4,5,6 | 4,5 (low) | both |
| 24 | scorpion-stinger-to-m7-m6 | Lesath → Shaula → M7 → M6 | 0.6 + 4.7 + 3.8 | 9.1 | — (low) | 5,6,7,8,9,10 | S |
| 25 | southern-cross-to-coalsack-jewel-box | Acrux → C99 → Mimosa → NGC4755 | 0.8 + 4.5 + 1 | 6.3 | — (low) | 1,2,3,4,5,6,7,8,9 | S |
| 26 | canopus-to-achernar | Canopus → Achernar | 39.4 | 39.4 | — (low) | 1,2,3,11,12 | S |
| 27 | altair-to-delphinus | Altair → Rotanev | 12.8 | 12.8 | 7,8,9,10,11 | 8,9,10 | both |

Consequences worth knowing: the Scorpius stinger hop is empty for 40°N (Shaula never gets above 13° there) even
though northern observers often see M7 low in the south; the Summer Triangle is empty for 34°S (Deneb peaks at 11°);
Vega → Albireo qualifies at 34°S only in August. `constellations` lists only constellations holding a path point
(boundary crossings between path points were not checked).

## Not verified

- Ranks 11–27 order (editorial). No links are stored in this file, so no URL checks were needed.
