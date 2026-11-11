# Credits — constellation illustrations

| Source | URL | Licence | What was used |
| --- | --- | --- | --- |
| Stellarium, "modern" sky culture — illustrations | https://github.com/Stellarium/stellarium/tree/master/skycultures/modern/illustrations (fetched from `https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern/<file>`) | Free Art License (https://artlibre.org/licence/lal/en/) | 85 constellation drawings → `public/art/<Abbr>.webp`. Converted to grayscale, resized only where larger than 512 px (none are; the sources are 128–512 px), blacks clamped slightly, re-encoded as lossy WebP. |
| Stellarium, "modern" sky culture — `index.json` | https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern/index.json | CC BY-SA 4.0 (sky-culture text and data, per its `description.md`) | Image sizes and the three anchor pixels + Hipparcos numbers per drawing → `public/data/constellation-art.json` (anchor positions replaced by our HYG J2000 RA/Dec). |
| HYG Database v4.1 | https://github.com/astronexus/HYG-Database | CC BY-SA 4.0 | Positions of the anchor stars (already the star source); two anchors fainter than `stars.json` (HIP 17999 in Taurus, HIP 91589 in Telescopium) are read from the HYG file directly. |

Artist: Stellarium's own `CREDITS.md` (§4.10, https://raw.githubusercontent.com/Stellarium/stellarium/master/CREDITS.md)
reads "Constellation art, GUI buttons, logo created by Johan Meuris … License: released under the Free Art License".
The modern sky culture's `description.md` lists its authors as "Stellarium's team" and its licence as
"Text and data: CC BY-SA 4.0 · Illustrations: Free Art License". So the credit line is "Johan Meuris and Stellarium contributors".

The source has no drawings for Puppis, Vela and Serpens: Carina's drawing (`argonavis.png`) shows the whole ship
Argo Navis and so covers Puppis and Vela, and Ophiuchus' drawing includes the serpent he holds.
