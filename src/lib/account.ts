/**
 * Signing in and keeping a signed-in learner's state on the server.
 *
 * Guests keep everything in this browser (localStorage), as before. When someone signs in, their settings,
 * progress, practice preferences and Learn state are saved to their account and loaded on any device.
 *
 * On sign-in: progress from this browser and from the account are merged (nothing learned is lost). For the other
 * stores the account wins, unless this browser (already signed in to that account) has changes that were never uploaded. A browser last used by a
 * different account is cleared first, so one person's data never leaks into another's.
 */
import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import { useSettings, withDefaults } from '@/store/settings';
import { useProgress, type ItemProgress } from '@/store/progress';
import { useQuizPrefs } from '@/modes/quiz/prefs';
import { useLearnLocal } from '@/modes/learn/hooks';

export type OAuthProvider = 'google' | 'github';
export type Provider = OAuthProvider | 'email';
export const PROVIDER_LABEL: Record<Provider, string> = { google: 'Google', github: 'GitHub', email: 'email and password' };
export const PASSWORD_MIN = 10;

export interface AccountUser {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  provider: Provider;
  createdAt: string;
}

type Status = 'loading' | 'guest' | 'signed-in';
type Sync = 'idle' | 'saving' | 'saved' | 'offline';

interface AccountState {
  status: Status;
  /** Accounts are switched on on this server (database and at least one provider configured) */
  enabled: boolean;
  providers: Provider[];
  user: AccountUser | null;
  sync: Sync;
  lastSaved: number | null;
}

export const useAccount = create<AccountState>()(() => ({ status: 'loading', enabled: false, providers: [], user: null, sync: 'idle', lastSaved: null }));

// ───────────────────────────── Stores that follow the account ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStore = UseBoundStore<StoreApi<any>>;
const STORES: Record<string, AnyStore> = { settings: useSettings, progress: useProgress, quiz: useQuizPrefs, learn: useLearnLocal };
type Key = keyof typeof STORES;
const KEYS = Object.keys(STORES) as Key[];

const OWNER_KEY = 'starhop.account.owner';
const DIRTY_KEY = 'starhop.account.dirty';

function ls<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function lsSet(k: string, v: unknown) {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ }
}

/** The saveable part of a store: its data, without the action functions. */
export function snapshot(key: Key): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(STORES[key].getState())) if (typeof v !== 'function') out[k] = v;
  if (key === 'settings') { delete out.layers; delete out.bortle; } // this visit's values; the defaults are saved
  return out;
}

let applying = false;
function apply(key: Key, data: Record<string, unknown>) {
  applying = true;
  try {
    if (key === 'settings') useSettings.setState((s) => withDefaults({ ...s, ...data }));
    else STORES[key].setState(data);
  } finally { applying = false; }
}
function resetStores() {
  applying = true;
  try { for (const k of KEYS) STORES[k].setState(STORES[k].getInitialState(), true); } finally { applying = false; }
}

// ───────────────────────────── Merging progress ─────────────────────────────

const minTime = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.min(a, b));
function mergeTimes(a: Record<string, number> = {}, b: Record<string, number> = {}) {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = minTime(out[k], v)!;
  return out;
}
/** Two copies of learning progress → one, keeping for each item whichever has seen more practice. */
export function mergeProgress(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const ai = (a.items ?? {}) as Record<string, ItemProgress>;
  const bi = (b.items ?? {}) as Record<string, ItemProgress>;
  const items: Record<string, ItemProgress> = { ...ai };
  for (const [id, p] of Object.entries(bi)) {
    const q = items[id];
    items[id] = !q || p.attempts > q.attempts || (p.attempts === q.attempts && p.last > q.last) ? p : q;
  }
  const us = { ...((a.unitScores ?? {}) as Record<string, number>) };
  for (const [k, v] of Object.entries((b.unitScores ?? {}) as Record<string, number>)) us[k] = Math.max(us[k] ?? 0, v);
  return {
    items,
    lessonsDone: mergeTimes(a.lessonsDone as Record<string, number>, b.lessonsDone as Record<string, number>),
    unitScores: us,
    seen: mergeTimes(a.seen as Record<string, number>, b.seen as Record<string, number>),
  };
}
function mergeLearn(a: Record<string, unknown>, b: Record<string, unknown>) {
  return { asterismsSeen: mergeTimes(a.asterismsSeen as Record<string, number>, b.asterismsSeen as Record<string, number>) };
}

// ───────────────────────────── Talking to the server ─────────────────────────────

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { credentials: 'same-origin', ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!r.ok) throw Object.assign(new Error(`${path} ${r.status}`), { status: r.status });
  return r.json() as Promise<T>;
}

const timers = new Map<Key, number>();
let unsubs: (() => void)[] = [];

function markDirty(key: Key) {
  const d = ls<Record<string, number>>(DIRTY_KEY, {});
  d[key] = Date.now();
  lsSet(DIRTY_KEY, d);
}
function clearDirty(key: Key, since: number) {
  const d = ls<Record<string, number>>(DIRTY_KEY, {});
  if (d[key] !== undefined && d[key] <= since) { delete d[key]; lsSet(DIRTY_KEY, d); }
}

