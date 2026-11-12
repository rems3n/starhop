/**
 * Instant path: plain commands the app can understand without a model ("lines off", "zoom in", "show me Orion").
 * Pure: text in, tool calls out. Anything it is not sure about returns null and goes to the model instead.
 */
import { LAYER_PARAMS, SECTIONS, type ToolInput } from './actions';

export interface LocalCall { name: string; input: ToolInput }
/** What kind of sentence to build from the results when a question was answered without the model */
export type AnswerKind = 'about' | 'when' | 'highest' | 'distance' | 'brightness' | 'find' | 'photo' | 'content' | 'tonight';
export interface LocalPlan { calls: LocalCall[]; answer?: AnswerKind }

/** Words people use for each layer (matched against the whole remaining phrase). */
const LAYER_WORDS: Record<string, string[]> = {
  constellation_lines: ['lines', 'constellation lines', 'stick figures', 'line', 'the lines'],
  constellation_names: ['constellation names', 'constellation labels'],
  constellation_boundaries: ['boundaries', 'borders', 'constellation boundaries', 'constellation borders'],
  constellation_figures: ['figures', 'pictures', 'illustrations', 'art', 'artwork', 'constellation art', 'constellation figures', 'constellation pictures', 'constellation images', 'images', 'drawings'],
  star_names: ['star names', 'star labels'],
  deep_sky_markers: ['deep sky markers', 'deep-sky markers', 'deep sky objects', 'deep-sky objects', 'dso markers', 'dsos', 'messier objects', 'markers'],
  deep_zoom: ['deep zoom', 'faint stars', 'fainter stars'],
  planets: ['planets'],
  ecliptic: ['ecliptic'],
  equatorial_grid: ['equatorial grid', 'ra dec grid', 'grid'],
  altaz_grid: ['azimuthal grid', 'altaz grid', 'alt az grid', 'alt-az grid', 'altitude grid'],
  horizon: ['horizon', 'compass', 'compass points', 'cardinal directions'],
  ground: ['ground', 'landscape'],
  atmosphere: ['atmosphere', 'daylight', 'sky glow'],
  milky_way: ['milky way', 'milkyway'],
};
const LAYER_GROUPS: Record<string, string[]> = {
  labels: ['constellation_names', 'star_names'],
  names: ['constellation_names', 'star_names'],
  grids: ['equatorial_grid', 'altaz_grid'],
  constellations: ['constellation_lines', 'constellation_names'],
};
const LAYER_LOOKUP = new Map<string, string[]>();
for (const [param, words] of Object.entries(LAYER_WORDS)) if (param in LAYER_PARAMS) for (const w of words) LAYER_LOOKUP.set(w, [param]);
for (const [w, params] of Object.entries(LAYER_GROUPS)) LAYER_LOOKUP.set(w, params);

const ON = /^(?:turn on|switch on|enable|show me|show|display|add|draw)$/;
const OFF = /^(?:turn off|switch off|disable|hide|remove|no|kill|lose|get rid of)$/;
const DIRECTIONS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

const clean = (s: string) => s.toLowerCase().replace(/[.!?]+$/g, '').replace(/\bplease\b/g, '').replace(/^(?:can|could|would) you\s+/, '').replace(/\s+/g, ' ').trim();
const noThe = (s: string) => s.replace(/^the\s+/, '');

function layerPhrase(phrase: string): string[] | null {
  return LAYER_LOOKUP.get(noThe(phrase).replace(/\s+layer$/, '')) ?? null;
}

function layerCall(params: string[], on: boolean): LocalCall {
  return { name: 'sky_set_layers', input: Object.fromEntries(params.map((p) => [p, on])) };
}

