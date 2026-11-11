"""Step 3 — verify the shipped gallery. Exits non-zero on any failure.
Usage: python3 scripts/images/check.py"""
import json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KINDS = {"photograph", "false-color", "artist-impression", "simulation"}
LIC = re.compile(r"^(Public domain|CC0 1\.0|CC BY(-SA)? \d\.\d( igo| [a-z]{2})?)$", re.I)
REQUIRED = ["file", "title", "kind", "kindNote", "telescope", "credit", "license", "sourceUrl", "width", "height"]
MAX_TOTAL = 28 * 1024 * 1024
BODIES = {"Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"}

errs = []
data = json.load(open(os.path.join(ROOT, "public/data/images.json"), encoding="utf-8"))
credits = open(os.path.join(ROOT, "docs/credits/images.md"), encoding="utf-8").read()
dso_ids = None
p = os.path.join(ROOT, "public/data/dsos.json")
if os.path.exists(p):
    d = json.load(open(p, encoding="utf-8"))
    items = d if isinstance(d, list) else d.get("objects") or d.get("dsos") or list(d.values())
    dso_ids = {str(o.get("id")) for o in items if isinstance(o, dict)}
files = set()
for ref, lst in data.items():
    m = re.fullmatch(r"(dso|body|star):(.+)", ref)
    if not m:
        errs.append(f"{ref}: bad key"); continue
    if m[1] == "dso" and not re.fullmatch(r"(M|NGC|IC)\d+|LMC|SMC", m[2]):
        errs.append(f"{ref}: DSO id form")
    if m[1] == "dso" and dso_ids and m[2] not in dso_ids:
        print(f"WARN {ref}: id not in public/data/dsos.json (image kept; catalog has no such object yet)")
    if m[1] == "body" and m[2] not in BODIES:
        errs.append(f"{ref}: unknown body")
    if not lst:
        errs.append(f"{ref}: empty list")
    for r in lst:
        for k in REQUIRED:
            if r.get(k) in (None, "", 0) or (isinstance(r.get(k), str) and not r[k].strip()):
                errs.append(f"{ref}: empty field {k} in {r.get('file')}")
        if "?" == r.get("kindNote") or "?" == r.get("telescope"):
            errs.append(f"{ref}: unresolved label in {r['file']}")
        if r.get("kind") not in KINDS:
            errs.append(f"{ref}: bad kind {r.get('kind')}")
        if not LIC.match(r.get("license", "")):
            errs.append(f"{ref}: licence not allowed: {r.get('license')}")
        if r.get("license") != "Public domain" and not str(r.get("licenseUrl", "")).startswith("http"):
            errs.append(f"{ref}: missing licenceUrl for {r['file']}")
        if not r.get("sourceUrl", "").startswith("https://commons.wikimedia.org/wiki/File:"):
            errs.append(f"{ref}: sourceUrl {r.get('sourceUrl')}")
        if re.search(r"<[a-z/]|&[a-z]+;", r.get("credit", "") + r.get("title", "")):
            errs.append(f"{ref}: HTML left in credit/title of {r['file']}")
        path = os.path.join(ROOT, "public", r["file"])
        if not os.path.isfile(path):
            errs.append(f"{ref}: missing file {r['file']}"); continue
        files.add(path)
        with Image.open(path) as im:
            if im.format != "JPEG":
                errs.append(f"{r['file']}: not JPEG")
            if im.size != (r["width"], r["height"]):
                errs.append(f"{r['file']}: size {im.size} != {(r['width'], r['height'])}")
            if max(im.size) > 960:
                errs.append(f"{r['file']}: longest side {max(im.size)} > 960")
            if min(im.size) < 250:
                errs.append(f"{r['file']}: too small {im.size}")
            if not im.info.get("progressive"):
                errs.append(f"{r['file']}: not progressive")
            if im.info.get("exif") or im.info.get("icc_profile"):
                errs.append(f"{r['file']}: metadata not stripped")
        if f"`{r['file']}`" not in credits:
            errs.append(f"{r['file']}: no row in docs/credits/images.md")
on_disk = {os.path.join(ROOT, "public/img", f) for f in os.listdir(os.path.join(ROOT, "public/img"))}
for f in sorted(on_disk - files):
    errs.append(f"orphan file {os.path.relpath(f, ROOT)}")
total = sum(os.path.getsize(f) for f in on_disk)
if total > MAX_TOTAL:
    errs.append(f"public/img is {total/1e6:.1f} MB > 28 MB")
n = sum(len(v) for v in data.values())
print(f"{len(data)} objects, {n} image entries, {len(files)} files, {total/1048576:.2f} MiB")
for e in errs:
    print("FAIL", e)
sys.exit(1 if errs else 0)
