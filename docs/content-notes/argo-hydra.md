# Content notes — batch "argo-hydra"

Files: Hya, Crv, Crt, Cen, Lup, Ara, CrA, Car, Pup, Vel (ancient); Pyx, Ant (modern).
All 12 validate with the catalog present (0 errors, 0 warnings); `--links` run confirms every story link resolves.

## Sources read in this session

- Ian Ridpath, Star Tales (all HTTP 200, fetched with curl): hydra, corvusandcrater, centaurus, lupus, ara,
  coronaaustralis, argo, carina, puppis, vela, pyxis, antlia (`http://www.ianridpath.com/startales/<page>.html`).
- English Wikipedia constellation articles (API extracts): Hydra, Corvus, Crater, Centaurus, Lupus, Ara,
  Corona Australis, Carina, Puppis, Vela, Pyxis, Antlia, Argo Navis. Used for star/object facts and naming history.
- Hyginus, *Astronomica* 2 (Mary Grant translation). The Theoi page
  https://www.theoi.com/Text/HyginusAstronomica2.html returned 200 but arrived truncated after 2.20 in this sandbox,
  so the same translation was read at ToposText: https://topostext.org/work/207 (200). Sections read: 2.5 (Crown,
  Dionysus/Semele), 2.23 (Crab), 2.27 (Archer/Crotus and the wreath), 2.37 (Argo), 2.38 (Centaur: Chiron, Pholus),
  2.39 (Altar), 2.40 (Water-snake, Crow, Bowl: Apollo; Istros on Coronis; Phylarchus on Mastusius; Icarius; Otus & Ephialtes).
- Theoi (all 200): Apollodorus *Library* 1 (1.9.16–28 Argonauts) and 2 (2.5.2 Hydra, 2.5.4 Pholus/Chiron);
  Ovid *Fasti* 2 (243–266 raven, snake, bowl); Ovid *Metamorphoses* 2 (531–632 Coronis and the raven);
  Aratus *Phaenomena* (399–449: wreath under the Archer, Altar and Night's storm sign, Centaur and Beast, Hydra,
  Crater, Raven); figure pages KentaurosKheiron (quotes Ovid Fasti 5.379ff, Hyginus 2.38) and KentaurosPholos.

Attribution convention: Eratosthenes, Manilius, Germanicus and Apollonius of Rhodes were NOT read directly;
where cited they are marked "(as reported in Star Tales)" in `ancientSources`.

## Stories, attributions, links

| File | Story id | Ancient attribution | Link (verified 200) |
|---|---|---|---|
| Hya | Hya-lernaean-hydra | Apollodorus 2.5.2; Hyginus 2.23 (Crab) | Star Tales hydra.html |
| Hya | Hya-apollo-crow | Ovid Fasti 2.243–266; Hyginus 2.40; Eratosthenes (via ST); Aratus 443–449 | Star Tales corvusandcrater.html |
| Crv | Crv-figs | Ovid Fasti 2; Hyginus 2.40; Eratosthenes (via ST) | Star Tales corvusandcrater.html |
| Crv | Crv-coronis | Ovid Met. 2.531–632; Hyginus 2.40 (Istros) | Star Tales corvusandcrater.html |
| Crt | Crt-apollo-cup | Ovid Fasti 2; Hyginus 2.40; Eratosthenes (via ST) | Star Tales corvusandcrater.html |
| Crt | Crt-mastusius | Hyginus 2.40 (Phylarchus) | ToposText work/207 (Star Tales does not tell this one) |
| Cen | Cen-chiron | Eratosthenes (via ST); Hyginus 2.38; Apollodorus 2.5.4; Ovid Fasti 5.379ff | Star Tales centaurus.html |
| Cen | Cen-pholus | Hyginus 2.38; Apollodorus 2.5.4 | Theoi Georgikos/KentaurosPholos.html |
| Lup | Lup-centaurs-offering | Aratus 436–442; Eratosthenes, Germanicus (via ST); Hyginus 2.38 | Star Tales lupus.html |
| Ara | Ara-oath-of-the-gods | Eratosthenes, Manilius (via ST); Hyginus 2.39; Aratus 402–430 for the storm sign | Star Tales ara.html |
| CrA | CrA-archers-wreath | Hyginus 2.27 (Sositheus); Aratus 399–401 | Star Tales coronaaustralis.html |
| CrA | CrA-dionysus-semele | Hyginus 2.5 (told of Corona Borealis) | Star Tales coronaaustralis.html |
| Car | Car-voyage-of-the-argo | Apollonius (via ST); Apollodorus 1.9.16–28; Hyginus 2.37; Eratosthenes (via ST) | Star Tales argo.html |
| Pup | Pup-building-the-argo | Apollodorus 1.9.16–19; Hyginus 2.37; Apollonius (via ST) | Star Tales argo.html |
| Pup | Pup-clashing-rocks | Apollodorus 1.9.21–22; Apollonius (via ST) | Star Tales argo.html |
| Vel | Vel-fleece-and-medea | Apollodorus 1.9.23–27; Apollonius (via ST); Hyginus 2.37 | Star Tales argo.html |
| Pyx, Ant | none (modern; `stories: []`) | — | — |

