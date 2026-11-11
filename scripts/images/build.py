"""Step 2 — build the gallery from selection.tsv.

For every selected Commons file: read its licence metadata from the Commons API, refuse anything outside
the allowed licence set or without an author/credit, download the standard 960 px thumbnail (cached
outside the repo), re-encode it as a stripped progressive JPEG (longest side <= 960 px), and write
public/data/images.json and docs/credits/images.md.

Usage: python3 scripts/images/build.py [--only KEY ...]
"""
import io, json, os, re, sys, hashlib
from PIL import Image
from lib import commons_info, meta, fetch, RAW_CACHE
from objects import all_objects

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
IMG_DIR = os.path.join(ROOT, "public", "img")
MAX_SIDE, QUALITY = 960, 82
MAX_BYTES = 185_000
Image.MAX_IMAGE_PIXELS = 300_000_000

# Licence short names (as Commons reports them) that we accept, with a canonical label + URL fallback.
def classify_licence(short, url):
    s = short.strip().lower().replace("-", " ")
    if re.search(r"\b(nc|nd)\b", s) or "fair use" in s or "non free" in s:
        return None
    if s in ("public domain", "pd", "pd usgov", "pd nasa") or s.startswith("pd ") or s.startswith("public domain"):
        return ("Public domain", url or "")
    if s in ("cc0", "cc0 1.0"):
        return ("CC0 1.0", url or "https://creativecommons.org/publicdomain/zero/1.0/")
    m = re.fullmatch(r"cc by( sa)? (\d\.\d)( igo| [a-z]{2})?", s)
    if m and url:
        return (short.strip(), url)
    return None


def build_credit(m, override=None):
    """Attribution line = the Commons `Artist` field (HTML already stripped), tidied of label prefixes.
    Falls back to the `Credit` field only when Artist is empty. Nothing is invented."""
    if override:
        return override
    artist, credit = m.get("Artist", "").strip(), m.get("Credit", "").strip()
    text = artist or credit
    text = re.sub(r"^\(?(credits?|image)\)?\s*:?\s+", "", text, flags=re.I)
    text = re.sub(r"\ben:(?=[A-Z])", "", text)
    if text == "Ngc1535":
        # Adam Block's own Commons account; these files' descriptions name him and the observatory.
        text = "Adam Block/Mount Lemmon SkyCenter/University of Arizona (Wikimedia Commons user Ngc1535)"
    return text.strip()


def save_within_budget(im, dest):
    """Quality 82 normally. Very dense star fields compress badly, so files over MAX_BYTES are re-encoded
    at lower quality (down to 62) and, as a last resort, scaled down, to keep public/img under 28 MB."""
    for side, q in [(960, QUALITY), (960, 76), (960, 70), (960, 66), (960, 62), (840, 66), (760, 66), (680, 66)]:
        cur = im
        if max(im.size) > side:
            cur = im.copy()
            cur.thumbnail((side, side), Image.LANCZOS)
        cur.save(dest, "JPEG", quality=q, progressive=True, optimize=True)
        if os.path.getsize(dest) <= MAX_BYTES:
            return


def load_selection():
    """selection.tsv: key | Commons file | title | kind | kindNote | telescope [| credit override]; `KEY | =OTHER` shares."""
    sel = {}
    with open(os.path.join(HERE, "selection.tsv"), encoding="utf-8") as f:
        for line in f:
            if not line.strip() or line.startswith("#"):
                continue
            c = [x.strip() for x in line.rstrip("\n").split(" | ")]
            if c[1].startswith("="):
                sel.setdefault(c[0], []).append({"sameAs": c[1][1:]})
                continue
            e = {"commons": "File:" + c[1], "title": c[2], "kind": c[3], "kindNote": c[4], "telescope": c[5]}
            if len(c) > 6 and c[6]:
                e["credit"] = c[6]
            if len(c) > 7 and c[7]:
                e["crop"] = [float(x) for x in c[7].split(",")]
            sel.setdefault(c[0], []).append(e)
    return sel


