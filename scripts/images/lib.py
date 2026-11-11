"""Shared helpers for the Starhop image pipeline: polite, cached HTTP access to Wikimedia / NASA."""
import hashlib, html, json, os, re, time, urllib.parse, urllib.request, urllib.error

UA = "StarhopImageBuilder/1.0 (educational; static site)"
CACHE = os.environ.get(
    "STARHOP_IMG_CACHE",
    "/tmp/claude-0/-home-claude/98cc43a6-a5f3-5a10-bd68-3e15d7a31fae/scratchpad/images-cache",
)
API_CACHE = os.path.join(CACHE, "api")
RAW_CACHE = os.path.join(CACHE, "raw")
MIN_GAP = 1.6  # seconds between requests to any one host
_last = {}

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
ENWIKI_API = "https://en.wikipedia.org/w/api.php"


def _throttle(url):
    host = urllib.parse.urlsplit(url).netloc
    # all Wikimedia hosts share one budget
    if host.endswith("wikimedia.org") or host.endswith("wikipedia.org"):
        host = "wikimedia"
    wait = _last.get(host, 0) + MIN_GAP - time.time()
    if wait > 0:
        time.sleep(wait)
    _last[host] = time.time()


def fetch(url, tries=6):
    """GET with throttle and exponential back-off on 429/503. Returns bytes."""
    delay = 5.0
    for attempt in range(tries):
        _throttle(url)
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < tries - 1:
                ra = e.headers.get("Retry-After")
                pause = max(delay, float(ra)) if ra and ra.isdigit() else delay
                time.sleep(pause)
                delay *= 2
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < tries - 1:
                time.sleep(delay)
                delay *= 2
                continue
            raise


def api(base, params):
    """Cached JSON API call."""
    params = dict(params, format="json", formatversion="2")
    url = base + "?" + urllib.parse.urlencode(sorted(params.items()))
    os.makedirs(API_CACHE, exist_ok=True)
    path = os.path.join(API_CACHE, hashlib.sha1(url.encode()).hexdigest() + ".json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    data = json.loads(fetch(url).decode("utf-8"))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    return data


def strip_html(s):
    if not s:
        return ""
    s = re.sub(r"<(style|script)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<br\s*/?>|</p>|</li>|</div>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def commons_info(titles):
    """titles: list of 'File:…' names. Returns {normalised title: imageinfo dict with extmetadata}."""
    out = {}
    for i in range(0, len(titles), 40):
        chunk = titles[i : i + 40]
        d = api(
            COMMONS_API,
            {
                "action": "query",
                "titles": "|".join(chunk),
                "prop": "imageinfo",
                "iiprop": "url|size|mime|extmetadata",
                "iiurlwidth": "960",
            },
        )
        q = d.get("query", {})
        norm = {n["from"]: n["to"] for n in q.get("normalized", [])}
        pages = {p["title"]: p for p in q.get("pages", [])}
        for t in chunk:
            p = pages.get(norm.get(t, t))
            if p and not p.get("missing") and p.get("imageinfo"):
                out[t] = p["imageinfo"][0]
    return out


def meta(ii):
    """Flatten extmetadata to plain text."""
    em = ii.get("extmetadata", {})
    return {k: strip_html(str(v.get("value", ""))) for k, v in em.items()}
