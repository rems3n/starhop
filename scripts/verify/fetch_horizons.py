#!/usr/bin/env python3
"""
Fetch reference ephemerides from the JPL Horizons API for Brooklyn, NY and store them as test fixtures.

  python3 scripts/verify/fetch_horizons.py

Writes   tests/fixtures/horizons/raw/*.txt   (the unmodified API responses)
and      tests/fixtures/horizons.json        (the numbers parsed out of them)

Settings chosen so we compare like with like:
  * observer: geodetic lon -73.9442, lat 40.6782, altitude 0.010 km (CENTER='coord@399')
  * positions: QUANTITIES 1,2,4,13 with APPARENT='AIRLESS'
      1 = astrometric RA/Dec (ICRF)            (not used by the test, kept for reference)
      2 = apparent RA/Dec of date, no refraction
      4 = apparent azimuth/elevation, no refraction   <- compared with getBody().alt/az
      13 = angular diameter (arcsec)
  * rise/transit/set: STEP_SIZE='1m GEO' with APPARENT='REFRACTED'
      GEO = geometric horizon plane (no dip for the 10 m elevation) with refraction, 1-minute resolution.
      Horizons marks Sun/Moon rise and set by the refracted upper limb, planets by their centre.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.path.join(ROOT, "tests", "fixtures", "horizons", "raw")
SITE = "-73.9442,40.6782,0.010"
BODIES = {"Sun": "10", "Moon": "301", "Mercury": "199", "Venus": "299", "Mars": "499",
          "Jupiter": "599", "Saturn": "699", "Uranus": "799", "Neptune": "899"}

# UTC instants for position checks.
POSITION_TIMES = [
    "2026-03-08 10:00",  # morning of the spring DST change (5/6 AM local)
    "2026-07-15 01:30",  # Jul 14 2026 21:30 EDT (summer, daylight time)
    "2026-08-12 17:54",  # maximum of the partial solar eclipse at Brooklyn (Sun and Moon nearly in line)
    "2026-11-11 02:00",  # Nov 10 2026 21:00 EST
    "2027-02-19 05:00",  # Mars opposition night, local midnight
    "2027-08-13 08:00",  # Perseid morning, 4 AM EDT
    "2027-12-21 17:00",  # winter solstice, local noon
]
# Local calendar dates for rise/transit/set, as (label, UTC start, UTC stop) = local midnight to midnight.
RTS_DAYS = [
    ("2026-07-14", "2026-07-14 04:00", "2026-07-15 04:00"),
    ("2026-11-10", "2026-11-10 05:00", "2026-11-11 05:00"),
    ("2027-02-19", "2027-02-19 05:00", "2027-02-20 05:00"),
    ("2027-08-12", "2027-08-12 04:00", "2027-08-13 04:00"),
]
RTS_BODIES = ["Sun", "Moon", "Venus", "Mars", "Jupiter", "Saturn"]
MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}


def query(params, name):
    os.makedirs(RAW, exist_ok=True)
    base = {"format": "text", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'OBSERVER'",
            "CENTER": "'coord@399'", "COORD_TYPE": "'GEODETIC'", "SITE_COORD": f"'{SITE}'",
            "ANG_FORMAT": "'DEG'", "CSV_FORMAT": "'YES'"}
    base.update(params)
    url = API + "?" + urllib.parse.urlencode(base, quote_via=urllib.parse.quote)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                text = r.read().decode("utf-8")
            if "$$SOE" in text:
                break
        except Exception as e:  # noqa
            text = f"ERROR {e}"
        time.sleep(2 + 2 * attempt)
    else:
        sys.exit(f"Horizons request failed for {name}:\n{text[:800]}")
    with open(os.path.join(RAW, name + ".txt"), "w") as f:
        f.write(text)
    return text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()


def iso(stamp):
    m = re.match(r"\s*(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?", stamp)
    y, mon, d, hh, mm, ss = m.groups()
    return f"{y}-{MONTHS[mon]:02d}-{d}T{hh}:{mm}:{ss or '00'}Z"


def main():
    out = {"source": "NASA/JPL Horizons API (https://ssd.jpl.nasa.gov/api/horizons.api)", "site": SITE,
           "fetched": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "positions": [], "riseSet": []}
    tlist = " ".join(f"'{t}'" for t in POSITION_TIMES)
    for body, cmd in BODIES.items():
        rows = query({"COMMAND": f"'{cmd}'", "TLIST": tlist, "QUANTITIES": "'1,2,4,13'", "APPARENT": "'AIRLESS'", "EXTRA_PREC": "'YES'"}, f"pos-{body}")
        for row in rows:
            c = [x.strip() for x in row.split(",")]
            out["positions"].append({"body": body, "time": iso(c[0]), "raIcrf": float(c[3]), "decIcrf": float(c[4]),
                                     "raApp": float(c[5]), "decApp": float(c[6]), "az": float(c[7]), "el": float(c[8]),
                                     "angDiamArcsec": float(c[9])})
        print("positions", body, len(rows))
    for label, start, stop in RTS_DAYS:
        for body in RTS_BODIES:
            rows = query({"COMMAND": f"'{BODIES[body]}'", "START_TIME": f"'{start}'", "STOP_TIME": f"'{stop}'", "STEP_SIZE": "'1m GEO'",
                          "QUANTITIES": "'4'", "APPARENT": "'REFRACTED'"}, f"rts-{body}-{label}")
            ev = {"body": body, "localDate": label, "rise": None, "transit": None, "set": None}
            for row in rows:
                c = [x.strip() for x in row.split(",")]
                key = {"r": "rise", "t": "transit", "s": "set"}.get(c[2])
                if key and ev[key] is None:
                    ev[key] = iso(c[0])
                    if key == "transit":
                        ev["transitEl"] = float(c[4])
            out["riseSet"].append(ev)
            print("rts", label, body, ev)
    with open(os.path.join(ROOT, "tests", "fixtures", "horizons.json"), "w") as f:
        json.dump(out, f, indent=1)


if __name__ == "__main__":
    main()
