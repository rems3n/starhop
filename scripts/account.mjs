// Accounts for `npm start` (scripts/serve.mjs): sign-in with Google or GitHub, sessions, and each learner's saved state.
//
//   GET    /auth/:provider/start?return=/sky   redirect to the provider (provider = google | github)
//   GET    /auth/:provider/callback            provider redirects back here; sets the session cookie, returns to the app
//   GET    /api/me                             { user | null, providers: ['google', ...], enabled }
//   POST   /api/logout                         ends this session
//   DELETE /api/me                             deletes the account and everything saved for it
//   GET    /api/state                          { stores: { [key]: { data, updatedAt } } }
//   PUT    /api/state/:key                     { data } -> { updatedAt }   (key: settings | progress | quiz | learn)
//
// Configure with env: DATABASE_URL (Postgres; accounts are off without it), SESSION_SECRET (optional, signs the
// sign-in state cookie), GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET and/or GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET,
// STARHOP_PUBLIC_URL (optional; else RAILWAY_PUBLIC_DOMAIN, else the request's host).
// Provider endpoints can be overridden (GOOGLE_AUTH_URL, GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL, GITHUB_AUTH_URL,
// GITHUB_TOKEN_URL, GITHUB_API_URL) so the flow can be tested against a local stand-in.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import pg from 'pg';

export const STATE_KEYS = new Set(['settings', 'progress', 'quiz', 'learn']);
const SESSION_COOKIE = 'sh_session';
const FLOW_COOKIE = 'sh_oauth';
const SESSION_DAYS = 60;
const MAX_STATE_BYTES = 2_000_000;

const env = process.env;
const PROVIDERS = {
  google: {
    id: env.GOOGLE_CLIENT_ID,
    secret: env.GOOGLE_CLIENT_SECRET,
    authUrl: env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    pkce: true,
    async profile(token) {
      const u = await getJson(env.GOOGLE_USERINFO_URL || 'https://openidconnect.googleapis.com/v1/userinfo', token);
      if (!u?.sub) throw new Error('google: no subject');
      return { providerId: String(u.sub), email: u.email_verified === false ? null : u.email ?? null, name: u.name ?? u.email ?? 'Stargazer', avatar: u.picture ?? null };
    },
  },
  github: {
    id: env.GITHUB_CLIENT_ID,
    secret: env.GITHUB_CLIENT_SECRET,
    authUrl: env.GITHUB_AUTH_URL || 'https://github.com/login/oauth/authorize',
    tokenUrl: env.GITHUB_TOKEN_URL || 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    pkce: false,
    async profile(token) {
      const api = env.GITHUB_API_URL || 'https://api.github.com';
      const u = await getJson(`${api}/user`, token);
      if (!u?.id) throw new Error('github: no id');
      let email = u.email ?? null;
      if (!email) {
        const list = await getJson(`${api}/user/emails`, token).catch(() => null);
        email = Array.isArray(list) ? (list.find((e) => e.primary && e.verified) ?? list.find((e) => e.verified))?.email ?? null : null;
      }
      return { providerId: String(u.id), email, name: u.name || u.login || 'Stargazer', avatar: u.avatar_url ?? null };
    },
  },
};
const configured = () => Object.entries(PROVIDERS).filter(([, p]) => p.id && p.secret).map(([k]) => k);

// ───────────────────────────── Database ─────────────────────────────