function matchCommands(t: string, lookup: Lookup): LocalCall[] | null {
  const isObject = (p: string) => lookup(p) !== null;

  // layers: "<verb> <layer>", "<layer> on|off", "turn <layer> on|off", "turn the lines back on"
  let m = /^(turn on|turn off|switch on|switch off|enable|disable|show me|show|hide|display|remove|add|draw|no|kill|lose|get rid of)\s+(.+)$/.exec(t);
  if (m) {
    const params = layerPhrase(m[2]);
    // "show planets" is a layer; "show orion" is an object and is handled below
    if (params && (ON.test(m[1]) || OFF.test(m[1]))) return [layerCall(params, ON.test(m[1]))];
  }
  m = /^(?:turn |switch )?(.+?)\s+(?:back\s+)?(on|off)$/.exec(t);
  if (m) {
    const params = layerPhrase(m[1]);
    if (params) return [layerCall(params, m[2] === 'on')];
  }

  // view
  if (/^zoom (?:in|closer)$|^closer$|^zoom in (?:a bit|more)$/.test(t)) return [{ name: 'sky_set_view', input: { zoom: 'in' } }];
  if (/^zoom (?:out|back)$|^zoom out (?:a bit|more)$/.test(t)) return [{ name: 'sky_set_view', input: { zoom: 'out' } }];
  if (/^zoom (?:all the way|way) in$/.test(t)) return [{ name: 'sky_set_view', input: { zoom: 'far_in' } }];
  if (/^zoom (?:all the way|way) out$/.test(t)) return [{ name: 'sky_set_view', input: { zoom: 'far_out' } }];
  if (/^(?:reset|reset (?:the )?view|home|default view|go home)$/.test(t)) return [{ name: 'sky_set_view', input: { reset: true } }];
  m = /^(?:face|look|turn|go|show|show me)\s+(?:to the |toward |towards |the )?(north|northeast|east|southeast|south|southwest|west|northwest)$/.exec(t.replace(/[- ](east|west)\b/g, '$1'));
  if (m && DIRECTIONS.includes(m[1])) return [{ name: 'sky_set_view', input: { face: m[1] } }];
  if (DIRECTIONS.includes(t)) return [{ name: 'sky_set_view', input: { face: t } }];
  if (/^(?:look (?:straight )?up|zenith|overhead|look overhead|show (?:me )?the zenith)$/.test(t)) return [{ name: 'sky_set_view', input: { face: 'zenith' } }];

  if (/^(?:atlas|atlas mode|atlas view|show (?:the )?atlas|switch to (?:the )?atlas|star chart|chart mode)$/.test(t)) return [{ name: 'sky_set_view', input: { mode: 'atlas' } }];
  if (/^(?:live|live sky|live mode|live view|switch to (?:the )?live sky|back to (?:the )?live sky|my sky)$/.test(t)) return [{ name: 'sky_set_view', input: { mode: 'live' } }];

  // clock
  if (/^(?:now|go to now|back to now|current time|right now|reset (?:the )?time|real time)$/.test(t)) return [{ name: 'sky_set_time', input: { time: 'now', speed: 'real_time' } }];
  if (/^(?:pause|stop|freeze|pause time|stop time|freeze time|pause the clock|stop the clock)$/.test(t)) return [{ name: 'sky_set_time', input: { speed: 'paused' } }];
  if (/^(?:play|resume|unpause|start time|resume time)$/.test(t)) return [{ name: 'sky_set_time', input: { speed: 'real_time' } }];
  if (/^(?:speed up|speed up time|fast forward|faster)$/.test(t)) return [{ name: 'sky_set_time', input: { speed: 'fast' } }];
  if (/^(?:clear|deselect|clear selection|close (?:the )?panel|unselect)$/.test(t)) return [{ name: 'sky_show', input: { target: 'none' } }];

  // sections
  m = /^(?:open|go to|goto|show|show me|take me to)\s+(?:the\s+)?(.+?)(?:\s+(?:page|section|tab|list))?$/.exec(t);
  if (m) {
    const key = m[1].replace(/^sky map$|^map$/, 'sky').replace(/^course$|^lessons$/, 'learn').replace(/^quiz(?:zes)?$/, 'practice').replace(/^star[- ]hops$/, 'starhops').replace(/^deep[- ]sky objects$/, 'objects');
    // a section name that is also an object or a layer ("planets", "stars") is only a section with an explicit "open"
    if (key in SECTIONS && (!isObject(key) || /^open\b/.test(t)) && !(LAYER_LOOKUP.has(key) && !/^(?:open|go to|goto|take me to)\b/.test(t))) return [{ name: 'app_open', input: { path: key } }];
  }

  return null;
}

