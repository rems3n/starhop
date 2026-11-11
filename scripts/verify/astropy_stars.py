#!/usr/bin/env python3
"""
Independent star altitude/azimuth reference using astropy (ERFA / IAU SOFA routines).

  pip install astropy        (add --break-system-packages on managed systems)
  python3 scripts/verify/astropy_stars.py

Writes tests/fixtures/astropy-stars.json.

Both sides start from the SAME J2000 (ICRS) coordinates and apply NO proper motion, parallax or
refraction (pressure = 0), so the comparison tests the frame rotation only. astropy additionally applies
annual aberration (up to 20.5") and light deflection, which Starhop's fixed-star path leaves out on
purpose; that difference is inside the 0.05 degree target and is reported in docs/VERIFICATION.md.
Earth-orientation data: astropy's bundled IERS table, no downloads (UT1-UTC predictions for future dates).
"""
import json, os, time
import astropy
from astropy import units as u
from astropy.coordinates import AltAz, EarthLocation, SkyCoord
from astropy.time import Time
from astropy.utils import iers

iers.conf.auto_download = False
iers.conf.iers_degraded_accuracy = "warn"

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
# J2000 RA/Dec in degrees (Hipparcos/SIMBAD ICRS positions at epoch J2000, rounded to 1e-4 deg).
STARS = {
    "Sirius": (101.2872, -16.7161), "Vega": (279.2347, 38.7837), "Arcturus": (213.9153, 19.1824),
    "Polaris": (37.9546, 89.2641), "Betelgeuse": (88.7929, 7.4071), "Antares": (247.3519, -26.4320),
    "Capella": (79.1723, 45.9980), "Fomalhaut": (344.4127, -29.6222), "Deneb": (310.3580, 45.2803),
    "Canopus": (95.9880, -52.6957),
}
TIMES = ["2026-11-11T02:00:00", "2026-07-15T01:30:00", "2027-02-19T05:00:00", "2027-08-13T08:00:00"]
SITES = {"Brooklyn": (40.6782, -73.9442, 10.0)}


def main():
    rows = []
    for site, (lat, lon, h) in SITES.items():
        loc = EarthLocation(lat=lat * u.deg, lon=lon * u.deg, height=h * u.m)
        for t in TIMES:
            frame = AltAz(obstime=Time(t, scale="utc"), location=loc, pressure=0 * u.hPa)
            for name, (ra, dec) in STARS.items():
                aa = SkyCoord(ra=ra * u.deg, dec=dec * u.deg, frame="icrs").transform_to(frame)
                rows.append({"site": site, "lat": lat, "lon": lon, "elevationM": h, "time": t + "Z", "star": name,
                             "ra": ra, "dec": dec, "alt": float(aa.alt.deg), "az": float(aa.az.deg)})
    out = {"source": f"astropy {astropy.__version__} (ICRS -> AltAz, pressure=0, no proper motion)",
           "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "rows": rows}
    with open(os.path.join(ROOT, "tests", "fixtures", "astropy-stars.json"), "w") as f:
        json.dump(out, f, indent=1)
    print(len(rows), "rows")


if __name__ == "__main__":
    main()
