# Content notes — batch "modern-south" (22 constellations)

Files: Aps, Cha, Dor, Gru, Hyi, Ind, Mus, Pav, Phe, TrA, Tuc, Vol, Cru, For, Hor, Men, Nor, Oct, Pic, Ret, Tel, Cir
(`src/content/constellations/<Abbr>.json`). All `kind: "modern"`, all `stories: []`, so there are no story links.

## Sources read (all fetched in this session)

Star Tales (Ian Ridpath), plain http, all HTTP 200:
`http://www.ianridpath.com/startales/<page>.html` for apus, chamaeleon, dorado, grus, hydrus, indus, musca, pavo,
phoenix, triangulumaustrale, tucana, volans, crux, fornax, horologium, mensa, norma, octans, pictor, reticulum,
telescopium, circinus. Read in full; used for naming history, dates, original names, later renamings.

English Wikipedia (API extracts, HTTP 200 after 429 back-offs): Apus, Chamaeleon, Dorado, Grus (constellation),
Hydrus, Indus (constellation), Musca, Pavo (constellation), Phoenix (constellation), Triangulum Australe, Tucana,
Volans, Crux, Fornax, Horologium (constellation), Mensa (constellation), Norma (constellation), Octans, Pictor,
Reticulum, Telescopium, Circinus. Only the Characteristics / Features (stars) sections were read closely, plus the
cultural sentences of the Crux article. Deep-sky sections of most articles were not read in full.

Project catalog (`public/data/stars.json`, `dsos.json`): magnitudes, spectral types (colors), distances, and all
star-hop separations and "how far south" figures were computed from catalog coordinates
(a star of declination d rises only south of latitude 90 − |d| north; Brooklyn's limit is declination −49.3°).

## Per-constellation notes

- Aps — Star Tales + Wikipedia. Name history (Apis Indica misprint, Kepler 1627, tail cut for Octans, IAU name Paradys 2025).
- Cha — Lodewyckz chameleon/fly account (Star Tales); Hondius 1600; Halley 1678 reorientation.
- Dor — dolphinfish not goldfish; Xiphias alternative; Magellanic Cloud naming history (Vespucci, Pigafetta, Hues). LMC distance given as "about 170,000 light-years" (Star Tales 170,000; Wikipedia 179,000).
- Gru — Krane Grus / Den Reygher / Phoenicopterus; Gamma Gruis from Ptolemy's Piscis Austrinus; Alnair etymology. Delta Gruis naked-eye pair from general knowledge (not in the excerpt read).
- Hyi — redesign history; l'Hydre Mâle. No catalog DSOs; notableObjects empty.
- Ind — identity of the figure left open exactly as Star Tales does (Madagascar / East Indies / symbolic).
- Mus — unnamed on Plancius 1598, De Vlieghe 1603, Musca on Blaeu 1602, Bayer's Apis.
- Pav — green peafowl of Java; Argus/Hera myth mentioned only as NOT the origin. Star name Peacock c.1937.
- Phe — phoenix/bird-of-paradise explanation (Star Tales); Ovid mentioned as background only, no story.
- TrA — Plancius 1589 false triangle; Lacaille's level (Libella).
- Tuc — toucan vs hornbill; Lang-Exster (IAU 2024); SMC and 47 Tuc moved from Hydrus by Lacaille. SMC distance "about 200,000 light-years" is general knowledge, not from the pages read.
- Vol — Vliegendenvis, Piscis Volans, shortened 1844/1845.
- Cru — Ptolemy/Centaurus, Cadamosto 1455, Faras 1500, João de Lisboa 1514, Corsali 1516, Hues 1594, Plancius/Hondius 1598–1600, Bayer 1603, de Houtman 1603, Bartsch 1624 (all Star Tales). Cultural notes (Emu in the Sky, Boorong possum, Māori Māhutonga/Te Punga, Tswana Dithutlwa) are from the Wikipedia Crux article only and are given as one-sentence `facts`, not stories: I did not read a primary source (e.g. Stanbridge 1857) with a full narrative.
- For — le Fourneau / Fornax Chimiae; Lavoisier misconception; Bode's Apparatus Chemicus; Baily 1845.
- Hor — l'Horloge; pairing with Reticulum; Allen's "Horologium Oscillatorium".
- Men — Montagne de la Table / Mons Mensae; tablecloth cloud; Herschel 1844.
- Nor — l'Équerre et la Règle; trio of instruments; Allen's "Level and Square" error; no Alpha/Beta.
- Oct — Hadley 1730; l'Octans de Réflexion; Sigma Octantis.
- Pic — le Chevalet et la Palette / Equuleus Pictorius / Pluteum Pictoris; Beta Pictoris disk (1984).
- Ret — reticle description; Reticulus → Reticulum (Gould 1879); Rhombus (Habrecht 1621); Solarium (Jamieson 1822); IAU name Rhombus 2024.
- Tel — aerial telescope (Cassini); cropped by Baily 1845 and Gould.
- Cir — le Compas; smallest of Lacaille's 14.

## Links

No story links (no stories), so nothing to verify with `--links`.

## Refs wanted but not in the catalog

- `dso:NGC1365` (Fornax barred spiral) — mentioned unlinked in the NGC 1399 note.
- `star:R Dor`, `star:S Nor` (variable-star designations do not resolve) — S Normae mentioned unlinked.
- IAU names Paradys (α Aps), Lang-Exster (α Tuc), Rhombus (α Ret), Xami (α Cir) are not catalog names; Bayer refs used.
- Not in catalog and left out: NGC 2442 (Vol), Circinus Galaxy, NGC 7582 group (Gru), NGC 625 (Phe), IC 5152 (Ind).
- Fornax Dwarf (`dso:ESO356-4`) resolves but was left out: the catalog rates it "binoculars", which is far too optimistic for such a low-surface-brightness object.

## Left out as uncertain / unsourced

- Any full Indigenous narrative for the Cross, Coalsack or Magellanic Clouds (no primary source read).
- Etymology of Ankaa; origins of the IAU names Ginan and Imai; Keyser's death on the voyage.
- Kappa Pavonis (Cepheid), Kapteyn's Star (Pictor), R Horologii, Pi Hydri: not covered in the excerpts read.
- A third planet for Beta Pictoris reported in the Wikipedia text (dated 2026) — not corroborated, omitted.
- Wikipedia's "culminates at 9 p.m. on …" dates for TrA and Cir looked inconsistent with their right ascensions; evening seasons were derived from catalog RA instead.
- Wikipedia's "Circinus visible south of 30°N" conflicts with its own boundary (−70.6°); the files give 19°N (whole) and 25°N (Alpha) from coordinates.
