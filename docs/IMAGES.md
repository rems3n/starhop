# Object image gallery

Locally shipped, open-licensed pictures of sky objects, each labelled with what kind of picture it is,
which telescope took it, who to credit and under which licence.

- Data: `public/data/images.json` — `Record<TargetRef, SkyImage[]>` (`SkyImage` is in `src/types.ts`).
- Files: `public/img/<Key>-<n>.jpg` (e.g. `M42-1.jpg`, `Jupiter-2.jpg`), JPEG, longest side ≤ 960 px,
  progressive, no EXIF/ICC metadata.
- Credits: `docs/credits/images.md` — one row per file (generated; do not edit by hand).
- Current totals: **167 objects, 210 image files, 24.72 MB (23.58 MiB)** — budget is 28 MB.

## Pipeline (`scripts/images/`, Python 3 + Pillow, no new dependencies)

| File | What it does |
|---|---|
| `objects.py` | The list of objects to cover and the English Wikipedia article for each. |
| `candidates.py` | Review aid. Lists the lead image and in-article images of each object's Wikipedia article, with their Wikimedia Commons licence data. Writes only to the cache. |
| `search.py` | Review aid. Searches Commons, or prints metadata for named files (`--files "File:…"`). |
| `descs.py` | Review aid. Prints the sentences of each file's Commons description that say how the picture was made. |
| `selection.tsv` | **The source of truth.** One line per chosen image: key, Commons file name, title, kind, kindNote, telescope, optional credit override, optional crop. |
| `build.py` | Reads `selection.tsv`, reads each file's licence data from the Commons API, refuses anything not allowed, downloads the 960 px thumbnail, re-encodes it, writes `images.json` and `docs/credits/images.md`. |
| `check.py` | Asserts every entry is complete and correct (see below). |
| `sheet.py` | Makes contact sheets of `public/img` for looking over the results. |
| `lib.py` | Polite, cached HTTP: User-Agent `StarhopImageBuilder/1.0 (educational; static site)`, one request at a time, 1.6 s between requests to Wikimedia, exponential back-off on HTTP 429/503. |

Run from the project root:

```
python3 scripts/images/build.py            # build anything missing
python3 scripts/images/build.py --only M42 # rebuild one object
python3 scripts/images/build.py --force    # re-encode everything
python3 scripts/images/check.py
```

Downloads and API answers are cached outside the repository (default: the session scratchpad; set
`STARHOP_IMG_CACHE=/some/dir` to choose a folder). Originals are never committed. Downloaded files are
only ever decoded as images.

`build.py` uses the `thumburl` the Commons API returns for `iiurlwidth=960` (Wikimedia only serves
standard widths), composites any transparency onto black, optionally crops, shrinks so the longest side is
≤ 960 px, and saves a progressive JPEG at quality 82. Very dense star fields compress badly, so any file
that would be larger than 185 kB is re-encoded at a lower quality (76, 70, 66, 62) and, as a last resort,
made smaller. This keeps the folder inside the 28 MB budget.

## Selection rules

1. Source: Wikimedia Commons only (so every file has a public page stating author and licence).
2. Accepted licences, exactly as Commons reports them: public domain (NASA and other PD), CC0, CC BY,
   CC BY-SA (any version, including IGO and country ports). Rejected: non-free / fair use, NC, ND, and any
   file whose `Artist` and `Credit` fields are both empty. `build.py` and `check.py` both enforce this.
3. The file must really show the object: it is the lead image of the object's Wikipedia article, or is
   used in that article, or its Commons title and description name the object.
4. Real pictures only: no star charts, finder maps, diagrams, logos or annotated versions.
5. Prefer one picture that shows the whole object well. For showpieces add a second view that teaches
   something: what an amateur telescope shows, or the same object in infrared / X-ray / narrowband.
6. Credit line = the Commons `Artist` field with HTML removed (falls back to `Credit` if Artist is empty).
   One rule-based fix: files uploaded by Commons user `Ngc1535` are credited to Adam Block / Mount Lemmon
   SkyCenter / University of Arizona, as those files' own descriptions state.

## Labelling rules