async function push(key: Key, opts: { keepalive?: boolean } = {}) {
  if (useAccount.getState().status !== 'signed-in') return;
  const started = Date.now();
  useAccount.setState({ sync: 'saving' });
  try {
    await api(`/api/state/${key}`, { method: 'PUT', body: JSON.stringify({ data: snapshot(key) }), keepalive: opts.keepalive });
    clearDirty(key, started);
    useAccount.setState({ sync: 'saved', lastSaved: Date.now() });
  } catch (e) {
    if ((e as { status?: number }).status === 401) { signedOutElsewhere(); return; }
    useAccount.setState({ sync: 'offline' });
  }
}
function schedule(key: Key) {
  window.clearTimeout(timers.get(key));
  timers.set(key, window.setTimeout(() => { timers.delete(key); void push(key); }, 1200));
}
function flush() {
  for (const [key, t] of timers) { window.clearTimeout(t); void push(key, { keepalive: true }); }
  timers.clear();
}

function watch() {
  for (const u of unsubs) u();
  unsubs = KEYS.map((key) => STORES[key].subscribe(() => {
    if (applying) return;
    markDirty(key);
    if (useAccount.getState().status === 'signed-in') schedule(key);
  }));
}

/** Load the account's state and reconcile it with this browser's. */
async function pull(user: AccountUser) {
  const { stores } = await api<{ stores: Partial<Record<Key, { data: Record<string, unknown> }>> }>('/api/state');
  const owner = ls<string | null>(OWNER_KEY, null);
  if (owner && owner !== user.id) {
    // This browser belonged to someone else: start clean.
    resetStores();
    lsSet(DIRTY_KEY, null);
  }
  const dirty = ls<Record<string, number>>(DIRTY_KEY, {});
  // A guest's first sign-in on this browser brings their local work along.
  const bringLocal = !owner;
  const toPush: Key[] = [];
  for (const key of KEYS) {
    const remote = stores[key]?.data;
    const local = snapshot(key);
    if (!remote) { toPush.push(key); continue; }
    if (key === 'progress') {
      const merged = mergeProgress(remote, local);
      apply(key, merged);
      if (JSON.stringify(merged) !== JSON.stringify(remote)) toPush.push(key);
    } else if (key === 'learn') {
      apply(key, mergeLearn(remote, local));
      toPush.push(key);
    } else if (!bringLocal && dirty[key] !== undefined) {
      // changed here while offline or before the last upload finished
      toPush.push(key);
    } else {
      // the account's preferences win over a guest's (or an untouched browser's)
      apply(key, remote);
      clearDirty(key, Date.now());
    }
  }
  lsSet(OWNER_KEY, user.id);
  for (const key of toPush) await push(key);
  if (!toPush.length) useAccount.setState({ sync: 'saved', lastSaved: Date.now() });
}

function signedOutElsewhere() {
  useAccount.setState({ status: 'guest', user: null, sync: 'idle' });
}

let started = false;
/** Called once at start-up. */
export async function initAccount() {
  if (started) return;
  started = true;
  watch();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else if (useAccount.getState().status === 'signed-in' && !timers.size) {
      const u = useAccount.getState().user;
      if (u) pull(u).catch(() => useAccount.setState({ sync: 'offline' }));
    }
  });
  try {
    const me = await api<{ enabled: boolean; providers: Provider[]; user: AccountUser | null }>('/api/me');
    useAccount.setState({ enabled: me.enabled, providers: me.providers, user: me.user, status: me.user ? 'signed-in' : 'guest' });
    if (me.user) await pull(me.user);
  } catch {
    // Static hosting or the dev server: no accounts, the app works as a guest.
    useAccount.setState({ status: 'guest', enabled: false, providers: [] });
  }
}

/** Where the sign-in button goes: the provider, then back to the page the learner was on. */
export function signInUrl(provider: OAuthProvider, returnTo?: string) {
  const here = returnTo ?? (window.location.hash.replace(/^#/, '') || '/sky');
  return `/auth/${provider}/start?return=${encodeURIComponent(here === '/' ? '/sky' : here)}`;
}

/** The page the learner is on, as a path to come back to after signing in. */
export function currentPath() {
  const here = window.location.hash.replace(/^#/, '') || '/sky';
  return here === '/' || here.startsWith('/signin') ? '/sky' : here;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const j = (await r.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!r.ok || !j) throw new Error(j?.message ?? 'That did not work. Try again in a moment.');
  return j;
}

/** Sign in or create an account with an email and password. Throws an Error whose message can be shown as is. */
export async function emailAuth(mode: 'login' | 'signup', fields: { email: string; password: string; name?: string }) {
  const { user } = await post<{ user: AccountUser }>(mode === 'signup' ? '/api/signup' : '/api/login', fields);
  useAccount.setState({ user, status: 'signed-in' });
  await pull(user).catch(() => useAccount.setState({ sync: 'offline' }));
}

export async function changePassword(current: string, next: string) {
  await post('/api/password', { current, next });
}

export async function signOut() {
  flush();
  try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch { /* signed out locally regardless */ }
  resetStores();
  lsSet(OWNER_KEY, null);
  lsSet(DIRTY_KEY, null);
  useAccount.setState({ status: 'guest', user: null, sync: 'idle', lastSaved: null });
}

export async function deleteAccount() {
  await api('/api/me', { method: 'DELETE', body: '{}' });
  resetStores();
  lsSet(OWNER_KEY, null);
  lsSet(DIRTY_KEY, null);
  useAccount.setState({ status: 'guest', user: null, sync: 'idle', lastSaved: null });
}

/** Everything Starhop keeps for this learner, as one JSON document. */
export function exportData() {
  const data: Record<string, unknown> = { exportedAt: new Date().toISOString(), app: 'Starhop' };
  for (const k of KEYS) data[k] = snapshot(k);
  return data;
}

/** Wipe learning progress (keeps settings). Saved to the account like any other change. */
export function resetProgress() {
  useProgress.getState().reset();
  useLearnLocal.setState({ asterismsSeen: {} });
}
