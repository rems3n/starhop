/**
 * The conversation: state for the chat panel plus the loop that turns a typed request into actions.
 * Plain commands run instantly through the local matcher; everything else goes to /api/chat, which returns tool
 * calls that are executed here in the browser and reported back until the model has a final reply.
 */
import { create } from 'zustand';
import { loadCatalog } from '@/data/catalog';
import { actionLabel, CHANGES_STATE, describeState, restoreSnapshot, resultSentence, runTool, takeSnapshot, type ActionEnv, type Snapshot, type ToolInput, type ToolResult } from './actions';
import { matchLocal, type LocalCall } from './local';

export interface ChatItem {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** What was changed, one short line each */
  actions?: string[];
  /** State before this turn, present when the turn changed something */
  undo?: Snapshot;
  undone?: boolean;
  error?: boolean;
  /** One-tap follow-ups */
  chips?: { label: string; calls: LocalCall[] }[];
}

type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: ToolInput } | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
interface ApiMessage { role: 'user' | 'assistant'; content: Block[] }

interface ChatState {
  busy: boolean;
  items: ChatItem[];
  /** null = not checked yet */
  aiEnabled: boolean | null;
  /** Ask the server once whether the model is available */
  checkStatus(): void;
  /** `preset` runs the given actions directly (follow-up chips) instead of interpreting the text */
  send(text: string, env: ActionEnv, preset?: LocalCall[]): Promise<void>;
  undo(id: number, env: ActionEnv): Promise<void>;
  clear(): void;
}

const MAX_STEPS = 6;
const MAX_HISTORY = 24;
const OFFLINE = 'I can only follow simple commands right now: show an object by name, turn layers on or off, zoom, face a direction, change the time, or open a section. The full assistant is not available on this server.';

let nextId = 1;
let history: ApiMessage[] = [];
let localSeq = 0;