let pool = null;
let ready = null;
function db() {
  if (!env.DATABASE_URL) return null;
  if (!pool) {
    const local = /@(localhost|127\.0\.0\.1|\/)|host=\/|\.railway\.internal/.test(env.DATABASE_URL);
    pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5, ssl: local || env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false } });
    pool.on('error', (e) => console.error('[db]', e.message));
    ready = pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        email TEXT,
        name TEXT NOT NULL,
        avatar TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (provider, provider_id)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id_hash TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS user_state (
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, key)
      );`).then(() => console.log('[db] ready'), (e) => { console.error('[db] setup failed:', e.message); ready = null; pool = null; throw e; });
  }
  return ready.then(() => pool);
}

export function accountsEnabled() {
  return Boolean(env.DATABASE_URL) && configured().length > 0;
}

// ───────────────────────────── Helpers ─────────────────────────────

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sha256 = (s) => createHash('sha256').update(s).digest('base64url');
const secret = env.SESSION_SECRET || randomBytes(32).toString('hex');
const sign = (v) => `${v}.${createHmac('sha256', secret).update(v).digest('base64url')}`;
function unsign(s) {
  const i = s?.lastIndexOf('.') ?? -1;
  if (i < 1) return null;
  const v = s.slice(0, i);
  const a = Buffer.from(sign(v)), b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b) ? v : null;
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function isHttps(req) {
  return String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https' || Boolean(req.socket.encrypted);
}
function cookie(req, name, value, maxAgeSec) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${isHttps(req) ? '; Secure' : ''}`;
}
function baseUrl(req) {
  if (env.STARHOP_PUBLIC_URL) return env.STARHOP_PUBLIC_URL.replace(/\/+$/, '');
  if (env.RAILWAY_PUBLIC_DOMAIN) return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost');
  return `${isHttps(req) ? 'https' : 'http'}://${host}`;
}
/** Only an in-app path ("/sky", "/learn/lesson/x?y=1"); anything else goes to the sky map. */
export function safeReturn(r) {
  return typeof r === 'string' && /^\/(?![/\\])[\w\-./?=&%:,~+]*$/.test(r) && r.length < 300 ? r : '/sky';
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
function redirect(res, to, setCookies = []) {
  res.writeHead(302, { location: to, 'cache-control': 'no-store', ...(setCookies.length ? { 'set-cookie': setCookies } : {}) });
  res.end();
}
async function getJson(url, token) {
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': 'Starhop' } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('too_large'), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
/** State-changing requests must come from this site (SameSite=Lax already blocks most cross-site ones). */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === String(req.headers['x-forwarded-host'] ?? req.headers.host); } catch { return false; }
}

async function currentUser(req) {
  const raw = cookies(req)[SESSION_COOKIE];
  if (!raw) return null;
  const p = await db();
  if (!p) return null;
  const r = await p.query(
    'SELECT u.id, u.name, u.email, u.avatar, u.provider, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = $1 AND s.expires_at > now()',
    [sha256(raw)],
  );
  return r.rows[0] ?? null;
}
const publicUser = (u) => u && { id: String(u.id), name: u.name, email: u.email, avatar: u.avatar, provider: u.provider, createdAt: u.created_at };

// ───────────────────────────── Routes ─────────────────────────────

/** Handles /auth/* and the account parts of /api/*. Returns true when it answered. */
export async function handleAccount(req, res) {
  const url = new URL(req.url ?? '/', 'http://x');
  const path = url.pathname;
  const auth = path.match(/^\/auth\/(google|github)\/(start|callback)$/);
  if (!auth && path !== '/api/me' && path !== '/api/logout' && !path.startsWith('/api/state')) return false;
  try {
    if (auth) return await (auth[2] === 'start' ? start(req, res, auth[1], url) : callback(req, res, auth[1], url));
    if (path === '/api/me' && req.method === 'GET') {
      const user = accountsEnabled() ? await currentUser(req) : null;
      send(res, 200, { enabled: accountsEnabled(), providers: env.DATABASE_URL ? configured() : [], user: publicUser(user) });
      return true;
    }
    if (!accountsEnabled()) { send(res, 503, { error: 'not_configured' }); return true; }
    if (req.method !== 'GET' && !sameOrigin(req)) { send(res, 403, { error: 'bad_origin' }); return true; }
    if (path === '/api/logout' && req.method === 'POST') {
      const raw = cookies(req)[SESSION_COOKIE];
      if (raw) await (await db()).query('DELETE FROM sessions WHERE id_hash = $1', [sha256(raw)]);
      send(res, 200, { ok: true }, { 'set-cookie': cookie(req, SESSION_COOKIE, '', 0) });
      return true;
    }
    const user = await currentUser(req);
    if (!user) { send(res, 401, { error: 'signed_out' }); return true; }
    const p = await db();
    if (path === '/api/me' && req.method === 'DELETE') {
      await p.query('DELETE FROM users WHERE id = $1', [user.id]);
      send(res, 200, { ok: true }, { 'set-cookie': cookie(req, SESSION_COOKIE, '', 0) });
      return true;
    }
    if (path === '/api/state' && req.method === 'GET') {
      const r = await p.query('SELECT key, data, updated_at FROM user_state WHERE user_id = $1', [user.id]);
      const stores = {};
      for (const row of r.rows) stores[row.key] = { data: row.data, updatedAt: row.updated_at };
      send(res, 200, { stores });
      return true;
    }
    const m = path.match(/^\/api\/state\/([a-z]+)$/);
    if (m && req.method === 'PUT') {
      if (!STATE_KEYS.has(m[1])) { send(res, 404, { error: 'unknown_key' }); return true; }
      let body;
      try { body = JSON.parse(await readBody(req, MAX_STATE_BYTES)); } catch (e) { send(res, e.code === 413 ? 413 : 400, { error: e.code === 413 ? 'too_large' : 'bad_request' }); return true; }
      if (!body || typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) { send(res, 400, { error: 'bad_request' }); return true; }
      const r = await p.query(
        `INSERT INTO user_state (user_id, key, data, updated_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id, key) DO UPDATE SET data = EXCLUDED.data, updated_at = now() RETURNING updated_at`,
        [user.id, m[1], JSON.stringify(body.data)],
      );
      send(res, 200, { updatedAt: r.rows[0].updated_at });
      return true;
    }
    send(res, 404, { error: 'not_found' });
    return true;
  } catch (e) {
    console.error('[account]', e.message);
    if (!res.headersSent) send(res, 500, { error: 'server_error' });
    return true;
  }
}

