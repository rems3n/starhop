// Private share links: files kept encrypted in ./share and served only at /v/<SHARE_TOKEN>/.
// The repository is public, so it holds only ciphertext; the key (SHARE_KEY, 64 hex chars) and the link token
// (SHARE_TOKEN) live in the host's environment. Nothing in the app links here, and any other /v/... path is
// answered like an unknown page, so the link cannot be found by browsing or guessing.
//
//   GET /v/<token>/            a page that plays the video
//   GET /v/<token>/video.mp4   the video (supports Range requests, needed for seeking and for iOS Safari)
//   GET /v/<token>/poster.jpg  the preview frame
import { createDecipheriv, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const dir = resolve(process.env.SHARE_DIR ?? 'share');
const token = process.env.SHARE_TOKEN ?? '';
const key = /^[0-9a-f]{64}$/i.test(process.env.SHARE_KEY ?? '') ? Buffer.from(process.env.SHARE_KEY, 'hex') : null;
const files = new Map();

async function decrypt(name) {
  const raw = await readFile(join(dir, name));
  const d = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
}

const ready =
  key && token.length >= 16
    ? Promise.all([decrypt('hook.mp4.enc'), decrypt('poster.jpg.enc')]).then(
        ([video, poster]) => {
          files.set('video.mp4', { body: video, type: 'video/mp4' });
          files.set('poster.jpg', { body: poster, type: 'image/jpeg' });
          console.log('[share] video link ready');
        },
        (e) => console.error('[share] could not decrypt:', e.message),
      )
    : Promise.resolve();

function sameToken(t) {
  const a = Buffer.from(t), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

const page = (base) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Starhop</title>
<meta property="og:title" content="Starhop: know your sky">
<meta property="og:description" content="The live sky, real telescope images, the myths behind the stars, and a course that teaches you to read it.">
<meta property="og:image" content="${base}poster.jpg">
<meta property="og:type" content="video.other">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg">
<style>
  html, body { margin: 0; height: 100%; background: #000; }
  body { display: flex; align-items: center; justify-content: center; }
  video { width: 100%; max-width: 1280px; max-height: 100vh; aspect-ratio: 16 / 9; background: #000; }
</style>
</head>
<body>
<video src="${base}video.mp4" poster="${base}poster.jpg" controls playsinline preload="metadata"></video>
</body>
</html>`;

/** Answers /v/<token>/... when the token matches; returns false otherwise so the request is served as usual. */
export async function handleShare(req, res, origin) {
  const m = (req.url ?? '').split('?')[0].match(/^\/v\/([A-Za-z0-9]+)(\/(.*))?$/);
  if (!m || !token || !sameToken(m[1])) return false;
  await ready;
  const headers = { 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer', 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff' };
  const rest = m[3] ?? '';
  if (!files.size) return false;
  if (!m[2]) {
    res.writeHead(301, { ...headers, location: `/v/${m[1]}/` });
    res.end();
    return true;
  }
  if (rest === '') {
    const body = page(`${origin}/v/${m[1]}/`);
    res.writeHead(200, { ...headers, 'content-type': 'text/html; charset=utf-8', 'x-frame-options': 'DENY' });
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  }
  const f = files.get(rest);
  if (!f) return false;
  const size = f.body.length;
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) {
      res.writeHead(416, { ...headers, 'content-range': `bytes */${size}` });
      res.end();
      return true;
    }
    res.writeHead(206, { ...headers, 'content-type': f.type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    res.end(req.method === 'HEAD' ? undefined : f.body.subarray(start, end + 1));
    return true;
  }
  res.writeHead(200, { ...headers, 'content-type': f.type, 'accept-ranges': 'bytes', 'content-length': size });
  res.end(req.method === 'HEAD' ? undefined : f.body);
  return true;
}
