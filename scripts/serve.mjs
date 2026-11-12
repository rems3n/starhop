// Minimal zero-dependency static server for the built site (used by `npm start`, e.g. on Railway).
// Serves ./dist, gzips text responses, caches hashed assets for a year, falls back to index.html.
// /api/chat is the assistant endpoint (scripts/ai.mjs); /auth/*, /api/me and /api/state are accounts (scripts/account.mjs).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { handleApi } from './ai.mjs';
import { handleAccount } from './account.mjs';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.env.PORT) || 4173;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
};
const compressible = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);
const gzCache = new Map();

async function fileFor(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const p = join(root, clean);
  if (!p.startsWith(root)) return null;
  try {
    const s = await stat(p);
    if (s.isFile()) return p;
    if (s.isDirectory()) return join(p, 'index.html');
  } catch {}
  return null;
}

createServer(async (req, res) => {
  try {
    if (await handleAccount(req, res)) return;
    if (await handleApi(req, res)) return;
    let p = await fileFor(req.url ?? '/');
    if (!p) p = join(root, 'index.html');
    const ext = extname(p).toLowerCase();
    let body = await readFile(p);
    const headers = { 'content-type': types[ext] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff' };
    headers['cache-control'] = p.includes(`${'/assets/'}`) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=86400';
    if (compressible.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      let gz = gzCache.get(p);
      if (!gz) gzCache.set(p, (gz = gzipSync(body)));
      body = gz;
      headers['content-encoding'] = 'gzip';
      headers.vary = 'Accept-Encoding';
    }
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Server error');
  }
}).listen(port, '0.0.0.0', () => console.log(`Starhop serving ${root} on :${port}`));
