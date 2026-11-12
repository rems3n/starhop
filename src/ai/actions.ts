/**
 * The assistant's actions: one function per tool in shared/ai-tools.json. Each takes the model's (or the local
 * matcher's) input, does the thing through the same stores and controller the UI uses, and returns a small plain
 * result the model can read. Results never throw for ordinary "not found" cases: they come back as { ok: false }.
 */
import { altAzOf, bestMonths, currentNightDate, getBody, visibilityOn, whereWords } from '@/astro';
import { DSO_KIND, VISIBILITY_WORDS, monthRanges, starKind } from '@/components/object/describe';
import { visTargetOf } from '@/components/object/targets';
import { asterisms, courseModules, getBlurb, lessons, loadAllConstellationContent, loadConstellationContent, starhops } from '@/content';
import { loadCatalog, loadDeepDsos, mayNeedDeepDsos, type Catalog } from '@/data/catalog';
import { formatDistanceLy, formatMag } from '@/lib/format';
import { routes } from '@/lib/routes';
import { formatDateTime, formatTime, zonedToUtc } from '@/lib/time';
import { CITIES, cityToObserver, isValidTimeZone, searchCities } from '@/modes/explore/cities';
import { rateWords } from '@/modes/explore/timeRates';
import { useSettings } from '@/store/settings';
import { BORTLE, type LayerState, type Observer, type ResolvedTarget, type TargetRef } from '@/types';
import { getSky, waitForSky, type SkyBridge } from './bridge';

export interface ActionEnv {
  navigate(path: string): void;
  /** Current router path including the query string */
  path(): string;
}

export type ToolInput = Record<string, unknown>;
export type ToolResult = { ok: boolean; [k: string]: unknown };

/** Tool parameter name → layer key, with the words used when reporting a change. */
export const LAYER_PARAMS: Record<string, { key: keyof LayerState; label: string }> = {
  constellation_lines: { key: 'constellationLines', label: 'Constellation lines' },
  constellation_names: { key: 'constellationNames', label: 'Constellation names' },
  constellation_boundaries: { key: 'constellationBoundaries', label: 'Boundaries' },
  constellation_figures: { key: 'constellationArt', label: 'Figures' },
  star_names: { key: 'starNames', label: 'Star names' },
  deep_sky_markers: { key: 'dsoMarkers', label: 'Deep-sky markers' },
  deep_zoom: { key: 'deepSky', label: 'Deep zoom' },
  planets: { key: 'planets', label: 'Planets' },
  ecliptic: { key: 'ecliptic', label: 'Ecliptic' },
  equatorial_grid: { key: 'equatorialGrid', label: 'Equatorial grid' },
  altaz_grid: { key: 'azimuthalGrid', label: 'Azimuthal grid' },
  horizon: { key: 'horizon', label: 'Horizon' },
  ground: { key: 'ground', label: 'Ground' },
  atmosphere: { key: 'atmosphere', label: 'Atmosphere' },
  milky_way: { key: 'milkyWay', label: 'Milky Way' },
};

const FACE_AZ: Record<string, number> = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };
const ZOOM: Record<string, number> = { in: 0.6, out: 1 / 0.6, far_in: 0.2, far_out: 5 };
const SPEED: Record<string, number> = { paused: 0, real_time: 1, fast: 60, faster: 3600, day_per_second: 86400, rewind: -3600 };

