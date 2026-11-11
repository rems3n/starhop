"""Helper — for selection rows still marked '?', print the parts of the Commons description that say
how the picture was made (instrument, filters, colour), so a person can label them."""
import re, sys
from lib import commons_info, meta
rows = [[c.strip() for c in l.split(" | ")] for l in open(sys.argv[1], encoding="utf-8") if l.strip() and not l.startswith("#")]
rows = [r for r in rows if len(r) > 2 and "?" in r[3:6] and (len(sys.argv) < 3 or r[0] in sys.argv[2:])]
info = commons_info(["File:" + r[1] for r in rows])
KW = re.compile(r"infrared|ultraviolet|filter|colou?r|narrow|h-?alpha|\bHa\b|O ?III|S ?II|wavelength|composite|camera|instrument|telescope|ACS|WFC|WFPC|nm\b|micron|RGB|refractor|reflector|lens|X-ray|radio|band", re.I)
for r in rows:
    ii = info.get("File:" + r[1])
    if not ii:
        print("MISSING |", r[0], "|", r[1]); continue
    m = meta(ii)
    d = m.get("ImageDescription", "")
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", d) if KW.search(s)]
    txt = " ".join(sents)[:330]
    print(f"{r[0]} | {r[1][:40]} | {m.get('LicenseShortName')} | A:{m.get('Artist','')[:60]} | {txt or d[:200]}")
