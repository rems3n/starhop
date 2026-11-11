# Figures for the "objects" unit (star colours, life cycle, nebulae, galaxies, clusters, planets)

No diagram depends on the observer except `venus-phases`, which reads `useSettings((s) => s.observer).lat` only to
draw the lit side of Venus as seen from the learner's hemisphere. No caption or box added here names a city.

## New diagrams (src/modes/learn/figures/diagrams/)

| id | used in | what it does | computed from |
|---|---|---|---|
| `blackbody-color` | star-colors §1 | temperature slider (2,500–40,000 K): glowing disc, Planck curve with peak, star strip | Planck's law + CIE 1931 colour matching (Wyman et al. 2013 fit) → sRGB; Wien's law |
| `spectral-sequence` | star-colors §2 | O–M discs with ranges and examples; "How common" view | class shares of all stars (Wikipedia table) vs naked-eye shares counted live from `stars.json` |
| `hr-diagram` | star-colors §3, §4 | H–R diagram of ~8,700 catalog stars (B−V vs M_V), regions labelled, hover/tap names; toggle adds Sun + nearest stars | catalog `bv`, `absMag`; nearby stars from Wikipedia infoboxes |
| `star-sizes` | star-colors §3, life-cycle §3 | stars to scale in three zoom steps; Earth and Mars orbits inside Betelgeuse; marble scale model | Wikipedia radii |
| `lifetime-vs-mass` | life-cycle §2 | mass slider 0.1–40 M☉: colour, fuel vs burn-rate bars, lifetime on log timeline | piecewise mass–luminosity relation (Wikipedia); t ≈ 10 Gyr·M^−2.5 + 3 Myr ("rough rule, factor of 2" stated in figure) |
| `stellar-life-paths` | life-cycle §4 (low), §5 (high) | branching process diagram with real photos (M42, Sun, M57, Betelgeuse, M1) and drawn icons; stage slider | photo credits listed under the figure |
| `nebula-glow` | nebulae §1 (θ¹ Ori C), §2 (Merope) | star temperature slider: red ionised-hydrogen bubble grows with UV; dust scatters blue | fraction of Planck photons beyond 91.2 nm × main-sequence size trend, cube-rooted; "sizes not to scale" |
| `eye-vs-camera` | nebulae §4 | one M42 photo filtered as eye (grey, contrast threshold) vs camera (exposure slider); dark/city sky | SVG filters on `img/M42-2.jpg`; says "simulations" in the figure |
| `milky-way-structure` | galaxies §1 (l 0, b 0), §4 (b 80) | face-on schematic + side view along the sightline; direction and tilt sliders; light-years of disc crossed | disc radius 50,000 ly, thickness 1,000 ly, Sun at 26,000 ly; thickness exaggerated ×5 (stated) |
| `hubble-sequence` | galaxies §2 | drawn tuning fork; chosen type shows a real photo (M49, M102, M51, NGC 1365, SMC) | credits under the figure |
| `lookback-time` | galaxies §3 | log light-travel-time scale, Moon → earliest galaxies; Earth-history readout | Wikipedia distances (see below) |
| `cluster-aging` | star-clusters §1 | simulated cluster (Salpeter masses 0.4–40 M☉) aged 1 Myr–12 Gyr; overall colour, hottest class, giants; real clusters marked | same lifetime rule; ages from Wikipedia |
| `cluster-compare` | star-clusters §2 (close), §4 (galaxy) | open vs globular simulated side by side; edge-on galaxy with disc/halo populations | Pleiades radius 20 ly, M13 radius 84 ly, >150 globulars (Wikipedia) |
| `dipper-moving-group` | star-clusters §3 | seven Dipper stars moved by proper motion ±100,000 yr, play | catalog RA/Dec + Hipparcos proper motions (Wikipedia infoboxes) |
| `planet-sizes-to-scale` | planets §1 | eight planets + Sun's edge to scale; marble scale model readout | mean radii, semi-major axes |
| `venus-phases` | planets §2 | one real synodic cycle around the Oct 2026 inferior conjunction; top-down + telescope view at true relative size | astronomy-engine `Illumination`, `Elongation`, `EclipticLongitude` |
| `mars-opposition` | planets §3 | 2025–2035 date slider, orbits, apparent size/magnitude; row of oppositions | astronomy-engine `SearchRelativeLongitude`, `Illumination` |
| `saturn-rings-tilt` | planets §4 | Saturn drawn at the ring tilt for any date 2020–2050; tilt curve with edge-on crossings | astronomy-engine `Illumination(...).ring_tilt` |

Shared helper: `diagrams/_objects-lib.ts` (seeded RNG, blackbody colour, B−V → T, main-sequence relations,
`years()` formatter, `imgUrl`). `.ts` so the registry ignores it.

