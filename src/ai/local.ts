/**
 * Instant path: plain commands the app can understand without a model ("lines off", "zoom in", "show me Orion").
 * Pure: text in, tool calls out. Anything it is not sure about returns null and goes to the model instead.
 */
import { LAYER_PARAMS, SECTIONS, type ToolInput } from './actions';

export interface LocalCall { name: string; input: ToolInput }

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
const SHOW = /^(?:show me|show|go to|goto|find|where is|where's|wheres|take me to|point at|point to|look at|center on|centre on|center|centre|fly to|jump to|locate)\s+(.+)$/;

const clean = (s: string) => s.toLowerCase().replace(/[.!?]+$/g, '').replace(/\bplease\b/g, '').replace(/^(?:can|could|would) you\s+/, '').replace(/\s+/g, ' ').trim();
const noThe = (s: string) => s.replace(/^the\s+/, '');

function layerPhrase(phrase: string): string[] | null {
  return LAYER_LOOKUP.get(noThe(phrase).replace(/\s+layer$/, '')) ?? null;
}

function layerCall(params: string[], on: boolean): LocalCall {
  return { name: 'sky_set_layers', input: Object.fromEntries(params.map((p) => [p, on])) };
}

/**
 * @param isObject  true when the phrase is exactly the name or designation of something in the catalogue
 */
export function matchLocal(raw: string, isObject: (phrase: string) => boolean): LocalCall[] | null {
  const t = clean(raw);
  if (!t || t.length > 60) return null;

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

  // objects: only when the phrase is exactly something in the catalogue; descriptions go to the model
  m = SHOW.exec(t);
  const phrase = noThe(m ? m[1] : t);
  if (isObject(phrase)) return [{ name: 'sky_show', input: { target: phrase } }];
  return null;
}
