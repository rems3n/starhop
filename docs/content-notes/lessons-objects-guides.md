# Notes: objects lessons, monthly guides, meteor showers

## Files
- src/content/lessons/{star-colors-and-classes,star-life-cycle,nebulae,galaxies,star-clusters,planets-up-close}.json (unit "objects", order 1-6)
- src/content/monthly.json (12 guides), src/content/showers.json (11 showers)

## Meteor showers: sources
- Primary: IMO 2027 Meteor Shower Calendar (ed. J. Rendtel, IMO INFO 3-26), Table 5 "Working List of Visual
  Meteor Showers", PDF https://www.imo.net/files/data/calendar/cal2027.pdf (linked from https://www.imo.net/calendar/,
  HTTP 200, fetched 2026-11-10, text extracted with pdftotext). Used for: solar longitude of maximum, activity
  window, radiant RA/Dec at maximum, V-infinity, ZHR.
- Cross-check: English Wikipedia "List of meteor showers" (API, action=parse wikitext). All 11 rows agree with the
  IMO table on solar longitude, window, Dec, speed, ZHR, except Perseids ZHR (IMO 110+, Wikipedia 100; IMO used).
  Parent bodies taken from Wikipedia (IMO table has no parent column).
- Solar-longitude sanity check (astronomy-engine SearchSunLongitude, J2000 value + 0.378 deg precession, year 2027, UT):
  QUA 283.15 -> Jan 4 03:31 (IMO text: "peak near 3:30 UT on January 4th"); LYR 32.32 -> Apr 23; ETA 45.5 -> May 6;
  SDA 128 -> Jul 31; PER 140.0 -> Aug 13 08h; ORI 208 -> Oct 22; STA 223 -> Nov 6; NTA 230 -> Nov 13;
  LEO 235.27 -> Nov 18; GEM 262.2 -> Dec 14 20h; URS 270.7 -> Dec 23.
- Judgment calls: Lyrids radiant (RA 271, Dec +34) lies just inside Hercules; `con` is "Lyr" (namesake, near Vega) and
  the note says so. Southern Delta Aquariids parent: Wikipedia list gives P/2008 Y12 (SOHO); commonly attributed to the
  96P/Machholz complex — recorded as uncertain. Quadrantids ZHR "80+" and Leonids "15+" stored as 80 and 15.

## Monthly guides: "well placed" check
Altitude of each constellation centre at 21:00 local mean time on the 15th from 40.7 N (astronomy-engine sidereal
time; approximate centre coordinates). Every `featured` entry is >= 25 deg. Lowest: Feb CMa 27, Lep 28; Jan Lep 29;
May Crv 31; Jul Lib 31; Sep Cap 31; Oct Cap 27; Apr Hya 33, Crt 32.
Deliberately NOT featured because their centres are below 25 deg at that hour: Scorpius (July, 22 deg) and
Sagittarius (August, 20 deg). Both are described in the intro text as low southern sights.
No planets or years are mentioned in monthly text.

## Lessons: demo checks
Target altitudes at Brooklyn for each "month:N HH:MM" step were computed with astronomy-engine (2026):
Jan 21:00 Orion/Taurus/M42/M45/M1 all 40-70 deg; Apr 21:30 M81 62, M51 54, M87 48; May 22:00 Arcturus 60;
Jul 22:00 M13 86, Antares 23; Aug 22:00 M57 82, M27 66, M8 24, M22 25, M7 14, galactic centre 19;
Sep 21:00 Deneb/Veil >70; Oct 21:00 Helix 28; Nov 21:00 M31 ~89, Double Cluster 68; Mar 21:00 M44 65.
Summer steps use 22:00 because 21:00 is still twilight. Southern objects (Coalsack, Omega Centauri) use a fixed
Sydney observer in May 21:00 (Crux near culmination).
Planet lesson demos use "now" + body targets; captions are conditional ("if it is above the horizon").
Saturn ring tilt computed with astronomy-engine: ~0 deg 2025, 6 deg late 2026, ~26 deg 2032, edge-on again 2038-39.
Mars oppositions about every 26 months (next computed: 2027-02-19).

## Facts checked against Wikipedia intros this session
Pleiades 444 ly / ~100 Myr; Hyades 153 ly, Aldebaran 65 ly; Beehive 520-610 ly; Double Cluster 7,500 ly;
Ring Nebula 2,570 ly; Dumbbell 1,360 ly; Helix 655 ly; Veil (supernova 10-20 kyr ago, ~3 deg); M78 reflection
nebula; Horsehead = B33 on IC 434 south of Alnitak; M13 "several hundred thousand stars"; 47 Tuc; M22; M49 56 Mly;
NGC 1365 56 Mly; Virgo Cluster 53.8 Mly, ~1,300-2,000 galaxies; Local Group; Milky Way D25 87,400 ly;
Ursa Major moving group ~80 ly; Sirius A/B 50-year orbit; red dwarfs ~3/4 of stars, none naked-eye.

## Not re-verified this session (Wikipedia API rate-limited; written from general knowledge, hedged with "about")
Spectral-class temperature boundaries and individual star temperatures/classes; M42 ~1,300 ly; M31 2.5 Mly;
M81/M82 ~12 Mly; M13 ~22,000 ly; Omega Centauri "several million stars"; globular ages 11-13 Gyr and count ~150;
Crab Nebula / SN 1054; Betelgeuse size; Aldebaran ~44 solar diameters; Sun 26,000 ly from galactic centre;
Venus max elongation ~47 deg; Mira period; Algol 2.87 d; Delta Cephei 5.4 d.
Canopus was left out of the class-F examples (modern classification is A9); Polaris (F7) used instead.
