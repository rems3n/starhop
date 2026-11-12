/**
 * Sign-in and saved state, end to end against the real server (scripts/serve.mjs) and a real Postgres, with a small
 * stand-in for Google's OAuth endpoints. Runs only when TEST_DATABASE_URL is set (an empty database it may write to).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!DB)('accounts on the server', () => {
  let fake: Server;
  let app: ChildProcess;
  let base = '';
  let fakeBase = '';
  let nextUser = { sub: 'g-1', email: 'ada@example.com', name: 'Ada', picture: 'https://example.com/a.png' };
  const seen: { verifier?: string; challenge?: string } = {};

  beforeAll(async () => {
    fake = createServer(async (req, res) => {
      const u = new URL(req.url!, 'http://x');
      if (u.pathname === '/authorize') {
        seen.challenge = u.searchParams.get('code_challenge') ?? undefined;
        const back = new URL(u.searchParams.get('redirect_uri')!);
        back.searchParams.set('code', `code-for-${nextUser.sub}`);
        back.searchParams.set('state', u.searchParams.get('state')!);
        res.writeHead(302, { location: back.toString() }).end();
      } else if (u.pathname === '/token') {
        let body = '';
        for await (const c of req) body += c;
        const f = new URLSearchParams(body);
        seen.verifier = f.get('code_verifier') ?? undefined;
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ access_token: `tok-${f.get('code')}` }));
      } else if (u.pathname === '/userinfo') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ...nextUser, email_verified: true }));
      } else res.writeHead(404).end();
    });
    await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
    fakeBase = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
    const port = 4300 + Math.floor(Math.random() * 500);
    base = `http://127.0.0.1:${port}`;
    app = spawn(process.execPath, ['scripts/serve.mjs', 'dist'], {
      env: {
        ...process.env, PORT: String(port), DATABASE_URL: DB, STARHOP_PUBLIC_URL: base, SESSION_SECRET: 'test',
        GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csecret',
        GOOGLE_AUTH_URL: `${fakeBase}/authorize`, GOOGLE_TOKEN_URL: `${fakeBase}/token`, GOOGLE_USERINFO_URL: `${fakeBase}/userinfo`,
        GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: '', RAILWAY_PUBLIC_DOMAIN: '',
      },
      stdio: 'ignore',
    });
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${base}/api/me`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
  });
  afterAll(() => {
    app?.kill();
    fake?.close();
  });

  /** Walks the redirects of a sign-in and returns the session cookie and where the browser ends up. */
  async function signIn(provider = 'google', ret = '/learn') {
    const r1 = await fetch(`${base}/auth/${provider}/start?return=${encodeURIComponent(ret)}`, { redirect: 'manual' });
    expect(r1.status).toBe(302);
    const flowCookie = r1.headers.getSetCookie()[0].split(';')[0];
    const r2 = await fetch(r1.headers.get('location')!, { redirect: 'manual' });
    const r3 = await fetch(r2.headers.get('location')!, { redirect: 'manual', headers: { cookie: flowCookie } });
    const session = r3.headers.getSetCookie().find((c) => c.startsWith('sh_session=') && !c.startsWith('sh_session=;'));
    return { location: r3.headers.get('location'), cookie: session?.split(';')[0] ?? '', setCookies: r3.headers.getSetCookie() };
  }

  it('reports which providers are switched on', async () => {
    const me = await (await fetch(`${base}/api/me`)).json();
    expect(me).toEqual({ enabled: true, providers: ['google'], user: null });
  });

  it('signs in with PKCE, sets an HttpOnly session cookie and returns to the page', async () => {
    const s = await signIn('google', '/learn/lesson/star-hopping');
    expect(s.location).toBe('/#/learn/lesson/star-hopping');
    expect(s.cookie).toMatch(/^sh_session=.{20,}/);
    expect(s.setCookies.find((c) => c.startsWith('sh_session='))).toMatch(/HttpOnly; SameSite=Lax/);
    expect(seen.challenge).toBeTruthy();
    expect(seen.verifier).toBeTruthy();
    const me = await (await fetch(`${base}/api/me`, { headers: { cookie: s.cookie } })).json();
    expect(me.user).toMatchObject({ name: 'Ada', email: 'ada@example.com', provider: 'google' });
  });

  it('refuses a callback whose state does not match', async () => {
    const r = await fetch(`${base}/auth/google/callback?code=x&state=forged`, { redirect: 'manual' });
    expect(r.headers.get('location')).toBe('/#/sky?signin=failed');
    expect(r.headers.getSetCookie().some((c) => c.startsWith('sh_session=') && !c.startsWith('sh_session=;'))).toBe(false);
  });

  it('only returns to in-app paths', async () => {
    const s = await signIn('google', '//evil.example/x');
    expect(s.location).toBe('/#/sky');
  });

  it('saves and loads state per user, and keeps users apart', async () => {
    nextUser = { sub: 'g-2', email: 'bo@example.com', name: 'Bo', picture: '' };
    const bo = await signIn();
    nextUser = { sub: 'g-3', email: 'cy@example.com', name: 'Cy', picture: '' };
    const cy = await signIn();
    const put = await fetch(`${base}/api/state/settings`, { method: 'PUT', headers: { cookie: bo.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ data: { redMode: true } }) });
    expect(put.status).toBe(200);
    const boState = await (await fetch(`${base}/api/state`, { headers: { cookie: bo.cookie } })).json();
    expect(boState.stores.settings.data).toEqual({ redMode: true });
    const cyState = await (await fetch(`${base}/api/state`, { headers: { cookie: cy.cookie } })).json();
    expect(cyState.stores).toEqual({});
  });

  it('rejects unknown keys, bad bodies, other origins and signed-out requests', async () => {
    nextUser = { sub: 'g-4', email: null as unknown as string, name: 'Di', picture: '' };
    const di = await signIn();
    const h = { cookie: di.cookie, 'content-type': 'application/json' };
    expect((await fetch(`${base}/api/state/secrets`, { method: 'PUT', headers: h, body: '{"data":{}}' })).status).toBe(404);
    expect((await fetch(`${base}/api/state/quiz`, { method: 'PUT', headers: h, body: '{"data":[1]}' })).status).toBe(400);
    expect((await fetch(`${base}/api/state/quiz`, { method: 'PUT', headers: { ...h, origin: 'https://evil.example' }, body: '{"data":{}}' })).status).toBe(403);
    expect((await fetch(`${base}/api/state`)).status).toBe(401);
  });

  it('signs out and deletes accounts', async () => {
    nextUser = { sub: 'g-5', email: 'ed@example.com', name: 'Ed', picture: '' };
    const ed = await signIn();
    await fetch(`${base}/api/logout`, { method: 'POST', headers: { cookie: ed.cookie } });
    expect((await (await fetch(`${base}/api/me`, { headers: { cookie: ed.cookie } })).json()).user).toBeNull();
    const ed2 = await signIn();
    expect((await fetch(`${base}/api/me`, { method: 'DELETE', headers: { cookie: ed2.cookie } })).status).toBe(200);
    expect((await (await fetch(`${base}/api/me`, { headers: { cookie: ed2.cookie } })).json()).user).toBeNull();
  });

  it('sends sign-in for a provider that is not set up back with a note', async () => {
    const r = await fetch(`${base}/auth/github/start`, { redirect: 'manual' });
    expect(r.headers.get('location')).toBe('/#/sky?signin=unavailable');
  });
});