## Judgement calls and uncertainties

- Hydra: the surviving star-myth handbooks (Eratosthenes, Hyginus) attach only the crow story to the constellation.
  The Lernaean identification is traditional/modern (Star Tales gives it); the retelling says so, and no ancient
  source is claimed for who placed the Hydra itself in the sky (only Hera placing the Crab, Hyginus 2.23).
- Ovid vs Hyginus differ on the crow tale (snake as excuse and lie in Ovid; no lie, Apollo adds the snake in Hyginus).
  Told consistently on Hya, Crv and Crt, each noting the variant.
- Coronis story: Ovid has Apollo shoot Coronis, Hyginus has him shoot Ischys. Both stated.
- Crater: Icarius' bowl (Eratosthenes per Hyginus) and the jar of Otus and Ephialtes are only named by Hyginus with
  no narrative there, so they are in `facts`, not stories.
- Lupus: no Greek myth exists. The single story is the documented sacrifice scene plus how the Beast became a wolf;
  the Lycaon link is explicitly rejected, following Star Tales.
- Ara: one story. Aratus's Night/storm-sign passage is a paragraph within it and a quiz question rather than a
  separate story (too slight for a 4-paragraph retelling without padding).
- Corona Australis: the Dionysus/Semele story is told by Hyginus of the Northern Crown; its transfer to the
  Southern Crown is Ian Ridpath's suggestion. The story's summary, first paragraph and a quiz question say this.
  Wikipedia's version naming the mother "Stimula" was not used.
- Argo: "Athena placed the ship in the sky" is Star Tales' report of Hyginus; the Astronomica 2.37 text read here
  says only that she was pictured in the stars as the first ship. Worded cautiously on the Carina page.
  The story of Jason killed by the falling prow (Euripides via Robert Graves, per Star Tales) was left out as
  not confirmed in an ancient text.
- Canopus the helmsman (Conon, Strabo, per Star Tales) is in Carina `facts` rather than a story: the sources
  read give only a few sentences.
- Asterism refs (`asterism:…`) were not used because src/content/asterisms.json was empty when this was written;
  directions use star and constellation refs instead.

## Visibility from 40.7°N (computed: max altitude = 49.3° + declination)

- Never rise: all of Carina (Canopus −52.7°), α/β Cen, Crux-side Centaurus, main stars of Ara, δ/κ Vel, τ Pup, southern Lupus.
- Technically rise but not observable: ω Cen (1.8°), α Lup (1.9°), γ Vel (2°), γ Cen (0.3°), NGC 3201 (3°).
- Low but possible: Menkent 13°, γ Lup 8°, β Lup 6°, α CrA 11°, Naos 9°, π Pup 12°, Suhail 6°, α Pyx 16°, α Ant 18°.
- Hop distances were computed from catalog coordinates in public/data/stars.json and dsos.json.

## Facts left out as unverified

- Number of stars in several clusters (IC 2391), R Hydrae and other variables not in the catalog as refs.
- "Regor" as a name for γ Vel; "Naga" for γ Hya (Wikipedia only, not in the catalog's IAU names).
- Babylonian "Bison-man" for Centaurus is given only as "some scholars connect" (Wikipedia, single source).
