# Request from the skills-lesson / asterism writer

## Bug: `star:Cor Caroli` crashes the resolver (src/data/catalog.ts)

`STAR_ALIASES` contains `'cor caroli': 'Cor Caroli'`. `findStar` looks the alias up before the name map and
recurses with the alias value, which normalises to the same key, so `catalog.resolve('star:Cor Caroli')`
recurses until the stack overflows (`npm run validate` dies with "Maximum call stack size exceeded").
Fix: delete that alias entry (the catalog star is already named "Cor Caroli"), or check `starByName` before aliases.

Until then `src/content/asterisms.json` uses `star:α2 CVn` for Cor Caroli. Any other content that writes
`star:Cor Caroli` (refs or `[[star:Cor Caroli|…]]` links) will crash the validator and the app's resolver.

## Note: Bayer letters with a component number

Stars stored as `γ1 Leo`, `β1 Cyg`, `α2 CVn`, `γ2 Sgr` etc. do not resolve from the plain letter (`star:γ Leo`).
Content should use the proper name or include the number. A fallback from `γ Leo` to the brightest `γN Leo` would help writers.