export const SECTIONS: Record<string, { path: string; label: string }> = {
  sky: { path: routes.sky(), label: 'Sky map' },
  tonight: { path: routes.tonight(), label: 'Tonight' },
  month: { path: routes.month(), label: 'This month' },
  calendar: { path: routes.calendar(), label: 'Visibility calendar' },
  events: { path: routes.events(), label: 'Events' },
  learn: { path: routes.learn(), label: 'The course' },
  library: { path: routes.library(), label: 'Library' },
  constellations: { path: routes.constellations(), label: 'Constellations' },
  myths: { path: routes.myths(), label: 'Myths' },
  starhops: { path: routes.starhops(), label: 'Star-hops' },
  asterisms: { path: routes.asterisms(), label: 'Asterisms' },
  stars: { path: routes.stars(), label: 'Stars' },
  objects: { path: routes.objects(), label: 'Deep-sky objects' },
  planets: { path: routes.planets(), label: 'Planets' },
  practice: { path: routes.practice(), label: 'Practice' },
  review: { path: routes.review(), label: 'Review' },
  progress: { path: routes.progress(), label: 'Progress' },
};
const SAFE_PATH = /^\/(sky|tonight|learn|library|practice)(\/[\w\-%:.,+]+)*(\?[\w\-%:.,+=&]*)?$/;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : undefined);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** When and where the map is: the open sky map if there is one, otherwise now and the saved location. */
function moment(): { date: Date; observer: Observer } {
  const sky = getSky();
  return { date: sky ? sky.ctl.getTime() : new Date(), observer: useSettings.getState().observer };
}

function kindWords(t: ResolvedTarget, catalog: Catalog): string {
  const con = (id: string | undefined) => (id ? catalog.conById.get(id)?.name ?? id : '');
  if (t.star) return `star in ${con(t.star.con)}`;
  if (t.dso) return `${(DSO_KIND[t.dso.type]?.label ?? 'deep-sky object').toLowerCase()} in ${con(t.dso.con)}`;
  if (t.constellation) return `constellation, ${t.constellation.english}`;
  if (t.body) return t.body === 'Sun' ? 'the Sun' : t.body === 'Moon' ? 'the Moon' : 'planet';
  if (t.kind === 'asterism') return 'star pattern (asterism)';
  return t.kind;
}

function altAz(t: ResolvedTarget, date: Date, observer: Observer) {
  return t.body ? getBody(t.body, date, observer) : altAzOf(t.ra, t.dec, date, observer);
}

/** Resolve a ref or a plain name. Loads the full NGC/IC list on demand. */
export async function findTarget(catalog: Catalog, query: string): Promise<ResolvedTarget | null> {
  const when = moment();
  const q = query.trim().replace(/^the\s+/i, '');
  if (!q) return null;
  const attempt = (): ResolvedTarget | null => {
    if (/^[a-z]+:/i.test(q)) {
      const t = catalog.resolve(q, when);
      if (t) return t;
    }
    const hit = catalog.search(q.replace(/^[a-z]+:/i, ''), 1)[0];
    return hit ? catalog.resolve(hit.ref, when) ?? hit : null;
  };
  let t = attempt();
  if (!t && !catalog.deepDsos.length && (mayNeedDeepDsos(q) || q.length >= 3)) {
    await loadDeepDsos().catch(() => undefined);
    t = attempt();
  }
  return t;
}

async function openSky(env: ActionEnv): Promise<SkyBridge> {
  if (!env.path().startsWith('/sky')) env.navigate(routes.sky());
  return waitForSky();
}

// ───────────────────────────── tools ─────────────────────────────

async function skyFind(input: ToolInput): Promise<ToolResult> {
  const catalog = await loadCatalog();
  const q = text(input.query).replace(/^the\s+/i, '');
  if (!q) return { ok: false, error: 'Empty query.' };
  if (!catalog.deepDsos.length && mayNeedDeepDsos(q)) await loadDeepDsos().catch(() => undefined);
  let hits = catalog.search(q, 6);
  if (!hits.length && !catalog.deepDsos.length) {
    await loadDeepDsos().catch(() => undefined);
    hits = catalog.search(q, 6);
  }
  const { date, observer } = moment();
  const matches = hits.map((h) => {
    const t = catalog.resolve(h.ref, { date, observer }) ?? h;
    const p = altAz(t, date, observer);
    return { ref: t.ref, name: t.name, kind: kindWords(t, catalog), above_horizon_now: p.alt > 0, ...(p.alt > 0 ? { where: whereWords(p.alt, p.az) } : {}) };
  });
  return matches.length ? { ok: true, matches } : { ok: false, error: `Nothing in the catalogue matches "${q}".` };
}

