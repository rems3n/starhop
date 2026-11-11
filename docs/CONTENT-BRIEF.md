# Content brief (all writers)

Reader: an intelligent adult beginner anywhere in the world who wants to walk outside and
recognise every constellation, know its stories and its notable objects. Write like a good planetarium
guide: concrete, warm, plain words, British/American spelling consistent (use American). Explain any
term the first time ("magnitude — the brightness scale, where smaller numbers are brighter").

## Hard rules

1. **Schemas are law.** `src/content/schema.ts` defines every file. Run
   `npm run validate -- <part of your file names>` (from /home/claude/starhop) and fix every ERROR.
   Warnings should be fixed or justified in your report. The catalog data (`public/data/*.json`) is
   being built by another engineer; until it exists the validator skips reference checks — you MUST
   re-run the validator after `public/data/stars.json`, `constellations.json` and `dsos.json` exist
   (poll once a minute for up to 30 minutes) and fix unresolved references before you finish.
2. **Never fabricate.** No invented myths, characters, ancient sources, dates, distances or URLs.
   If you are not sure, leave it out and list it in your report. For modern constellations with no
   myth, `stories` is `[]` and `origin.history` says who named it, when and why.
3. **Original wording.** Retell myths in your own words. Ian Ridpath's *Star Tales* and other modern
   books/sites are copyrighted: use them to learn the facts and the ancient attributions, never copy
   or closely paraphrase their sentences, and never reuse their distinctive phrasing.
4. **Links must be verified.** A `link.url` may only be included if you fetched it in this session and
   got HTTP 200 and the page is really about that story/figure. Record the check in your notes file.
   If you cannot verify a link, omit `link` and list the story in your report under "links not verified".
5. **Target references** (`star:…`, `dso:…`, `con:…`, `body:…`, `asterism:…`) must resolve.
   Stars: IAU proper name (`star:Betelgeuse`) or Bayer designation with the constellation abbreviation
   (`star:α Ori`, `star:ζ UMa`). Deep-sky: `dso:M42`, `dso:NGC869`, `dso:IC434` (the catalog holds all
   Messier and Caldwell objects and NGC/IC objects brighter than magnitude 10). Inline links in text:
   `[[star:Betelgeuse|Betelgeuse]]`. Use them generously in how-to-find directions, sparingly in stories.
6. Text fields are plain text: no markdown headings/lists, no HTML. `*italics*` for titles of works.
7. Only write the files you were assigned. Do not touch code, schemas or other writers' files.

## Sources and how to reach them from this sandbox

- **Ian Ridpath, Star Tales** — the standard reference for constellation mythology and history, with
  ancient-source attributions. Reachable only over plain http from the shell:
  `curl -sL -A "StarhopContent/1.0" http://www.ianridpath.com/startales/contents.html` lists the pages;
  each constellation is `http://www.ianridpath.com/startales/<page>.html`. Strip HTML before reading
  (e.g. pipe through `python3 -c "import sys,re,html;t=sys.stdin.read();t=re.sub(r'(?s)<(script|style).*?</\1>','',t);t=re.sub(r'<[^>]+>',' ',t);print(re.sub(r'\s+',' ',html.unescape(t)))"`).
  Link form to store (the one you verified): `http://www.ianridpath.com/startales/<page>.html`.
- **Theoi Project** (https://www.theoi.com) — classical texts in translation and figure pages, e.g.
  Hyginus *Astronomica* (https://www.theoi.com/Text/HyginusAstronomica.html and …Astronomica2.html),
  Aratus *Phaenomena*, Apollodorus, Ovid; find the right page by fetching, never by guessing.
- **English Wikipedia** — constellation articles for stars, objects and naming history; myth-figure
  articles as "full version" links. Use the API to get text and be polite: send a User-Agent, wait
  ≥ 1 second between requests, back off on HTTP 429:
  `curl -s -A "StarhopContent/1.0 (educational)" "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=Orion_(constellation)"`
- The WebSearch tool is available if you need to locate a page. WebFetch may refuse some hosts; use curl.

Link preference for a story's "full version": the *Star Tales* page for that constellation (one page
often covers several versions — several stories may share it), else a Theoi page on that figure or
text, else the Wikipedia article on the myth/figure.

## Constellation pages (`src/content/constellations/<Abbr>.json`)

Read `constellationContentSchema` and `storySchema` carefully. Guidance per field:

- `overview`: what the figure represents and how obvious it is in a real sky.
- `howToFind`: from a signpost a beginner already knows (Big Dipper, Orion's Belt, Summer Triangle,
  Great Square, Cassiopeia's W, the Southern Cross for far-southern figures), give star-hop steps with
  rough distances in fists/hand-spans (a fist at arm's length ≈ 10°) and say when it is up in the
  evening from 40°N. If it never rises from Brooklyn (declination south of about −49°) say so plainly and
  say from where it can be seen. Do not state specific rise/set clock times (the app computes them).
- `shape`: what the eye actually sees (e.g. "a lopsided W of five stars about a hand-span wide"), and
  honestly how much survives a city sky.
- `mainStars`: 3–6 stars (fewer for dim constellations): name, what it marks in the figure, colour,
  one memorable fact. Only facts you have checked.
- `notableObjects`: up to 6 real targets with the minimum equipment (`naked-eye` | `binoculars` |
  `small-telescope` | `telescope`) and what you will see. May be empty for barren constellations.
- `origin`: `namedBy`/`when`/`history` — for ancient figures: earliest known origin (e.g. Mesopotamian
  forerunner if documented), its place in Ptolemy's *Almagest*; for modern ones the astronomer, year,
  publication, what it depicts and why (Keyser & de Houtman / Plancius 1590s, Hevelius 1687, Lacaille
  1750s, etc.), and any later renaming.
- `stories`: **every distinct myth or competing version is its own entry**, each with: a 2–3 sentence
  `summary`; a `retelling` of 4–8 paragraphs (aim for 350–600 words) that reads as a story, not an
  encyclopedia entry, ends with how the figure came to be placed among the stars, and stays faithful
  to the named sources; `ancientSources` naming the author and work this version comes from
  (Eratosthenes *Catasterisms*, Hyginus *Poetic Astronomy*, Aratus *Phaenomena*, Ovid *Metamorphoses*
  or *Fasti*, Apollodorus *Library*, Manilius, Homer, Hesiod…) — only attributions you confirmed in
  your reading; `characters`; a verified `link`; and 3–5 `questions` on the characters and events of
  that version (4 distinct plausible choices, vary `answerIndex`, explanations that teach).
  Where versions differ only in a detail, tell the main version and cover the variant in a paragraph;
  where they are really different stories (e.g. different identity for the figure), separate entries.
  Well-documented non-Greek traditions (Babylonian, Egyptian, Chinese, Arabic, Indigenous) may be
  included as stories only if a real narrative is documented in your sources; otherwise mention them
  in `origin.history` or `facts`.
  Handle violence and sexual assault in the myths honestly but without graphic detail.
- `facts`: optional short extras (name meaning, records, the constellation's role in history).

## Notes file

Keep `docs/content-notes/<your-batch>.md`: for each constellation the sources you read, each story
with its ancient attributions, each link and its verification result, and anything uncertain.
