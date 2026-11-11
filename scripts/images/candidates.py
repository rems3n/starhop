"""Step 1 — list candidate images: the lead image and in-article images of each object's English
Wikipedia article, with their Commons licence metadata. Output is a review aid (cache dir), not shipped."""
import json, os, sys
from lib import api, commons_info, meta, ENWIKI_API, CACHE
from objects import all_objects

ALLOWED_EXT = (".jpg", ".jpeg", ".png", ".tif", ".tiff")


def main():
    objs = list(all_objects())
    articles = sorted({a for _, _, a in objs})
    lead, images, resolved = {}, {}, {}
    for i in range(0, len(articles), 40):
        chunk = articles[i : i + 40]
        cont = {}
        while True:
            d = api(ENWIKI_API, dict({
                "action": "query", "titles": "|".join(chunk), "redirects": "1",
                "prop": "pageimages|images", "piprop": "name", "pilimit": "50", "pilicense": "any",
                "imlimit": "500"}, **cont))
            q = d["query"]
            back = {}
            for r in q.get("normalized", []) + q.get("redirects", []):
                back[r["to"]] = back.get(r["from"], r["from"])
            for p in q.get("pages", []):
                src = back.get(p["title"], p["title"])
                src = back.get(src, src)
                resolved[src] = p["title"]
                if "pageimage" in p:
                    lead[src] = "File:" + p["pageimage"].replace("_", " ")
                for im in p.get("images", []):
                    images.setdefault(src, [])
                    if im["title"].lower().endswith(ALLOWED_EXT) and im["title"] not in images[src]:
                        images[src].append(im["title"])
            if "continue" in d:
                cont = d["continue"]
            else:
                break
    files = sorted({f for f in lead.values()} | {f for v in images.values() for f in v})
    info = commons_info(files)
    out = {}
    for key, ref, art in objs:
        cands = []
        names = ([lead[art]] if art in lead else []) + [f for f in images.get(art, []) if f != lead.get(art)]
        for f in names:
            ii = info.get(f)
            if not ii:
                continue
            m = meta(ii)
            cands.append({"file": f, "lead": f == lead.get(art), "w": ii.get("width"), "h": ii.get("height"),
                          "license": m.get("LicenseShortName", ""), "artist": m.get("Artist", ""),
                          "credit": m.get("Credit", ""), "desc": m.get("ImageDescription", "")[:600]})
        out[key] = {"ref": ref, "article": resolved.get(art, art), "candidates": cands}
    path = os.path.join(CACHE, "candidates.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("wrote", path, "objects:", len(out), "without lead:", [k for k, v in out.items() if not any(c["lead"] for c in v["candidates"])])


if __name__ == "__main__":
    main()