async function skyShow(input: ToolInput, env: ActionEnv): Promise<ToolResult> {
  const target = text(input.target);
  if (!target) return { ok: false, error: 'No target given.' };
  if (/^(none|null|nothing|clear)$/i.test(target)) {
    getSky()?.select(null);
    return { ok: true, cleared: true };
  }
  const catalog = await loadCatalog();
  const t = await findTarget(catalog, target);
  if (!t) return { ok: false, error: `Nothing in the catalogue matches "${target}". Try sky_find with a different spelling.` };
  const sky = await openSky(env);
  const observer = sky.ctl.getObserver();
  let date = sky.ctl.getTime();
  const out: ToolResult = { ok: true, shown: t.name, ref: t.ref, kind: kindWords(t, catalog) };
  if (t.kind !== 'point' && t.body !== 'Sun') {
    const v = visibilityOn(visTargetOf(t, catalog), currentNightDate(date, observer), observer);
    out.tonight = VISIBILITY_WORDS[v.cls];
    if (v.bestTime) out.best_time_tonight = formatTime(v.bestTime, observer.tz);
    if (input.at_best_time === true && v.bestTime) {
      sky.ctl.setTime(v.bestTime);
      date = v.bestTime;
      out.clock_set_to = formatDateTime(v.bestTime, observer.tz);
      // the engine needs a frame at the new time before a glide to a body lands in the right place
      await new Promise((r) => window.setTimeout(r, 60));
    }
  }
  const fresh = catalog.resolve(t.ref, { date, observer }) ?? t;
  const p = altAz(fresh, date, observer);
  out.above_horizon = p.alt > 0;
  out.where = p.alt > 0 ? whereWords(p.alt, p.az) : 'below the horizon at the time shown on the map';
  const fov = num(input.field_of_view_deg);
  sky.select(t.ref, { fly: true, fov: fov === undefined ? undefined : clamp(fov, 1, 150) });
  return out;
}

async function skyDescribe(input: ToolInput): Promise<ToolResult> {
  const catalog = await loadCatalog();
  let target = text(input.target);
  if (/^selected$/i.test(target)) {
    const sel = getSky()?.selected();
    if (!sel) return { ok: false, error: 'Nothing is selected on the sky map.' };
    target = sel;
  }
  const t = await findTarget(catalog, target);
  if (!t) return { ok: false, error: `Nothing in the catalogue matches "${target}".` };
  const { date, observer } = moment();
  const out: ToolResult = { ok: true, name: t.name, ref: t.ref, kind: kindWords(t, catalog) };
  if (t.star) {
    Object.assign(out, { designation: t.star.desig, magnitude: formatMag(t.star.mag), star_type: starKind(t.star), ...(t.star.distLy ? { distance: formatDistanceLy(t.star.distLy) } : {}) });
  } else if (t.dso) {
    Object.assign(out, {
      ...(t.dso.mag !== undefined ? { magnitude: formatMag(t.dso.mag) } : {}),
      ...(t.dso.distLy ? { distance: formatDistanceLy(t.dso.distLy) } : {}),
      ...(t.dso.sizeArcmin ? { size_arcmin: t.dso.sizeArcmin[0] } : {}),
      equipment_needed: t.dso.equip,
      also_known_as: t.dso.aka.slice(0, 3),
    });
  } else if (t.constellation) {
    const c = t.constellation;
    Object.assign(out, { meaning: c.english, brightest_star: catalog.starById.get(c.brightest)?.name ?? catalog.starById.get(c.brightest)?.desig, area_sq_deg: Math.round(c.areaSqDeg), zodiac: c.zodiac });
    const content = await loadConstellationContent(c.id).catch(() => null);
    if (content) Object.assign(out, { overview: content.overview, how_to_find: content.howToFind.join(' ').slice(0, 500), myths_in_library: content.stories.map((s) => ({ title: s.title, path: routes.myth(s.id) })), page: routes.constellation(c.id) });
  } else if (t.body) {
    const b = getBody(t.body, date, observer);
    Object.assign(out, { magnitude: formatMag(b.mag), in_constellation: catalog.conById.get(b.con)?.name ?? b.con, ...(t.body === 'Moon' ? { illuminated_percent: Math.round(b.phase * 100) } : {}) });
  }
  const blurb = getBlurb(...catalog.aliases(t.ref));
  if (blurb) Object.assign(out, { about: blurb.about, how_to_find: blurb.howToFind, what_you_see: blurb.whatYouSee });
  const p = altAz(catalog.resolve(t.ref, { date, observer }) ?? t, date, observer);
  out.at_map_time = p.alt > 0 ? whereWords(p.alt, p.az) : 'below the horizon';
  if (t.body !== 'Sun') {
    const vt = visTargetOf(t, catalog);
    const v = visibilityOn(vt, currentNightDate(date, observer), observer);
    out.tonight = VISIBILITY_WORDS[v.cls];
    if (v.bestTime) out.best_time_tonight = `${formatTime(v.bestTime, observer.tz)}, ${whereWords(v.bestAlt, v.bestAz)}`;
    if (!t.body) {
      try {
        const months = bestMonths(vt, observer);
        out.best_evening_months = months.length ? monthRanges(months) : `never well placed in the evening from ${observer.name}`;
      } catch { /* optional */ }
    }
  }
  out.observing_from = observer.name;
  return out;
}