## Checked numbers (Wikipedia infoboxes via the API, Nov 2026)

- Temperatures (K): Betelgeuse 3,600 (sources range 3,400–3,800; infobox now 3,779), Arcturus 4,286, Sun 5,772,
  Procyon 6,582, Sirius 9,845, Vega 8,900–10,000, Rigel 12,100, Spica 25,300, Alnitak 29,500, Mintaka ~30,000+,
  Antares 3,660, Aldebaran 3,900, Merope 14,550, θ¹ Ori C 39,000, Proxima 2,833.
- Radii (R☉): Sirius 1.71, Procyon 2.04, Proxima 0.162, Sirius B 0.0081, Arcturus 25.4, Aldebaran 45, Rigel 74,
  Antares 680, Betelgeuse 640–764 (figure uses 700 and says it is uncertain).
- Masses (M☉): Proxima 0.12, Sirius 2.06, Spica 10, Rigel 21, Alnitak 33, Betelgeuse ~14.
- Class shares of main-sequence stars: O 0.00003 %, B 0.12, A 0.61, F 3.0, G 7.6, K 12, M 76 % (Wikipedia
  "Stellar classification"). Naked-eye catalog: O 0.6 %, B 18.6, A 20.6, F 13.6, G 12.9, K 27.9, M 5.8 %.
- Class temperature boundaries in the figure follow the lesson text (30,000 / 10,000 / 7,500 / 6,000 / 5,200 /
  3,700 K). Wikipedia's table uses 33,000 / 10,000 / 7,300 / 6,000 / 5,300 / 3,900 K; the lesson's values keep
  Mintaka and Alnitak (O9.5) in class O, so I left them.
- Abs. mag / B−V for the H–R extras: Sun 4.83/0.65, Proxima 15.6/1.82, Barnard's 13.21/1.71, Wolf 359 16.61/2.03,
  61 Cyg B 8.23/1.32, Sirius B 11.18/−0.03.
- Proper motions (mas/yr, μα*, μδ): Dubhe −134.11, −34.70; Merak +81.43, +33.49; Phecda +107.68, +11.01; Megrez
  +104.11, +7.30; Alioth +111.91, −8.24; Mizar +119.01, −25.97; Alkaid −121.17, −14.91.
- Cluster ages: Pleiades 125 Myr, Hyades 625 Myr, Beehive 600–700 Myr, M67 3.2–5 Gyr (figure 4 Gyr), M13 11.65 Gyr.
- Distances: M42 1,344 ly; Galactic centre 25,900–27,000 ly; LMC 163,000 ly; M31 2.50 Mly; M81 12.0 Mly;
  M87 53.5 Mly; Betelgeuse 408–548 ly.
- Mass–luminosity relation (Wikipedia): 0.23 M^2.3 (M<0.43), M^4 (0.43–2), 1.4 M^3.5 (2–55), 32,000 M (>55).
- Mars oppositions (astronomy-engine): 16 Jan 2025 14.5″ −1.4; 19 Feb 2027 13.8″; 25 Mar 2029 14.4″;
  4 May 2031 16.7″; 28 Jun 2033 21.9″ −2.5; 15 Sep 2035 24.5″ −2.8. Conjunction Jan 2026: 3.9″, mag +1.2.
- Saturn ring tilt (astronomy-engine): edge-on (Earth crossing) 2025; max ~26.5° in 2032–33; edge-on again
  late 2038 – mid 2039 (three crossings, labelled "2038–39").

## Lesson text edits

- star-colors-and-classes: Betelgeuse "3,500 K" → "3,600 K" in §1 body and the demo caption (to match the figure
  and current estimates).
- No other body text changed.

## Things to flag

- planets-up-close §3 body says Mars fades "more than fifty times" between opposition and conjunction. That holds
  only for the best oppositions (2033/2035: about 4.4 mag ≈ 58×); for the 2025–2029 oppositions it is about
  16× (≈3 mag). Suggest "up to fifty times fainter" in the next text pass.
- galaxies / star-clusters body: Pleiades "around 100 million years" (infobox now 125 Myr) and M13 "about
  22,000 light-years" (infobox 24,100 ly). Not changed; figures avoid contradicting them.
- `hr-diagram` plots catalog `absMag`, which has a few odd values (e.g. HR 1703 "M0V" at M_V −1.1); they show as
  stray dots and are not labelled.
- `eye-vs-camera` and `nebula-glow` are qualitative simulations; both say so on the figure.

## Screenshots

`docs/shots/figures/` (git-ignored): `sc*` star colours, `lc*` life cycle, `nb*` nebulae, `gx*` galaxies,
`cl*` clusters, `pl*` planets; `-d` desktop 1360 px, `-m` 390 px.