async function start(req, res, name, url) {
  const prov = PROVIDERS[name];
  if (!accountsEnabled() || !prov.id || !prov.secret) { redirect(res, '/#/sky?signin=unavailable'); return true; }
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(32));
  const ret = safeReturn(url.searchParams.get('return'));
  const q = new URLSearchParams({ client_id: prov.id, redirect_uri: `${baseUrl(req)}/auth/${name}/callback`, response_type: 'code', scope: prov.scope, state });
  if (prov.pkce) { q.set('code_challenge', sha256(verifier)); q.set('code_challenge_method', 'S256'); }
  if (name === 'google') q.set('prompt', 'select_account');
  const flow = sign(b64url(JSON.stringify({ state, verifier, ret, name })));
  redirect(res, `${prov.authUrl}?${q}`, [cookie(req, FLOW_COOKIE, flow, 600)]);
  return true;
}

async function callback(req, res, name, url) {
  const clear = cookie(req, FLOW_COOKIE, '', 0);
  const fail = (why) => { console.warn(`[auth] ${name} sign-in failed: ${why}`); redirect(res, `/#/sky?signin=failed`, [clear]); return true; };
  const prov = PROVIDERS[name];
  if (!accountsEnabled() || !prov.id) return fail('not configured');
  const raw = unsign(cookies(req)[FLOW_COOKIE]);
  let flow;
  try { flow = raw && JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')); } catch { flow = null; }
  if (url.searchParams.get('error')) return fail(url.searchParams.get('error'));
  if (!flow || flow.name !== name || flow.state !== url.searchParams.get('state')) return fail('state mismatch');
  const code = url.searchParams.get('code');
  if (!code) return fail('no code');
  const form = new URLSearchParams({ client_id: prov.id, client_secret: prov.secret, code, redirect_uri: `${baseUrl(req)}/auth/${name}/callback`, grant_type: 'authorization_code' });
  if (prov.pkce) form.set('code_verifier', flow.verifier);
  const tr = await fetch(prov.tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: form });
  const tok = await tr.json().catch(() => null);
  if (!tr.ok || !tok?.access_token) return fail(`token ${tr.status} ${tok?.error ?? ''}`);
  let who;
  try { who = await prov.profile(tok.access_token); } catch (e) { return fail(e.message); }
  const p = await db();
  const u = await p.query(
    `INSERT INTO users (provider, provider_id, email, name, avatar) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (provider, provider_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, avatar = EXCLUDED.avatar, last_seen_at = now()
     RETURNING id`,
    [name, who.providerId, who.email, String(who.name).slice(0, 120), who.avatar],
  );
  const sid = b64url(randomBytes(32));
  await p.query(`INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`, [sha256(sid), u.rows[0].id]);
  await p.query('DELETE FROM sessions WHERE expires_at < now()');
  redirect(res, `/#${flow.ret}`, [clear, cookie(req, SESSION_COOKIE, sid, SESSION_DAYS * 86400)]);
  return true;
}