function skySetLayers(input: ToolInput): ToolResult {
  const patch: Partial<LayerState> = {};
  const changed: string[] = [];
  const current = useSettings.getState().layers;
  for (const [param, value] of Object.entries(input)) {
    const def = LAYER_PARAMS[param];
    if (!def || typeof value !== 'boolean') continue;
    patch[def.key] = value;
    if (current[def.key] !== value) changed.push(`${def.label} ${value ? 'on' : 'off'}`);
  }
  if (!Object.keys(patch).length) return { ok: false, error: 'No known layers given.' };
  useSettings.getState().setLayers(patch);
  return { ok: true, changed, ...(changed.length ? {} : { note: 'Those layers were already set that way.' }) };
}

async function skySetView(input: ToolInput, env: ActionEnv): Promise<ToolResult> {
  const sky = await openSky(env);
  const c = sky.ctl;
  const done: string[] = [];
  if (input.reset === true) {
    sky.resetView();
    done.push('Reset the view to face north');
  }
  const face = text(input.face).toLowerCase();
  const fov = num(input.field_of_view_deg);
  if (face === 'zenith') {
    void c.flyTo('point:zenith', { fov: fov === undefined ? undefined : clamp(fov, 1, 150) });
    done.push('Looking straight up');
  } else if (face in FACE_AZ) {
    const v = c.getView();
    if (v.mount !== 'altaz') c.setView({ mount: 'altaz', roll: 0 });
    const alt = clamp(v.mount === 'altaz' ? v.lat : 30, 15, 45);
    void c.flyTo(`altaz:${FACE_AZ[face]},${alt}`, { fov: fov === undefined ? undefined : clamp(fov, 1, 150) });
    done.push(`Facing ${face}`);
  } else if (fov !== undefined) {
    const size = c.getSize();
    const centre = c.unproject(size.width / 2, size.height / 2);
    const f = clamp(fov, 1, 150);
    if (centre) void c.flyTo(`radec:${centre.ra},${centre.dec}`, { fov: f, durationMs: 400 });
    else c.setView({ fov: f });
    done.push(`Field of view ${Math.round(f)}°`);
  }
  const zoom = text(input.zoom).toLowerCase();
  if (zoom in ZOOM && fov === undefined) {
    sky.zoom(ZOOM[zoom]);
    done.push(zoom.endsWith('in') ? 'Zoomed in' : 'Zoomed out');
  }
  return done.length ? { ok: true, done } : { ok: false, error: 'Give face, zoom, field_of_view_deg or reset.' };
}