def main():
    only = set(sys.argv[sys.argv.index("--only") + 1 :]) if "--only" in sys.argv else None
    sel = load_selection()
    refs = {k: r for k, r, _ in all_objects()}
    titles = sorted({e["commons"] for v in sel.values() for e in v if "commons" in e})
    info = commons_info(titles)
    os.makedirs(IMG_DIR, exist_ok=True)
    os.makedirs(RAW_CACHE, exist_ok=True)
    out, rows, problems = {}, [], []
    for key, entries in sel.items():
        if key.startswith("_"):
            continue
        ref = refs[key]
        res = []
        n = 0
        for e in entries:
            if "sameAs" in e:  # share another key's image (e.g. the two halves of the Double Cluster)
                res.append(("same", e["sameAs"], e.get("index", 0)))
                continue
            n += 1
            ii = info.get(e["commons"])
            if not ii:
                problems.append(f"{key}: missing on Commons: {e['commons']}")
                continue
            m = meta(ii)
            lic = classify_licence(m.get("LicenseShortName", ""), m.get("LicenseUrl", ""))
            if not lic:
                problems.append(f"{key}: licence not allowed ({m.get('LicenseShortName')!r}): {e['commons']}")
                continue
            if m.get("Restrictions", "") not in ("", "trademarked", "personality"):
                # e.g. insignia / currency restrictions — never applies to sky images; flag for review
                problems.append(f"{key}: restrictions {m.get('Restrictions')!r}: {e['commons']}")
            credit = build_credit(m, e.get("credit"))
            if not (m.get("Artist") or m.get("Credit")) or not credit:
                problems.append(f"{key}: no author/credit at source: {e['commons']}")
                continue
            fname = f"{key}-{n}.jpg"
            dest = os.path.join(IMG_DIR, fname)
            if (only is not None and key in only) or not os.path.exists(dest) or "--force" in sys.argv:
                thumb = ii.get("thumburl") or ii["url"]
                raw = os.path.join(RAW_CACHE, hashlib.sha1(thumb.encode()).hexdigest())
                if not os.path.exists(raw):
                    try:
                        data = fetch(thumb)
                    except Exception as ex:  # keep going; report at the end
                        problems.append(f"{key}: download failed ({ex}): {e['commons']}")
                        continue
                    with open(raw, "wb") as fh:
                        fh.write(data)
                with open(raw, "rb") as fh:
                    im = Image.open(io.BytesIO(fh.read()))
                    im.load()
                if im.mode in ("RGBA", "LA", "P"):
                    im = im.convert("RGBA")
                    bg = Image.new("RGB", im.size, (0, 0, 0))
                    bg.paste(im, mask=im.split()[-1])
                    im = bg
                elif im.mode != "RGB":
                    im = im.convert("RGB")
                c = e.get("crop")  # optional [left, top, right, bottom] as fractions, to trim borders/captions
                if c:
                    w, h = im.size
                    im = im.crop((int(c[0] * w), int(c[1] * h), int(c[2] * w), int(c[3] * h)))
                if max(im.size) > MAX_SIDE:
                    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
                clean = Image.new("RGB", im.size)  # drop EXIF/ICC/XMP
                clean.paste(im)
                save_within_budget(clean, dest)
            with Image.open(dest) as im2:
                w, h = im2.size
            page = "https://commons.wikimedia.org/wiki/" + e["commons"].replace(" ", "_")
            rec = {"file": f"img/{fname}", "title": e["title"], "kind": e["kind"], "kindNote": e["kindNote"],
                   "telescope": e["telescope"], "credit": credit, "license": lic[0], "licenseUrl": lic[1],
                   "sourceUrl": page, "width": w, "height": h}
            if not rec["licenseUrl"]:
                del rec["licenseUrl"]
            res.append(("own", rec, None))
        out[key] = (ref, res)
        if len(out) % 10 == 0:
            finalise(out, False)
    total, nimg, nobj = finalise(out, True)
    print(f"objects {nobj}  images {nimg}  total {total/1e6:.2f} MB")
    for p in problems:
        print("PROBLEM", p)
    return 1 if problems else 0


def finalise(out, last):
    final = {}
    for key, (ref, res) in out.items():
        lst = []
        for kind, a, b in res:
            if kind == "own":
                lst.append(a)
            else:
                own = [r[1] for r in out[a][1] if r[0] == "own"]
                if own:
                    lst.append(own[b])
        if lst:
            final[ref] = lst
    # remove stale files
    used = {os.path.basename(r["file"]) for v in final.values() for r in v}
    for fn in os.listdir(IMG_DIR) if last else []:
        if fn.endswith(".jpg") and fn not in used:
            os.remove(os.path.join(IMG_DIR, fn))
    with open(os.path.join(ROOT, "public", "data", "images.json"), "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=1)
        f.write("\n")
    write_credits(final)
    return sum(os.path.getsize(os.path.join(IMG_DIR, fn)) for fn in used), len(used), len(final)


def esc(s):
    return s.replace("|", "\\|").replace("\n", " ")


def write_credits(final):
    lines = [
        "# Image credits", "",
        "Every image in `public/img/` was downloaded from Wikimedia Commons, resized to at most 960 px on the",
        "longest side and re-encoded as JPEG (some were also cropped; see `scripts/images/selection.json`).",
        "Licence, author and credit are recorded as stated on each file's Commons page on the build date.",
        "CC BY and CC BY-SA images: the resized copies are redistributed under the same licence.",
        "This file is generated by `scripts/images/build.py` — do not edit by hand.", "",
        "| File | Object | Title | Kind | Telescope / instrument | Author / credit | Licence | Source |",
        "|---|---|---|---|---|---|---|---|",
    ]
    seen = set()
    for ref, lst in final.items():
        for r in lst:
            if r["file"] in seen:
                continue
            seen.add(r["file"])
            lic = f"[{r['license']}]({r['licenseUrl']})" if r.get("licenseUrl") else r["license"]
            objs = ", ".join(k for k, v in final.items() if any(x["file"] == r["file"] for x in v))
            lines.append(f"| `{r['file']}` | {objs} | {esc(r['title'])} | {r['kind']} ({esc(r['kindNote'])}) | "
                         f"{esc(r['telescope'])} | {esc(r['credit'])} | {lic} | <{r['sourceUrl'].replace(' ', '_')}> |")
    os.makedirs(os.path.join(ROOT, "docs", "credits"), exist_ok=True)
    with open(os.path.join(ROOT, "docs", "credits", "images.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    sys.exit(main())