const OBJ = '(.+?)';
const end = '(?: (?:tonight|right now|now|from here|today|this evening))?$';
/** Question shapes that Starhop's own data can answer: [pattern, kind]. The object phrase is capture group 1. */
const QUESTIONS: [RegExp, AnswerKind][] = [
  [new RegExp(`^(?:show me|show|open|get me|give me|display|see|let me see|i want to see|can i see)? ?(?:a |an |the |some )?(?:photos?|pictures?|pics?|images?|photographs?) of ${OBJ}$`), 'photo'],
  [new RegExp(`^(?:what does|how does) ${OBJ} look like$`), 'photo'],
  [new RegExp(`^(?:what|which) (?:month|months|time of year|season|part of the year) (?:is|does|are|will|can)(?: i see)? ${OBJ}(?: (?:directly |straight |right )?(?:overhead|highest|at its highest|high(?:est)? in the sky|best|best seen|visible|up|culminate|culminates|pass overhead)| best seen| at its best)?(?: (?:of|over|in|from|above|at) .+)?$`), 'highest'],
  [new RegExp(`^(?:when is|when does|is|does) ${OBJ} (?:ever )?(?:(?:directly |straight |right )?overhead|highest|at its highest|highest in the sky|culminate|culminates|pass overhead|go overhead)(?: (?:of|over|in|from|above|at) .+)?$`), 'highest'],
  [new RegExp(`^how high does ${OBJ} get(?: (?:in|from|over) .+)?$`), 'highest'],
  [new RegExp(`^(?:when can i see|when is the best time to see|when is|when does|whens|when will i see|what time (?:can i see|is|does)) ${OBJ}(?: visible| up| rise| rising| out| best| best seen)?${end}`), 'when'],
  [new RegExp(`^(?:can i see|is) ${OBJ}(?: visible| up| out)?${end}`), 'when'],
  [new RegExp(`^how (?:far|far away|distant) is ${OBJ}(?: from (?:earth|us|here))?$`), 'distance'],
  [new RegExp(`^(?:how bright is|what magnitude is|what is the magnitude of|whats the magnitude of) ${OBJ}$`), 'brightness'],
  [new RegExp(`^(?:how do i find|how can i find|how to find|how do i spot|how do i locate|how do you find) ${OBJ}$`), 'find'],
  [new RegExp(`^(?:what is|whats|what are|who is|tell me about|tell me more about|describe|explain|info on|information on|information about|about|facts about|more about) ${OBJ}$`), 'about'],
];
const SHOW_RE = /^(?:show me|show|go to|goto|find|where is|wheres|where are|take me to|point at|point to|look at|center on|centre on|center|centre|fly to|jump to|locate|i want to see|let me see|see|search for|search|select)\s+(.+)$/;

/** Reads as a question rather than a command */
export const isQuestion = (text: string) => /\?\s*$/.test(text) || /^(?:what|whats|when|whens|why|how|which|who|whose|whom|is|are|was|were|does|do|did|can|could|will|would|should|has|have)\b/.test(clean(text));

export type Lookup = (phrase: string) => string | null;

/**
 * @param lookup  the catalogue ref for a phrase that names an object (forgiving of spelling), or null
 */
export function matchLocal(raw: string, lookup: Lookup): LocalPlan | null {
  const t = clean(raw).replace(/['’`]/g, '');
  if (!t || t.length > 90) return null;
  const cmd = matchCommands(t, lookup);
  if (cmd) return { calls: cmd };

  if (/^(?:whats up(?: tonight)?|what is up(?: tonight)?|what can i see(?: tonight| now| right now)?|whats visible(?: tonight)?|what is visible(?: tonight)?|whats in the sky(?: tonight)?|what should i look (?:at|for)(?: tonight)?)$/.test(t)) return { calls: [{ name: 'app_open', input: { path: 'tonight' } }], answer: 'tonight' };

  for (const [re, kind] of QUESTIONS) {
    const m = re.exec(t);
    const ref = m && lookup(m[1]);
    if (!ref) continue;
    if (kind === 'photo') return { calls: [{ name: 'sky_show', input: { target: ref, open_photo: true } }], answer: 'photo' };
    return { calls: [{ name: 'sky_describe', input: { target: ref } }], answer: kind };
  }

  // lessons, star-hops and myths
  let m = /^(?:is there |are there |do you have |find |show me |open |any )?(?:a |an |the |any )?(?:lessons?|course|class|tutorial|guide) (?:on|about|for|covering) (.+)$/.exec(t) ?? /^(?:teach me|teach me about|i want to learn|i want to learn about|learn about|help me learn) (?:about )?(.+)$/.exec(t);
  if (m) return { calls: [{ name: 'app_search', input: { query: m[1], prefer: 'lesson', open: true } }], answer: 'content' };
  m = /^(?:what is |whats |tell me |show me |open |read me )?(?:the )?(?:myths?|story|stories|legend|mythology) (?:of|about|behind|for) (.+)$/.exec(t);
  if (m) return { calls: [{ name: 'app_search', input: { query: m[1], prefer: 'myth', open: true } }], answer: 'content' };
  m = /^(?:how do i |how to |show me how to )?(?:star ?hop|hop) to (.+)$/.exec(t);
  if (m) return { calls: [{ name: 'app_search', input: { query: m[1], prefer: 'star-hop', open: true } }], answer: 'content' };

  // a question the patterns above did not answer is for the model, not a "show it" guess
  if (isQuestion(t)) return null;

  // objects: "show me X", or just "X"
  const s = SHOW_RE.exec(t);
  const ref = lookup(s ? s[1] : t);
  if (ref) return { calls: [{ name: 'sky_show', input: { target: ref } }] };
  return null;
}
