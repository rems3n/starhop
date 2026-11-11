"""Helper — search Commons for candidate files and print their licence metadata.
Usage: python3 scripts/images/search.py "query" ["query" ...]   or   --files "File:A.jpg" "File:B.jpg" """
import sys
from lib import api, commons_info, meta, COMMONS_API


def show(title, ii, n=160):
    m = meta(ii)
    print(f" {title[5:]} | {m.get('LicenseShortName','')} | A:{m.get('Artist','')[:50]} | C:{m.get('Credit','')[:40]} | "
          f"{ii.get('width')}x{ii.get('height')} | {m.get('ImageDescription','')[:n]}")


if sys.argv[1] == "--files":
    info = commons_info(sys.argv[2:])
    for t in sys.argv[2:]:
        if t in info:
            show(t, info[t], 700)
        else:
            print(" MISSING", t)
else:
    for q in sys.argv[1:]:
        print("##", q)
        d = api(COMMONS_API, {"action": "query", "generator": "search", "gsrnamespace": "6", "gsrsearch": q,
                              "gsrlimit": "14", "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata"})
        for p in sorted(d.get("query", {}).get("pages", []), key=lambda p: p.get("index", 0)):
            if p.get("imageinfo") and p["title"].lower().endswith((".jpg", ".jpeg", ".png", ".tif", ".tiff")):
                show(p["title"], p["imageinfo"][0])