async function skySetTime(input: ToolInput, env: ActionEnv): Promise<ToolResult> {
  const sky = await openSky(env);
  const c = sky.ctl;
  const tz = c.getObserver().tz;
  const speed = text(input.speed).toLowerCase();
  const time = text(input.time);
  let moved = false;
  let nowish = false;
  if (time) {
    if (/^now$/i.test(time)) {
      c.setTime(new Date());
      nowish = true;
    } else {
      const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(time);
      if (!m) return { ok: false, error: "Could not read the time. Use 'now' or YYYY-MM-DDTHH:MM in the learner's local time." };
      c.setTime(zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], tz));
    }
    moved = true;
  }
  const shift = (num(input.shift_hours) ?? 0) * 3600e3 + (num(input.shift_days) ?? 0) * 86400e3;
  if (shift) {
    c.setTime(new Date(c.getTime().getTime() + shift));
    moved = true;
    nowish = false;
  }
  if (speed in SPEED) c.setTimeRate(SPEED[speed]);
  else if (moved) c.setTimeRate(nowish ? 1 : 0);
  else return { ok: false, error: 'Give time, shift_hours, shift_days or speed.' };
  return { ok: true, map_time: formatDateTime(c.getTime(), tz), clock: rateWords(c.getTimeRate()) };
}

