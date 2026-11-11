# Content notes — batch "orion-winter"

Files: Ori, Tau, CMa, CMi, Lep, Gem, Aur, Eri (ancient); Mon, Col, Cae (modern).
Final check: `npm run validate -- constellations/<all 11> --links` → 0 errors, 0 warnings, 12 links resolved (catalog present).

## Sources read (all fetched this session)

- Ian Ridpath, Star Tales (http, all HTTP 200): orion, orion2, taurus, taurus2, canismajor, canisminor,
  lepus, gemini, auriga, eridanus, ori-eri, monoceros, columba, caelum.
- Hyginus, Astronomica Book 2 (Mary Grant translation). The Theoi pages
  (theoi.com/Text/HyginusAstronomica.html, …2.html) returned HTTP 200 but were truncated (only 2.1–3 and
  2.18–20 present), so the full text was read at https://topostext.org/work/207 (HTTP 200; same
  translation). Sections used: 2.4, 2.13, 2.21, 2.22, 2.26, 2.32–2.36. NOT used as a link.
- Theoi (HTTP 200, complete): Aratus Phaenomena; Ovid Fasti 4 and 5; Ovid Metamorphoses 1, 2, 7;
  Apollodorus 1, 2, 3, Epitome; Hesiod Works and Days; Homer Iliad 22, Odyssey 5 and 11; Pausanias 2C;
  Apollonius Rhodius 2 and 4.
- English Wikipedia (API): Orion, Taurus, Canis Major, Canis Minor, Lepus, Gemini, Auriga, Eridanus,
  Monoceros, Columba, Caelum (stars, objects, naming history). First attempt hit HTTP 429; retried with backoff.
