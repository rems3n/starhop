# Content notes — batch "zodiac-water"

Files: Vir, Lib, Sco, Sgr, Cap, Aqr, Psc, Ari, PsA (ancient); Mic, Scl (modern).

## Sources read (all fetched in session, HTTP 200)

- Ian Ridpath, Star Tales: http://www.ianridpath.com/startales/{virgo,libra,scorpius,sagittarius,capricornus,aquarius,pisces,aries,piscisaustrinus,microscopium,sculptor}.html
- English Wikipedia (API extracts): Virgo, Libra, Scorpius, Sagittarius, Capricornus, Aquarius, Pisces, Aries, Piscis Austrinus, Microscopium, Sculptor (constellation articles) — stars, objects, naming history.
- Theoi (https://www.theoi.com/Text/…): AratusPhaenomena, HyginusAstronomica2 (only 2.18–2.20 are on this page), OvidFasti2/3/4/5, OvidMetamorphoses1/2/5/10, Apollodorus1, Apollodorus3, VirgilGeorgics1.
- ToposText: Hyginus Astronomica (https://topostext.org/work/207) for 2.4, 2.25–2.30, 2.34, 2.38, 2.41; Hyginus Fabulae (https://topostext.org/work/206) for 130, 196, 197, 224.
- LacusCurtius: Diodorus Siculus 2.4 (https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Diodorus_Siculus/2A*.html).
- Star magnitudes, distances, spectral types and all star-hop angles: computed from HYG v4.1 (scripts/data/raw) and public/data.
- Eratosthenes' Catasterisms and Germanicus/Manilius were not read directly; those attributions rest on Ridpath's Star Tales (and Hyginus where he cites Eratosthenes by name).

## Stories, attributions, links

| Story id | Ancient sources confirmed | Link (verified 200, on topic) |
|---|---|---|
| Vir-dike | Aratus Phaen. 96–136; Hyginus PA 2.25; Ovid Met. 1.89–150 | Star Tales virgo |
| Vir-demeter-persephone | Hyginus PA 2.25 (Ceres named); Ovid Fasti 4.417–620 (narrative) | Star Tales virgo |
| Vir-erigone | Hyginus PA 2.4, 2.25; Fabulae 130 | Star Tales virgo |
| Vir-ampelus | Ovid Fasti 3.407–414; Aratus 137–138 (star named) | Star Tales virgo |
| Vir-other-maidens | Hyginus PA 2.25 (Fortune, Parthenos); Eratosthenes via Ridpath (Tyche, Atargatis) | Star Tales virgo |
| Lib-claws | Aratus (Claws); Virgil Georg. 1.32–35; Hyginus PA 2.26; Manilius via Ridpath | Star Tales libra |
| Sco-gaia | Eratosthenes (Orion entry) via Ridpath; Hyginus PA 2.26, 2.34 | Star Tales scorpius |
| Sco-artemis | Aratus Phaen. 634–646; Eratosthenes (Scorpius entry) via Ridpath | Star Tales scorpius |
| Sco-leto | Ovid Fasti 5.493–544 | Theoi OvidFasti5.html |
| Sgr-crotus | Eratosthenes via Ridpath; Hyginus PA 2.27 (Sositheus); Fabulae 224 | Star Tales sagittarius |
| Sgr-chiron | Hyginus PA 2.27, 2.38; Ovid Fasti 5.379–414 | Star Tales sagittarius |
| Cap-pan-typhon | Hyginus PA 2.28; Fabulae 196; Apollodorus 1.6.3; Ovid Met. 5.321–331 | Star Tales capricornus |
| Cap-aegipan-titans | Eratosthenes via Ridpath/Hyginus; Hyginus PA 2.28 | Star Tales capricornus |
| Aqr-ganymede | Hyginus PA 2.29; Apollodorus 3.12.2; Ovid Met. 10.155–161, Fasti 2.145 | Star Tales aquarius |
| Aqr-deucalion | Hyginus PA 2.29 (Hegesianax); Germanicus via Ridpath; Apollodorus 1.7.2 | Star Tales aquarius |
| Psc-aphrodite-eros | Hyginus PA 2.30 (Diognetus); Ovid Fasti 2.459–474; Met. 5.331 | Star Tales pisces |
| Psc-egg | Hyginus Fabulae 197 | Star Tales pisces |
| Psc-great-fish | Eratosthenes via Ridpath; Hyginus PA 2.41 | Star Tales pisces |
| Ari-phrixus-helle | Apollodorus 1.9.1; Ovid Fasti 3.851–876; Hyginus PA 2.20; Eratosthenes via Hyginus | Star Tales aries |
| Ari-ammon | Hyginus PA 2.20 (Hermippus, Leon) | Theoi HyginusAstronomica2.html |
| PsA-derceto-bambyce | Eratosthenes via Ridpath; Hyginus PA 2.41 (Ctesias) | Star Tales piscisaustrinus |
| PsA-derceto-ascalon | Diodorus Siculus 2.4 | Star Tales piscisaustrinus |

Mic, Scl: modern (Lacaille 1751–52, map 1756, Latinised 1763); stories = [].

## Decisions and uncertainties

- Virgo: Tyche, Atargatis and Parthenos have no narrative in the sources, so they share one entry rather than three padded ones. Persephone is treated with Demeter (sources name Ceres/Demeter as the identity; Wikipedia adds Persephone). Diodorus's different Parthenos story (Wikipedia only) left out.
- Scorpius: no ancient source read has Apollo sending the scorpion. Apollo appears only in Istros' version (Hyginus 2.34), where he tricks Artemis into shooting Orion and there is no scorpion; noted in `facts`. Ovid's Leto version added as a third story.
- Sagittarius: the Chiron entry is framed explicitly as a misidentification (Chiron = Centaurus). No Babylonian narrative for Pabilsag was found; mentioned in origin only.
- Capricornus: no Mesopotamian goat-fish narrative in the sources (only the name and the link with Ea), so it is in origin.history, not a story. The Amalthea identification (Wikipedia only) left out.
- Aquarius: Cecrops (Hyginus, citing Eubulus) is one sentence in the source, so it is a fact, not a story. Ganymede details from Ridpath without a primary text read: the horses / golden vine given to Tros, the Eos version, Ganymede herding sheep.
- Pisces: "changed into fish" (Hyginus) and "carried by fish" (Ovid) are told as one story with the variant explained.
- PsA: Diodorus's Ascalon story does not mention the constellation; the retelling says so.
- Left out as unverified: Polynesian "Maui's fishhook" for Scorpius; exact numbers for the doubles Beta PsA, Lambda Ari and Zeta Psc (described qualitatively); distance of AU Mic; discovery year of the Sculptor Dwarf; NGC 772 (Aries) and NGC 6925 (Mic), which are fainter than the catalog limit.
- Facts stated from general astronomical knowledge rather than a page fetched this session: Sun's dates in Scorpius (about a week in late November), Aquarius, Pisces, Aries; M4 distance (~7,000 ly); Galactic Centre distance (~26,000 ly); Porrima's 169-year orbit and 2005 closest approach; Acrab companion magnitude; Fomalhaut "planet" image year (2008); Ganymede as Jupiter's largest moon; Virgo Cluster Messier counts (checked against public/data/dsos.json for Sgr = 15).
