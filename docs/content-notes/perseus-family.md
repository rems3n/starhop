# Content notes — batch "perseus-family"

Files: And, Cas, Cep, Cet, Per, Peg, Equ, Tri (ancient); Lac, Cam, Lyn (modern).
Written 2026-11-10. All fetches below were made in this session with curl.

## Sources read

| Source | URL | Result |
|---|---|---|
| Star Tales: andromeda, cassiopeia, cepheus, cetus, perseus, pegasus, equuleus, triangulum, lacerta, camelopardalis, lynx | http://www.ianridpath.com/startales/<page>.html | 200 for all 11, content read in full |
| Wikipedia (API extracts): Andromeda (constellation), Cassiopeia (constellation), Cepheus (constellation), Cetus (constellation), Perseus (constellation), Pegasus (constellation), Equuleus, Triangulum, Lacerta, Camelopardalis, Lynx (constellation) | en.wikipedia.org/w/api.php | 200 (several needed a retry after HTTP 429); used for star/object facts and naming history |
| Apollodorus, Library book 2 | https://www.theoi.com/Text/Apollodorus2.html | 200; read 2.3.1–2 (Bellerophon), 2.4.1–5 (Perseus) |
| Ovid, Metamorphoses 4 and 5 | https://www.theoi.com/Text/OvidMetamorphoses4.html, …5.html | 200; read 4.604–803, 5.1–249, 5.250–268 (via Pegasos page quote), 5.346–408 |
| Aratus, Phaenomena | https://www.theoi.com/Text/AratusPhaenomena.html | 200; read 179–253, 353–358, the setting passage c. 645–658 |
| Homer, Iliad 6 | https://www.theoi.com/Text/HomerIliad6.html | 200; read 6.155–202 |
| Hesiod, Theogony | https://www.theoi.com/Text/HesiodTheogony.html | 200; lines 278–286 and 325 checked |
| Theoi figure pages: Pegasos, Ketos Aithiopios, Perseus | https://www.theoi.com/Ther/HipposPegasos.html, /Ther/KetosAithiopios.html, /Heros/Perseus.html | 200; Pegasos page read in full (quotes Hesiod, Pindar Ol. 13 and Isth. 7, Ovid Fasti 3.449ff, Antoninus Liberalis 9, Pausanias, Hyginus); Ketos page used for Pliny NH 5.69 |
| Hyginus, Astronomica 2.18–2.20 | https://www.theoi.com/Text/HyginusAstronomica2.html | 200, but the page as served here is truncated after 2.20 (and HyginusAstronomica.html after 2.3) |
| Hyginus, Astronomica book 2 (Grant translation, complete) | https://topostext.org/work/207 | 200; read 2.9 Cepheus, 2.10 Cassiepia, 2.11 Andromeda, 2.12 Perseus, 2.31 Sea-monster, 2.32 Eridanus |

Not reachable: ctext.org (403) and Wikisource (429/no text) for Mencius, so the Chinese Wangliang tale is only a one-line fact on the Cassiopeia page (as reported by Star Tales), not a story.

## Stories, attributions and links

All story links were fetched in this session (HTTP 200) and are about the figure concerned.

- **And** — `And-rock` "Andromeda on the rock". Ovid Met. 4.663–764 (statue, her silence, the bargain, the fight); Apollodorus 2.4.3–5 (oracle, Phineus, children); Hyginus PA 2.11 (she followed Perseus against her parents' wishes; placed by Minerva/Athena; Euripides' play); Aratus 197–204 (chained even in heaven). Link: Star Tales andromeda.html — 200.
- **Cas** — `Cas-boast` "The queen who boasted to the sea". Apollodorus 2.4.3; Aratus 188–196 and the setting passage (Doris and Panope; diver); Hyginus PA 2.10 (Sophocles and Euripides; carried on her back for impiety); Ovid Met. 4. Link: Star Tales cassiopeia.html — 200.
- **Cep** — `Cep-king` "The king who gave up his daughter". Apollodorus 2.4.3 (compelled by the Ethiopians), 2.4.5 (Perses); Ovid Met. 4.668–764, 5.1–45 (speech to Phineus, leaving the hall); Hyginus PA 2.9; Aratus 179–187 and the setting passage. Link: Star Tales cepheus.html — 200.
- **Cet** — `Cet-monster` "The monster from the sea". Ovid Met. 4.688–739; Apollodorus 2.4.3; Hyginus PA 2.31; Aratus 353–358. Link: Star Tales cetus.html — 200.
- **Per** — `Per-medusa` "Danaë's son and the Gorgon's head": Apollodorus 2.4.1–2; Hyginus PA 2.12 (variant gifts, eye thrown in the lake, reason for catasterism); Ovid Met. 4.772–803. Link: Star Tales perseus.html — 200.
  `Per-homecoming` "The long way home: Atlas, Andromeda and the prophecy": Ovid Met. 4.604–803, 5.1–249; Apollodorus 2.4.3–5; Aratus 248–253. Link: Theoi Heros/Perseus.html — 200.
