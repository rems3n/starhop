// The assistant endpoint for `npm start` (scripts/serve.mjs). Zero dependencies.
//   POST /api/chat         { messages, context } -> { content, stop_reason }   one model turn; the browser runs the tools
//   GET  /api/chat/status  -> { enabled }
// The server owns the system prompt and the tool list (shared/ai-tools.json), so the endpoint cannot be used as a
// general-purpose proxy. Configure with env: ANTHROPIC_API_KEY (required), STARHOP_AI_MODEL, STARHOP_AI_DAILY_LIMIT.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const TOOLS = JSON.parse(readFileSync(join(here, '..', 'shared', 'ai-tools.json'), 'utf8'));
const TOOL_NAMES = new Set(TOOLS.map((t) => t.name));

const MODEL = process.env.STARHOP_AI_MODEL || 'claude-haiku-5-5';
const BASE = process.env.STARHOP_AI_BASE_URL || 'https://api.anthropic.com';
const DAILY_LIMIT = Number(process.env.STARHOP_AI_DAILY_LIMIT) || 3000;
const PER_MINUTE = Number(process.env.STARHOP_AI_PER_MINUTE) || 20;
const PER_DAY_PER_IP = 300;
const MAX_BODY = 60_000;
const MAX_MESSAGES = 40;

export const SYSTEM = `You are the assistant built into Starhop, a planetarium and course for learning the night sky. The learner types short requests into a chat panel next to a live sky map. You act on the app for them through tools and answer questions about the sky.

How to work
- Act, do not describe. If the learner asks to see or change something, call the tool straight away. Never tell them which button to press when a tool can do it.
- You may call several tools for one request, in parallel when they are independent ("show Orion with the figures on" is sky_show plus sky_set_layers).
- Short follow-ups are corrections of what you just did ("no, the star", "the other one", "bigger", "not that, the nebula"). Re-read the previous turns, work out what they meant and fix it; use sky_find to see the alternatives when a name is ambiguous.
- If a request could mean two quite different things and guessing wrong would be annoying, ask one short question instead of guessing. Otherwise take the most likely reading and say which object you chose.
- Every change you make can be undone by the learner with the Undo button, so do not ask for permission for ordinary view changes.

Facts
- Take facts about objects, visibility and times from tool results (sky_describe, sky_find, sky_show), not from memory. The tools compute positions for the learner's own location and the map's current time.
- If a tool says something was not found, say so plainly and offer the nearest matches. Do not invent objects, lessons, myths or sources.
- For myths and lessons, point to the library or course page with app_search and app_open instead of retelling from memory.
- You can answer general astronomy questions briefly from your own knowledge, but keep to what is well established and say when something is uncertain.
- Stay on astronomy, stargazing and using this app. Politely decline anything else in one sentence.

Style
- Reply in one or two short plain sentences, sentence case, no markdown, no headings, no lists unless the learner asks for a list.
- Say what you did and one useful thing about it, for example where to look or when it is best seen. Do not narrate tool calls or mention tool names or refs.
- Times are in the learner's local time zone. Use the 12-hour clock.`;

const hits = new Map(); // ip -> { minute: [timestamps], day, count }
let globalDay = '';
let globalCount = 0;
const today = () => new Date().toISOString().slice(0, 10);

function allow(ip) {
  const now = Date.now();
  const d = today();
  if (globalDay !== d) { globalDay = d; globalCount = 0; hits.clear(); }
  if (globalCount >= DAILY_LIMIT) return 'The assistant has reached its daily limit. Simple commands still work; try again tomorrow.';
  let h = hits.get(ip);
  if (!h) hits.set(ip, (h = { minute: [], count: 0 }));
  h.minute = h.minute.filter((t) => now - t < 60_000);
  if (h.minute.length >= PER_MINUTE) return 'Too many requests. Wait a moment and try again.';
  if (h.count >= PER_DAY_PER_IP) return 'You have reached the daily limit for the assistant. Simple commands still work.';
  h.minute.push(now);
  h.count++;
  globalCount++;
  return null;
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Keep only well-formed blocks the app itself could have produced. Returns null if the conversation is not valid. */
export function sanitizeMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null;
  const out = [];
  for (const m of raw) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return null;
    let blocks;
    if (typeof m.content === 'string') blocks = [{ type: 'text', text: m.content }];
    else if (Array.isArray(m.content)) blocks = m.content;
    else return null;
    const clean = [];
    for (const b of blocks) {
      if (!b || typeof b !== 'object') return null;
      if (b.type === 'text') {
        const text = str(b.text, 4000);
        if (text.trim()) clean.push({ type: 'text', text });
      } else if (b.type === 'tool_use' && m.role === 'assistant') {
        if (!TOOL_NAMES.has(b.name) || typeof b.id !== 'string' || typeof b.input !== 'object' || b.input === null) return null;
        clean.push({ type: 'tool_use', id: b.id.slice(0, 100), name: b.name, input: b.input });
      } else if (b.type === 'tool_result' && m.role === 'user') {
        if (typeof b.tool_use_id !== 'string') return null;
        clean.push({ type: 'tool_result', tool_use_id: b.tool_use_id.slice(0, 100), content: str(typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? ''), 6000), ...(b.is_error ? { is_error: true } : {}) });
      } else return null;
    }
    if (!clean.length) return null;
    out.push({ role: m.role, content: clean });
  }
  if (out[0].role !== 'user' || out[out.length - 1].role !== 'user') return null;
  return out;
}

export function contextText(ctx) {
  if (!ctx || typeof ctx !== 'object') return '';
  let s;
  try { s = JSON.stringify(ctx); } catch { return ''; }
  return s.length > 2500 ? '' : s;
}

function send(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Returns true if the request was an /api/ request and has been answered. */
export async function handleApi(req, res) {
  const path = (req.url ?? '').split('?')[0];
  if (!path.startsWith('/api/')) return false;
  const key = process.env.ANTHROPIC_API_KEY;
  if (path === '/api/chat/status' && req.method === 'GET') { send(res, 200, { enabled: Boolean(key) }); return true; }
  if (path !== '/api/chat') { send(res, 404, { error: 'not_found' }); return true; }
  if (req.method !== 'POST') { send(res, 405, { error: 'method_not_allowed' }); return true; }
  if (!key) { send(res, 503, { error: 'not_configured', message: 'The assistant is not set up on this server yet.' }); return true; }
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim() || 'unknown';
  const blocked = allow(ip);
  if (blocked) { send(res, 429, { error: 'rate_limited', message: blocked }); return true; }
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { send(res, 400, { error: 'bad_request' }); return true; }
  const messages = sanitizeMessages(body?.messages);
  if (!messages) { send(res, 400, { error: 'bad_request' }); return true; }
  const ctx = contextText(body?.context);
  const system = [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }];
  if (ctx) system.push({ type: 'text', text: `Current state of the app (JSON, read-only, refreshed every turn):\n${ctx}` });
  try {
    const r = await fetch(`${BASE}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system, tools: TOOLS, messages }),
      signal: AbortSignal.timeout(45_000),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data || !Array.isArray(data.content)) {
      console.error('assistant upstream error', r.status, JSON.stringify(data)?.slice(0, 300));
      send(res, 502, { error: 'upstream', message: 'The assistant could not answer just now. Try again.' });
      return true;
    }
    send(res, 200, { content: data.content.filter((b) => b.type === 'text' || b.type === 'tool_use'), stop_reason: data.stop_reason });
  } catch (e) {
    console.error('assistant request failed', e?.message);
    send(res, 502, { error: 'upstream', message: 'The assistant could not answer just now. Try again.' });
  }
  return true;
}