/** Keep the tail of the conversation, starting on a plain user message so tool calls and results stay paired. */
export function trimHistory(messages: ApiMessage[], max = MAX_HISTORY): ApiMessage[] {
  if (messages.length <= max) return messages;
  let start = messages.length - max;
  while (start < messages.length && !(messages[start].role === 'user' && messages[start].content.every((b) => b.type === 'text'))) start++;
  return messages.slice(start);
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

async function objectTest(): Promise<(phrase: string) => boolean> {
  const catalog = await loadCatalog();
  return (phrase) => {
    const q = norm(phrase);
    if (q.length < 2) return false;
    return catalog.search(q, 4).some((t) => {
      const names = [t.name, t.constellation?.english, t.constellation?.id, t.dso?.id, t.dso?.messier ? `m${t.dso.messier}` : '', t.dso?.messier ? `messier ${t.dso.messier}` : '', t.star?.desig, ...(t.dso?.aka ?? [])];
      return names.some((n) => n && (norm(n) === q || norm(n).replace(/^the /, '') === q || norm(n).replace(/\s/g, '') === q.replace(/\s/g, '')));
    });
  };
}

async function callModel(messages: ApiMessage[], context: unknown): Promise<{ content: Block[]; stop_reason?: string } | { unavailable: true } | { error: string }> {
  let r: Response;
  try {
    r = await fetch('api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages, context }) });
  } catch {
    return { unavailable: true };
  }
  const data = await r.json().catch(() => null);
  // a static host answers /api/chat with the app's HTML (not JSON) or 404/405: there is no assistant there
  if (r.status === 503 || r.status === 404 || r.status === 405 || (r.ok && !data)) return { unavailable: true };
  if (!r.ok || !data || !Array.isArray(data.content)) return { error: (data && typeof data.message === 'string' && data.message) || 'The assistant could not answer just now. Try again.' };
  return data;
}

export const useChat = create<ChatState>()((set, get) => {
  const add = (item: Omit<ChatItem, 'id'>) => set((s) => ({ items: [...s.items, { ...item, id: nextId++ }] }));

  return {
    busy: false,
    items: [],
    aiEnabled: null,
    checkStatus: () => {
      if (get().aiEnabled !== null) return;
      fetch('api/chat/status').then((r) => r.json()).then((d) => set({ aiEnabled: Boolean(d?.enabled) }), () => set({ aiEnabled: false }));
    },
    clear: () => {
      history = [];
      set({ items: [] });
    },
    undo: async (id, env) => {
      const item = get().items.find((i) => i.id === id);
      if (!item?.undo || item.undone) return;
      await restoreSnapshot(item.undo, env);
      set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, undone: true } : i)) }));
      history.push({ role: 'user', content: [{ type: 'text', text: '(The learner pressed Undo: your last changes were reverted.)' }] }, { role: 'assistant', content: [{ type: 'text', text: 'Undone.' }] });
    },
    send: async (raw, env, preset) => {
      const text = raw.trim().slice(0, 500);
      if (!text || get().busy) return;
      set({ busy: true });
      add({ role: 'user', text });
      const snap = takeSnapshot(env);
      const actions: string[] = [];
      let changed = false;
      const run = async (name: string, input: ToolInput): Promise<ToolResult> => {
        const result = await runTool(name, input, env);
        if (result.ok && CHANGES_STATE.has(name)) changed = true;
        const label = actionLabel(name, result);
        if (label) actions.push(label);
        return result;
      };
      let chips: ChatItem['chips'];
      const finish = (reply: string, error = false) => {
        add({ role: 'assistant', text: reply, actions: actions.length ? actions : undefined, undo: changed ? snap : undefined, error, chips });
        set({ busy: false });
      };
      try {
        // 1. instant path
        const local = preset ?? matchLocal(text, await objectTest());
        if (local) {
          const sentences: string[] = [];
          const blocks: Block[] = [];
          const results: Block[] = [];
          for (const call of local) {
            const result = await run(call.name, call.input);
            sentences.push(resultSentence(call.name, result));
            // shown but under the horizon: offer the moment tonight when it is best placed
            if (call.name === 'sky_show' && result.ok && result.above_horizon === false && result.best_time_tonight && !call.input.at_best_time)
              chips = [{ label: `Show it at ${String(result.best_time_tonight)}`, calls: [{ name: 'sky_show', input: { target: String(result.ref), at_best_time: true } }] }];
            const id = `local_${++localSeq}`;
            blocks.push({ type: 'tool_use', id, name: call.name, input: call.input });
            results.push({ type: 'tool_result', tool_use_id: id, content: JSON.stringify(result) });
          }
          const reply = sentences.join(' ');
          // recorded in the same shape as a model turn, so a later correction ("no, the star") has the context
          history.push({ role: 'user', content: [{ type: 'text', text }] }, { role: 'assistant', content: blocks }, { role: 'user', content: results }, { role: 'assistant', content: [{ type: 'text', text: reply }] });
          finish(reply);
          return;
        }
        // 2. the model
        const userMsg: ApiMessage = { role: 'user', content: [{ type: 'text', text }] };
        history.push(userMsg);
        for (let step = 0; step < MAX_STEPS; step++) {
          history = trimHistory(history);
          const res = await callModel(history, describeState(env));
          if ('unavailable' in res || 'error' in res) {
            // drop the unanswered turn so the next request starts from a consistent conversation
            const at = history.indexOf(userMsg);
            if (at >= 0) history.length = at;
            if ('unavailable' in res) set({ aiEnabled: false });
            finish('unavailable' in res ? OFFLINE : res.error, true);
            return;
          }
          set({ aiEnabled: true });
          history.push({ role: 'assistant', content: res.content });
          const calls = res.content.filter((b): b is Extract<Block, { type: 'tool_use' }> => b.type === 'tool_use');
          if (!calls.length) {
            const reply = res.content.filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text').map((b) => b.text).join('\n').trim();
            finish(reply || (actions.length ? 'Done.' : 'I am not sure what to do with that. Could you say it another way?'));
            return;
          }
          const results: Block[] = [];
          for (const c of calls) {
            const result = await run(c.name, c.input);
            results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(result), ...(result.ok ? {} : { is_error: true }) });
          }
          history.push({ role: 'user', content: results });
        }
        history.push({ role: 'assistant', content: [{ type: 'text', text: 'Stopped after several steps.' }] });
        finish(actions.length ? 'I did what I could; tell me what is still missing.' : 'That took too many steps. Try a simpler request.');
      } catch (e) {
        finish(e instanceof Error ? e.message : 'Something went wrong.', true);
      }
    },
  };
});

/** For tests */
export const _internal = { reset: () => { history = []; nextId = 1; }, history: () => history };
