# Credits — astronomy core

| Source | URL | Licence | Used for |
| --- | --- | --- | --- |
| astronomy-engine 2.1.19 (Don Cross) | https://github.com/cosinekitty/astronomy | MIT | Runtime library: Sun/Moon/planet positions, precession and nutation, rise/set, eclipses, seasons, constellation lookup. |
| NASA/JPL Horizons API | https://ssd.jpl.nasa.gov/horizons/ · https://ssd-api.jpl.nasa.gov/doc/horizons.html | US Government work, public domain; data freely available | Verification only: reference positions and rise/transit/set times stored in `tests/fixtures/horizons/` and `tests/fixtures/horizons.json`. Not shipped in the app. |
| astropy 8.0.2 (Astropy Collaboration) with PyERFA | https://www.astropy.org | BSD 3-Clause | Verification only: independent star altitude/azimuth stored in `tests/fixtures/astropy-stars.json`. Not shipped in the app. |