function skySetLocation(input: ToolInput): ToolResult {
  const city = text(input.city);
  const lat = num(input.latitude);
  const lon = num(input.longitude);
  const set = useSettings.getState().setObserver;
  if (city) {
    const hits = searchCities(city);
    if (hits.length) {
      set(cityToObserver(hits[0]));
      return { ok: true, observing_from: hits[0].name, country: hits[0].country, latitude: hits[0].lat };
    }
    if (lat === undefined || lon === undefined) return { ok: false, error: `"${city}" is not in the built-in city list. Give latitude, longitude and time_zone for it instead.`, some_cities: CITIES.slice(0, 8).map((c) => c.name) };
  }
  if (lat === undefined || lon === undefined) return { ok: false, error: 'Give a city, or latitude, longitude and time_zone.' };
  const tz = text(input.time_zone);
  if (!isValidTimeZone(tz)) return { ok: false, error: 'A valid IANA time_zone is required with latitude and longitude, e.g. America/Denver.' };
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return { ok: false, error: 'Latitude must be within ±90 and longitude within ±180.' };
  const name = text(input.name) || city || `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  set({ name, lat, lon, tz });
  return { ok: true, observing_from: name, latitude: lat };
}

function skySetDarkness(input: ToolInput): ToolResult {
  const b = num(input.bortle);
  if (b === undefined) return { ok: false, error: 'Give a Bortle class from 1 to 9.' };
  const n = clamp(Math.round(b), 1, 9);
  useSettings.getState().setBortle(n);
  return { ok: true, bortle: n, sky: BORTLE[n - 1].label, faintest_stars_magnitude: BORTLE[n - 1].limitingMag };
}

interface ContentHit { type: string; title: string; path: string; detail?: string }
let contentIndex: Promise<(ContentHit & { hay: string })[]> | null = null;

function buildContentIndex(): Promise<(ContentHit & { hay: string })[]> {
  return (contentIndex ??= (async () => {
    const catalog = await loadCatalog();
    const out: ContentHit[] = [];
    for (const m of courseModules) out.push({ type: 'course module', title: m.title, path: routes.module(m.id) });
    for (const l of lessons) out.push({ type: 'lesson', title: l.title, path: routes.lesson(l.id), detail: l.subtitle });
    for (const h of starhops) out.push({ type: 'star-hop', title: h.name, path: routes.starhop(h.id), detail: h.summary });
    for (const a of asterisms) out.push({ type: 'asterism', title: a.name, path: routes.asterism(a.id), detail: a.summary });
    for (const c of catalog.constellations) out.push({ type: 'constellation page', title: `${c.name}, ${c.english}`, path: routes.constellation(c.id) });
    const all = await loadAllConstellationContent().catch(() => []);
    for (const cc of all) {
      const con = catalog.conById.get(cc.id)?.name ?? cc.id;
      for (const s of cc.stories) out.push({ type: 'myth', title: s.title, path: routes.myth(s.id), detail: `${s.culture} · ${con}` });
    }
    return out.map((h) => ({ ...h, detail: h.detail?.slice(0, 140), hay: `${h.title} ${h.detail ?? ''} ${h.type}`.toLowerCase() }));
  })());
}

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'for', 'about', 'on', 'in', 'is', 'how', 'do', 'i', 'me', 'what', 'lesson', 'lessons']);

async function appSearch(input: ToolInput): Promise<ToolResult> {
  const q = text(input.query).toLowerCase();
  const words = q.split(/[^a-z0-9']+/).filter((w) => w.length > 1 && !STOP.has(w));
  if (!words.length) return { ok: false, error: 'Empty query.' };
  const index = await buildContentIndex();
  const scored = index
    .map((h) => {
      const title = h.title.toLowerCase();
      let score = 0;
      for (const w of words) score += title.includes(w) ? 3 : h.hay.includes(w) ? 1 : 0;
      if (title.includes(q)) score += 4;
      return { h, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  if (!scored.length) return { ok: false, error: `No lesson, star-hop, myth or page matches "${q}".` };
  return { ok: true, results: scored.map(({ h }) => ({ type: h.type, title: h.title, path: h.path, ...(h.detail ? { detail: h.detail } : {}) })) };
}

async function appOpen(input: ToolInput, env: ActionEnv): Promise<ToolResult> {
  const raw = text(input.path);
  const section = SECTIONS[raw.toLowerCase().replace(/^\//, '')];
  const path = section ? section.path : raw.replace(/^#/, '');
  if (!SAFE_PATH.test(path)) return { ok: false, error: 'Unknown page. Use a section name or a path from app_search.' };
  env.navigate(path);
  const hit = section ? undefined : (await buildContentIndex().catch(() => [])).find((h) => h.path === path);
  return { ok: true, opened: section?.label ?? (hit ? `${hit.type}: ${hit.title}` : path) };
}

export async function runTool(name: string, input: ToolInput, env: ActionEnv): Promise<ToolResult> {
  try {
    switch (name) {
      case 'sky_find': return await skyFind(input);
      case 'sky_show': return await skyShow(input, env);
      case 'sky_describe': return await skyDescribe(input);
      case 'sky_set_layers': return skySetLayers(input);
      case 'sky_set_view': return await skySetView(input, env);
      case 'sky_set_time': return await skySetTime(input, env);
      case 'sky_set_location': return skySetLocation(input);
      case 'sky_set_darkness': return skySetDarkness(input);
      case 'app_search': return await appSearch(input);
      case 'app_open': return await appOpen(input, env);
      default: return { ok: false, error: `Unknown tool ${name}.` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong.' };
  }
}

/** Tools that change what the learner sees (the others only look things up). */
export const CHANGES_STATE = new Set(['sky_show', 'sky_set_layers', 'sky_set_view', 'sky_set_time', 'sky_set_location', 'sky_set_darkness', 'app_open']);

/** One short line for the "what I did" list under a reply, or null for look-ups and failures. */
export function actionLabel(name: string, result: ToolResult): string | null {
  if (!result.ok || !CHANGES_STATE.has(name)) return null;
  switch (name) {
    case 'sky_show': return result.cleared ? 'Cleared the selection' : `Showing ${String(result.shown)}${result.clock_set_to ? ` at ${String(result.clock_set_to)}` : ''}`;
    case 'sky_set_layers': return (result.changed as string[]).join(', ') || null;
    case 'sky_set_view': return (result.done as string[]).join(', ');
    case 'sky_set_time': return `Map time ${String(result.map_time)} · ${String(result.clock).toLowerCase()}`;
    case 'sky_set_location': return `Observing from ${String(result.observing_from)}`;
    case 'sky_set_darkness': return `Bortle ${String(result.bortle)} · ${String(result.sky)}`;
    case 'app_open': return `Opened ${String(result.opened)}`;
    default: return null;
  }
}

/** A plain sentence for a result, used when a command was handled without the model. */
export function resultSentence(name: string, result: ToolResult): string {
  if (!result.ok) return String(result.error ?? 'That did not work.');
  if (name === 'sky_show') {
    if (result.cleared) return 'Cleared the selection.';
    const what = `${String(result.shown)} (${String(result.kind)})`;
    if (result.above_horizon) return `Here is ${what}, ${String(result.where)}.`;
    return result.best_time_tonight ? `${what} is below the horizon at the time on the map. It is best tonight around ${String(result.best_time_tonight)}.` : `${what} is below the horizon at the time on the map and is not visible tonight from here.`;
  }
  if (name === 'sky_set_layers') return (result.changed as string[]).length ? `${(result.changed as string[]).join(', ')}.` : 'Those were already set that way.';
  return `${actionLabel(name, result) ?? 'Done'}.`;
}

// ───────────────────────────── context and undo ─────────────────────────────

/** Compact description of the app for the model, refreshed every turn. */
export function describeState(env: ActionEnv): Record<string, unknown> {
  const s = useSettings.getState();
  const sky = getSky();
  const layersOn = Object.entries(LAYER_PARAMS).filter(([, d]) => s.layers[d.key]).map(([p]) => p);
  const out: Record<string, unknown> = {
    page: env.path(),
    observing_from: { name: s.observer.name, latitude: +s.observer.lat.toFixed(2), longitude: +s.observer.lon.toFixed(2), time_zone: s.observer.tz },
    real_time_now: formatDateTime(new Date(), s.observer.tz),
    layers_on: layersOn,
    bortle: s.bortle,
  };
  if (sky) {
    const v = sky.ctl.getView();
    out.sky_map = {
      map_time: formatDateTime(sky.ctl.getTime(), s.observer.tz),
      clock: rateWords(sky.ctl.getTimeRate()),
      looking: v.mount === 'altaz' ? { azimuth_deg: Math.round(v.lon), altitude_deg: Math.round(v.lat) } : { ra_deg: Math.round(v.lon), dec_deg: Math.round(v.lat) },
      field_of_view_deg: Math.round(v.fov),
      selected: sky.selected(),
    };
  } else out.sky_map = 'not open (sky tools open it automatically)';
  return out;
}

export interface Snapshot {
  path: string;
  layers: LayerState;
  bortle: number;
  observer: Observer;
  sky: { view: ReturnType<SkyBridge['ctl']['getView']>; rate: number; time: number; offset: number; selected: TargetRef | null } | null;
}

export function takeSnapshot(env: ActionEnv): Snapshot {
  const s = useSettings.getState();
  const sky = getSky();
  return {
    path: env.path(),
    layers: { ...s.layers },
    bortle: s.bortle,
    observer: { ...s.observer },
    sky: sky ? { view: { ...sky.ctl.getView() }, rate: sky.ctl.getTimeRate(), time: sky.ctl.getTime().getTime(), offset: sky.ctl.getTime().getTime() - Date.now(), selected: sky.selected() } : null,
  };
}

/** Put the app back as it was when the snapshot was taken. */
export async function restoreSnapshot(snap: Snapshot, env: ActionEnv): Promise<void> {
  const s = useSettings.getState();
  s.setLayers(snap.layers);
  s.setBortle(snap.bortle);
  if (s.observer.lat !== snap.observer.lat || s.observer.lon !== snap.observer.lon || s.observer.name !== snap.observer.name) s.setObserver(snap.observer);
  if (env.path() !== snap.path) env.navigate(snap.path);
  if (!snap.sky || !snap.path.startsWith('/sky')) return;
  const sky = await waitForSky().catch(() => null);
  if (!sky) return;
  // a clock that was running in real time resumes from where it would be now, not from the stale instant
  sky.ctl.setTime(new Date(snap.sky.rate === 1 ? Date.now() + snap.sky.offset : snap.sky.time));
  sky.ctl.setTimeRate(snap.sky.rate);
  sky.select(snap.sky.selected);
  sky.ctl.setView(snap.sky.view);
}