- `photograph` — visible light in roughly natural colour: amateur astrophotos, ground-based red/green/blue
  images, spacecraft natural-colour views, Hubble optical broadband composites.
- `false-color` — narrowband palettes, infrared / ultraviolet / X-ray / radio data shown as visible
  colours, multi-wavelength composites, enhanced or simulated colour. Hubble pictures whose source says
  they combine visible light with infrared or ultraviolet light are labelled false-color.
- `artist-impression`, `simulation` — only when the source says so (none are used at present).
- `kindNote` gives the evidence in plain words, taken from the file's Commons description. If the
  description does not say how the colour was made, the picture is classified by instrument (JWST,
  Spitzer, GALEX, radio arrays → false-color) and otherwise labelled `photograph` with the note
  "Colour processing not stated at source".
- `telescope` is what the description documents; otherwise "Not stated at source".
- Visible-light pictures with extra hydrogen-alpha data blended in (HaRGB) are labelled `photograph`,
  and the note says so.

## How to add or replace an image

1. Find a file: `python3 scripts/images/search.py "Messier 25 cluster"`, and read its description:
   `python3 scripts/images/search.py --files "File:Name.jpg"`.
2. Add a line to `selection.tsv` (the order of lines for a key is the gallery order):
   `M25 | Name.jpg | Open cluster M25 | photograph | Red, green and blue filters | 200 mm Newtonian (amateur)`
3. `python3 scripts/images/build.py --only M25`, then `python3 scripts/images/check.py`.
4. Look at the result (`python3 scripts/images/sheet.py /some/outdir 6 270 M25`).

Keys: `Sun`, `Moon`, planet names → `body:<Name>`; `M<n>`, `NGC<n>`, `IC<n>`, `LMC`, `SMC` → `dso:<id>`;
star proper names → `star:<Name>`. A new key must also be added to `objects.py`.
`KEY | =OTHER` makes a key reuse another key's first image (the Double Cluster's two halves do this).

## What `check.py` asserts

Key form; every field present and non-empty; kind is one of the four; licence in the allowed set with a
licence URL (except public domain); source URL is a Commons file page; no HTML left in text; file exists,
is a progressive JPEG without metadata, dimensions match the JSON, longest side ≤ 960 px; every file has a
row in the credits table; no orphan files; folder ≤ 28 MB. It warns (does not fail) when a `dso:` key is
not in `public/data/dsos.json`.

## Coverage

| Group | Wanted | Covered | Images | Notes |
|---|---|---|---|---|
| Solar system | 9 | 9 | 26 | 3 each, Uranus 2. Each has a spacecraft/Hubble view; all but Venus, Uranus and Neptune have an amateur-telescope view. |
| Messier objects | 110 | 110 | 135 | 22 of the 23 showpieces have 2–3 images; M20 has 1. |
| Other showpieces | 39 | 39 | 38 | NGC 869 and NGC 884 share one Double Cluster picture. |
| Stars | 10 | 9 | 11 | Betelgeuse 3, Sirius, Albireo, Mizar (with Alcor), Polaris, Antares, Vega, Fomalhaut, Mira. |

By kind: 163 photograph, 47 false-color. By licence: CC BY 4.0 74, public domain 47, CC BY-SA 4.0 32,
CC0 29, CC BY 2.0 10, CC BY 3.0 8, CC BY-SA 3.0 7, CC BY-SA 3.0 IGO 1, CC BY-SA 2.5 1, CC BY-SA 3.0 US 1.

No image:

- `star:Algol` — no real resolved picture was found among the candidates, so it is skipped.

Known weak spots (good candidates for replacement):

- M25 is a dim, low-contrast frame. M20 has only one image. Uranus has no amateur view.
- Jupiter-2 and Saturn-3 are small, plain eyepiece-style views; they are there on purpose, to show what a
  modest telescope shows.
- `dso:NGC281` and `dso:NGC1365` have images but are not in `public/data/dsos.json` at the time of writing.
- Labels that follow the "not stated at source" rule although the picture may not be natural colour:
  Venus-1 (Mariner 10), NGC6543-1, NGC2070-1, NGC6992-1, M51-1 (its Commons page does not name the
  telescope either).