- Star data cross-checked against scripts/data/raw/hyg-v41.csv and public/data/*.json.

## Links stored and verification

| URL | Result | Used by |
|---|---|---|
| http://www.ianridpath.com/startales/orion.html | 200 | Ori-birth, Ori-merope |
| http://www.ianridpath.com/startales/orion2.html | 200 | Ori-scorpion, Ori-artemis-arrow |
| http://www.ianridpath.com/startales/taurus.html | 200 | Tau-europa, Tau-io, Tau-hyades |
| http://www.ianridpath.com/startales/taurus2.html | 200 | Tau-pleiades, Ori-pleiades |
| http://www.ianridpath.com/startales/canismajor.html | 200 | CMa-laelaps, CMa-orions-dog |
| http://www.ianridpath.com/startales/canisminor.html | 200 | CMi-maera, CMi-etesian-winds |
| http://www.ianridpath.com/startales/lepus.html | 200 | Lep-leros, Lep-orions-quarry |
| http://www.ianridpath.com/startales/gemini.html | 200 | Gem-shared-immortality |
| https://www.theoi.com/Text/Apollodorus3.html | 200, contains 3.11.2 | Gem-cattle-raid |
| https://www.theoi.com/Text/ApolloniusRhodius2.html | 200, opens with the Amycus fight | Gem-amycus |
| http://www.ianridpath.com/startales/auriga.html | 200 | all four Aur stories |
| http://www.ianridpath.com/startales/eridanus.html | 200 | Eri-phaethon |

## Stories and ancient attributions

- Ori-birth: Ovid Fasti 5 (three gods, Hyrieus, ox-hide, Urion; Latona places him in the sky);
  Hyginus 2.34 (Aristomachus: Zeus and Hermes; Pindar: Chios; Hesiod: Poseidon + Euryale).
- Ori-merope: Hyginus 2.34; Apollodorus 1.4.3–4. ("Oracle" for the sunrise is from Ridpath.)
- Ori-scorpion: Hyginus 2.26 and 2.34; Aratus 634–646 (Chios variant); Ovid Fasti 5 (Leto variant);
  Eratosthenes attribution taken from Ridpath only.
- Ori-artemis-arrow: Hyginus 2.34 (Istros; Callimachus variant); Homer Od. 5.121–124; Apollodorus 1.4.3–5.
- Ori-pleiades: Hyginus 2.21; Hesiod W&D 618–621.
- Tau-europa: Ovid Met. 2 (end), Fasti 5; Hyginus 2.21 (Euripides). Hermes/cattle and Minos as in Ovid/Ridpath.
- Tau-io: Hyginus 2.21; Ovid Fasti 5; narrative from Ovid Met. 1. Gadfly detail is Ridpath's (Ovid has a Fury) — said so in text.
- Tau-pleiades: Hyginus 2.21; Ovid Fasti 4; Hesiod W&D 383–387; Eratosthenes (Merope) via Ridpath.
- Tau-hyades: Ovid Fasti 5; Hyginus 2.21 (Musaeus; Pherecydes for the nurses of Dionysus — told as a variant paragraph).
- CMa-laelaps: Hyginus 2.35 (Istros); Apollodorus 2.4.6–7, 3.15.1; Ovid Met. 7; Eratosthenes via Ridpath.
  The name "Laelaps" is from Ridpath/Ovid; "Teumessian" was not in my reading and is not used.
- CMa-orions-dog: Homer Il. 22.25–31; Hesiod W&D 582–588; Aratus 326–341; Hyginus 2.35. Lore rather than a plotted myth.
- CMi-maera, CMi-etesian-winds: Hyginus 2.4 (told there under Boötes; dog = Canicula/Procyon).
- Lep-leros: Hyginus 2.33. Lep-orions-quarry: Aratus 338–341; Hyginus 2.33; Eratosthenes (Hermes) via Ridpath.
- Gem-shared-immortality: Ovid Fasti 5; Hyginus 2.22; birth details (swan, Tyndareus, Helen) from Ridpath.
- Gem-cattle-raid: Apollodorus 3.11.2.
- Gem-amycus: Apollonius Arg. 2.1–97; Hyginus 2.22; Pliny quoted from Ridpath only.
- Aur-erichthonius: Hyginus 2.13 (Eratosthenes, Euripides). Aur-myrtilus: Hyginus 2.13; Apollodorus E.2.4–9; Germanicus via Ridpath.
- Aur-hippolytus: Pausanias 2.32.1 (the identification); Apollodorus E.1.18–19; Asclepius sequel attributed to Ridpath in text.
- Aur-amalthea: Aratus 156–166; Hyginus 2.13 (Parmeniscus, Musaeus, aegis); Eratosthenes via Ridpath.
- Eri-phaethon: Ovid Met. 1–2; Apollonius Arg. 4; Aratus 359–360.
- Mon, Col, Cae: no stories; history from Ridpath + Wikipedia.

## Uncertain / left out

- Eratosthenes was not read directly; every Eratosthenes attribution rests on Ridpath or Hyginus and is labelled so.
- Ovid Fasti passages cited by book only (line numbers/calendar days not confirmed).
- Mesopotamian names for Orion (Ridpath's "URU AN-NA", Wikipedia's "True Shepherd of Anu") disagree/unconfirmed → only a hedged sentence in Ori origin; no Gilgamesh story entry.
- Apollo/Heracles (and Triptolemus/Iasion) as the Twins: no narrative in sources → history/facts only.
- Arabic Sirius–Procyon–Canopus tale: no ancient author to cite → facts only, not a story.
- Egyptian Sirius/Nile flood: stated briefly in CMa facts from general knowledge; not found in the pages read this session.
- Left out: exact distances for Betelgeuse and Arneb (sources disagree; given roughly), Pollux/ε Tau planet details, Cycnus in the Phaethon story, R Leporis as an object entry (not in catalog; mentioned in facts), Hubble's Variable Nebula.
- A few observing facts come from general astronomical knowledge rather than a page fetched this session
  (Betelgeuse's 2019–20 dimming, Sirius B seen by Alvan Clark 1862, Pluto found near Wasat, Epsilon Aurigae
  2009–11 eclipse, Orionid/Geminid/Taurid details, AE Aur–Mu Col runaway pair, solar antapex in Columba).
