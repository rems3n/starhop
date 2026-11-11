# Requests from the data pipeline

## 1. catalog.ts: a bare Bayer letter should find an indexed star

`star:alpha Cen`, `star:α Cru`, `star:beta Cyg`, `star:gamma And` return null. HYG (like the Bright Star
Catalogue) stores these as `α1 Cen`, `α1 Cru`, `β1 Cyg`, `γ1 And`, and `stars.json` keeps that. There are
101 stars brighter than mag 4.6 whose constellation has an indexed letter but no bare one, including
Rigil Kentaurus, Acrux, Algieba, Almach, Acrab, Zubenelgenubi, Rasalgethi, Cor Caroli, Albireo, Algedi.

Suggested change in `findStar`: when `desigKey` gives a key with no index and nothing matches, return
the brightest star whose key is that letter plus any index in that constellation. Proper names and
`star:alpha1 Cen` already work. Not changed in the data, because writing `α` for `α1` would be wrong.

## 2. types.ts: MilkyWay cannot mark holes

Each level's rings must be filled together with an even-odd rule (see "Rules: Milky Way" in
docs/DATA.md). In level 1 the two largest rings are the two edges of the band. If the sky engine wants
ready-to-fill shapes, the type needs either triangles or an outer/hole flag; say which and the pipeline
can produce it.