- **Peg** — `Peg-birth` "The horse born from Medusa": Hesiod Theog. 278–286; Ovid Met. 4.772–803; Apollodorus 2.4.2; Ovid Fasti 3.449–458 (as quoted on Theoi). Link: Theoi Ther/HipposPegasos.html — 200.
  `Peg-hippocrene` "The Horse's Fountain": Aratus 205–224; Ovid Met. 5.250–268; Antoninus Liberalis 9; Hyginus PA 2.18 (Pausanias 2.31.9 for Troezen, in passing). Link: Star Tales pegasus.html — 200.
  `Peg-bellerophon` "Bellerophon, the Chimera and the fall": Homer Il. 6.155–202; Pindar Ol. 13.63–92, Isth. 7.44–47; Apollodorus 2.3.1–2; Hyginus PA 2.18. Link: Star Tales pegasus.html — 200.
- **Equ** — `Equ-hippe` "Hippe, the girl who became a mare": Hyginus PA 2.18 (citing Euripides' *Melanippe* and Callimachus); Eratosthenes as reported by Star Tales (pegasus and equuleus pages). The retelling says plainly that the ancient writers told this of the large Horse and that the link to Equuleus is a modern suggestion. Link: Star Tales equuleus.html — 200.
- **Tri** — `Tri-delta` "The letter of Zeus": Hyginus PA 2.19; Aratus 233–238. `Tri-nile` "The Delta of the Nile": Eratosthenes (as reported by Star Tales); Hyginus PA 2.19 (2.32 for Eridanus = Nile; Ovid Met. 5.324 for the seven mouths). `Tri-sicily` "Sicily, the three-cornered island": Hyginus PA 2.19 for the identification; Ovid Met. 5.346–408 for the myths of Sicily. Link for all three: Star Tales triangulum.html — 200. These are identifications rather than narratives in the sources; the entries say so and do not invent a catasterism story.
- **Lac, Cam, Lyn** — modern, `stories: []`; history from Star Tales and Wikipedia.

## Uncertain / left out

- Equuleus as "Celeris", brother of Pegasus given to Castor, and as the horse struck from the ground by Poseidon's trident (both in Wikipedia, unsourced): no ancient source found, not told as stories (Celeris is mentioned in a fact as untraced).
- Triangulum: "Ceres begged Jupiter to place Sicily in the sky" (Wikipedia): not in Hyginus 2.19; left out, and a quiz explanation notes Hyginus gives only the identification.
- Cetus: the claim that the monster's bones were put on display: no ancient text confirmed in this session; left out. Pliny NH 5.69 (chain marks shown at Joppa) is used instead.
- Bellerophon unseated by a gadfly sent by Zeus: only in a modern dictionary summary; left out.
- Cassiopeia combing her hair when she boasted, and Amphitrite as the Nereid who appealed to Poseidon: not found in the ancient texts read; left out.
- Babylonian "Field" for the Square of Pegasus: not confirmed; left out.
- Gamma Cassiopeiae's nickname "Navi" and its exact brightness range; Augustin Royer's date for the Sceptre in Lacerta (sources disagree): left out.
- Date when Errai becomes the pole star is given loosely ("some two thousand years from now"); sources quote a range.
- M33 distance given as "nearly 3 million light-years" (Wikipedia's extract says 2.3 million; most references give about 2.7).
- Aratus line numbers for the setting passage on Cepheus and Cassiopeia are approximate (marked "c.").
- Ovid Met. 5: two details in `Tri-sicily` (Pluto inspecting Sicily's foundations; the capes Pelorus and Pachynus pinning the giant's two hands) and one in `Peg-hippocrene` (Athena calling the Muses fortunate) are from Ovid's text as I know it; the Theoi translation fetched here abridges or omits those lines.
