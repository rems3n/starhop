/**
 * The sky engine: clock, camera, input, and the frame loop that drives the WebGL renderer and the 2D overlay.
 * `createSkyEngine` returns the `SkyController` contract from src/types.ts.
 */
import { loadFaintStars, type Catalog } from '@/data/catalog';
import {
  DEFAULT_LAYERS,
  type Highlight,
  type LayerState,
  type Observer,
  type PickedObject,
  type SkyController,
  type SkyEngineOptions,
  type SkyEvents,
  type TargetRef,
  type ViewState,
} from '@/types';
import {
  DEG, RAD, applyMat, clampFov, clampLat, clipZ, fovScale, lonDelta, lonLatToVec, mat3, mountMatrix, mul33, normLon, projectVec,
  transpose33, unprojectPx, vecToLat, vecToLon,
} from './camera';
import { lightPollution, milkyWayVisibility, parseCssColor, rgbaCss, smoothstep, starZoom, twilightLimit, type RGBA } from './color';
import { BODY_COLOR, BODY_IDS, computeBodies, eqjToNeu, makeBodies } from './ephemeris';
import { HighlightPreparer, type PreparedHighlight } from './highlights';
import { Overlay, type Scene } from './overlay';
import { PickAccumulator, TIER_BODY, TIER_LABEL, TIER_NAMED, TIER_STAR, decimate } from './pick';
import { Renderer, countBelow, type BodySprite, type FrameParams, type SkyTokens } from './renderer';

export interface SkyStats {
  drawCalls: number;
  vertices: number;
  frames: number;
  glErrors: number;
  starsDrawn: number;
  faintLoaded: number;
  /** Main-thread milliseconds spent inside the last frame callback */
  lastFrameMs: number;
  /** …of which issuing WebGL commands, and drawing the 2D overlay */
  glMs: number;
  overlayMs: number;
}
const statsOf = new WeakMap<SkyController, () => SkyStats>();
/** Dev/perf hook: renderer statistics for a controller created by this module. */
export function getSkyStats(c: SkyController): SkyStats | null {
  return statsOf.get(c)?.() ?? null;
}

const KIND_BODY = 1, KIND_STAR = 2, KIND_DSO = 3, KIND_CON = 4;

function readTokens(el: HTMLElement): SkyTokens {
  const cs = getComputedStyle(el);
  const get = (name: string, fb: RGBA) => parseCssColor(cs.getPropertyValue(name), fb);
  return {
    lines: get('--sky-lines', [0.52, 0.64, 1, 0.5]),
    boundaries: get('--sky-boundaries', [0.94, 0.71, 0.36, 0.3]),
    grid: get('--sky-grid', [0.51, 0.59, 0.82, 0.2]),
    ecliptic: get('--sky-ecliptic', [0.94, 0.71, 0.36, 0.65]),
    label: get('--sky-label', [0.78, 0.83, 1, 0.85]),
    highlight: get('--sky-highlight', [0.94, 0.71, 0.36, 1]),
    night: get('--night-950', [0.024, 0.039, 0.102, 1]),
  };
}

export function createSkyEngine(container: HTMLElement, catalog: Catalog, options: SkyEngineOptions, debug?: { checkGlErrors?: boolean }): SkyController {
  // ───────────── DOM
  const root = document.createElement('div');
  root.className = 'sky-root';
  root.style.cssText = 'position:absolute;inset:0;overflow:hidden;outline-offset:-2px;touch-action:none;user-select:none;-webkit-user-select:none;';
  root.tabIndex = 0;
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'Interactive sky map. Drag to look around, scroll to zoom, arrow keys to pan, plus and minus to zoom.');
  const glCanvas = document.createElement('canvas');
  const ovCanvas = document.createElement('canvas');
  for (const c of [glCanvas, ovCanvas]) c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;';
  ovCanvas.style.cursor = 'grab';
  root.append(glCanvas, ovCanvas);
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(root);

  const tokens = readTokens(container);
  const highlightCss = rgbaCss(tokens.highlight);
  const reduceMq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!reduceMq?.matches;

  // ───────────── state
  let observer: Observer = { ...options.observer };
  const layers: LayerState = { ...DEFAULT_LAYERS, ...options.layers };
  let limitingMag = options.limitingMag ?? 6.0;
  const view: ViewState = { mount: 'altaz', lon: 180, lat: 35, roll: 0, fov: 100, ...options.view };
  view.fov = clampFov(view.fov);
  view.lat = clampLat(view.lat);
  view.lon = normLon(view.lon);
  let inputMode: 'navigate' | 'lasso' | 'none' = options.inputMode ?? 'navigate';
  let destroyed = false;
  let ready = false;

  let simBase = (options.time ?? new Date()).getTime();
  let realBase = performance.now();
  let rate = options.timeRate ?? 0;
  const simNow = (now = performance.now()) => simBase + (now - realBase) * rate;

  let width = 0, height = 0, dpr = 1;
  const neu = mat3(), mountM = mat3(), eqj = mat3(), hor = mat3(), tmpM = mat3();
  let S = 1;
  let neuAt = NaN, ephemAt = NaN;
  let ephemDirty = true;
  const bodies = makeBodies();
  const sprites: BodySprite[] = BODY_IDS.map((id) => ({ visible: false, type: id === 'Sun' ? 1 : id === 'Moon' ? 2 : 0, x: 0, y: 0, r: 4, color: BODY_COLOR[id], alpha: 1, lx: 0, ly: 0, lz: 1 }));
  const sunNeu = new Float32Array([0, 0, -1]);
  let sunAlt = -90;

  const renderer = new Renderer(glCanvas, catalog, tokens, { checkErrors: debug?.checkGlErrors });
  const overlay = new Overlay(ovCanvas, catalog, tokens, 1);
  const preparer = new HighlightPreparer();
  let highlightList: Highlight[] = [];
  let highlightsDependOnTime = false;
  let selectionRef: TargetRef | null = null;
  let selectionStart = 0;
  const showSelection = options.showSelection !== false;

  const frameP: FrameParams = {
    width: 1, height: 1, dpr: 1, fov: view.fov, eqj, hor, zClip: -0.9, layers, starLimit: limitingMag, starZoom: 1,
    sun: sunNeu, sunAlt: -90, day: 0, lightPollution: 0, milkyWay: 0, bodies: sprites,
  };
  const scene: Scene = {
    width: 1, height: 1, dpr: 1, fov: view.fov, S: 1, eqj, hor, neu, zClip: -0.9, layers, mount: view.mount, starLimit: limitingMag, starZoom: 1, day: 0,
    bodies, sprites, highlights: [], selection: null, selectionT: 1, showSelection, lasso: new Float32Array(2048), lassoN: 0, lassoClosed: false,
  };

  // ───────────── events
  const listeners: { [K in keyof SkyEvents]: Set<(p: SkyEvents[K]) => void> } = { ready: new Set(), select: new Set(), time: new Set(), view: new Set(), lasso: new Set() };
  function emit<K extends keyof SkyEvents>(ev: K, payload: SkyEvents[K]): void {
    for (const cb of [...listeners[ev]]) {
      try {
        cb(payload);
      } catch (e) {
        console.error(e);
      }
    }
  }
  let viewDirty = false, timeDirty = false, lastViewEmit = 0, lastTimeEmit = 0, trailingTimer = 0;
  function flushEvents(now: number, force = false): void {
    if (viewDirty && (force || now - lastViewEmit >= 100)) {
      viewDirty = false;
      lastViewEmit = now;
      if (listeners.view.size) emit('view', { ...view });
    }
    if (timeDirty && (force || now - lastTimeEmit >= 100)) {
      timeDirty = false;
      lastTimeEmit = now;
      if (listeners.time.size) emit('time', new Date(simNow(now)));
    }
  }

  // ───────────── frame scheduling
  let raf = 0, clockTimer = 0;
  let lastFrame = 0;
  let frames = 0, lastFrameMs = 0, glMs = 0, overlayMs = 0;
  const stamps = new Float64Array(120);
  let stampN = 0, fps = 0;
  function invalidate(): void {
    if (destroyed || raf) return;
    raf = requestAnimationFrame(frame);
  }

  // ───────────── camera
  function updateCamera(): void {
    mountMatrix(view.mount, view.lon, view.lat, view.roll, mountM);
    if (view.mount === 'altaz') {
      hor.set(mountM);
      mul33(mountM, neu, eqj);
    } else {
      eqj.set(mountM);
      mul33(mountM, transpose33(neu, tmpM), hor);
    }
    S = fovScale(view.fov, Math.max(1, height));
  }
  const o3 = new Float64Array(3), p3 = new Float64Array(3), q3 = new Float64Array(3);
  /** Mount-frame lon/lat under a pixel → p3[0], p3[1] */
  function pixelToMount(x: number, y: number, out: Float64Array): void {
    unprojectPx(mountM, S, width / 2, height / 2, x, y, o3);
    out[0] = vecToLon(o3[0], o3[1]);
    out[1] = vecToLat(o3[0], o3[1], o3[2]);
  }
  function touchView(): void {
    view.lon = normLon(view.lon);
    view.lat = clampLat(view.lat);
    view.fov = clampFov(view.fov);
    viewDirty = true;
    invalidate();
  }
  /** Move the camera so the sky point that was under (x0, y0) is now under (x1, y1). */
  function grab(x0: number, y0: number, x1: number, y1: number): void {
    pixelToMount(x0, y0, p3);
    pixelToMount(x1, y1, q3);
    let dLon = lonDelta(q3[0], p3[0]);
    const dLat = q3[1] - p3[1];
    if (Math.abs(p3[1]) > 89.6 || Math.abs(q3[1]) > 89.6) dLon = 0;
    dLon = Math.max(-40, Math.min(40, dLon));
    view.lon -= dLon;
    view.lat -= dLat;
    view.lon = normLon(view.lon);
    view.lat = clampLat(view.lat);
    updateCamera();
  }
  function setFovAnchored(fov: number, ax: number, ay: number): void {
    pixelToMount(ax, ay, p3);
    const lon0 = p3[0], lat0 = p3[1];
    view.fov = clampFov(fov);
    updateCamera();
    for (let i = 0; i < 2; i++) {
      pixelToMount(ax, ay, q3);
      if (Math.abs(lat0) < 89.6 && Math.abs(q3[1]) < 89.6) view.lon = normLon(view.lon + lonDelta(lon0, q3[0]));
      view.lat = clampLat(view.lat + (lat0 - q3[1]));
      updateCamera();
    }
  }
  function raDecToMount(ra: number, dec: number): { lon: number; lat: number } {
    if (view.mount === 'equatorial') return { lon: ra, lat: dec };
    lonLatToVec(ra, dec, o3);
    applyMat(neu, o3[0], o3[1], o3[2], p3);
    return { lon: vecToLon(p3[0], p3[1]), lat: vecToLat(p3[0], p3[1], p3[2]) };
  }

  // ───────────── clock / ephemerides
  function updateSky(sim: number, force: boolean): boolean {
    let changed = false;
    if (force || !(Math.abs(sim - neuAt) < 150)) {
      eqjToNeu(new Date(sim), observer, neu);
      neuAt = sim;
      changed = true;
    }
    if (force || !(Math.abs(sim - ephemAt) < 20000)) {
      computeBodies(new Date(sim), observer, bodies);
      ephemAt = sim;
      changed = true;
      if (highlightsDependOnTime || (selectionRef && /^(body|altaz|point):/.test(selectionRef))) prepareHighlights(sim);
    }
    if (changed) {
      const s = bodies[0];
      applyMat(neu, s.x, s.y, s.z, p3);
      sunNeu[0] = p3[0]; sunNeu[1] = p3[1]; sunNeu[2] = p3[2];
      sunAlt = Math.asin(Math.max(-1, Math.min(1, p3[2]))) * RAD;
    }
    return changed;
  }
  function prepareHighlights(sim = simNow()): void {
    const ctx = { catalog, date: new Date(sim), observer, defaultColor: highlightCss, bodyIds: BODY_IDS };
    const r = preparer.prepare(highlightList, ctx);
    scene.highlights = r.items;
    highlightsDependOnTime = r.timeDependent;
    scene.selection = null;
    if (selectionRef) {
      const t = catalog.resolve(selectionRef, { date: ctx.date, observer });
      if (t) {
        const h: Highlight = t.kind === 'constellation' && t.constellation ? { type: 'constellation', id: t.constellation.id, lines: true } : { type: 'object', ref: selectionRef };
        scene.selection = preparer.prepare([h], ctx).items[0] ?? null;
      }
    }
  }

  // ───────────── animations
  interface Fly { lon0: number; lat0: number; fov0: number; dLon: number; lat1: number; fov1: number; t0: number; dur: number; done: () => void }
  let fly: Fly | null = null;
  function cancelFly(): void {
    if (fly) {
      const f = fly;
      fly = null;
      f.done();
    }
  }
  let vLon = 0, vLat = 0, inertia = false;
  let fovTarget = view.fov, zoomAX = 0, zoomAY = 0, zooming = false;

  function stepAnimations(now: number, dt: number): boolean {
    let more = false;
    if (fly) {
      const f = fly;
      const t = f.dur <= 0 ? 1 : Math.min(1, (now - f.t0) / f.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      view.lon = normLon(f.lon0 + f.dLon * e);
      view.lat = clampLat(f.lat0 + (f.lat1 - f.lat0) * e);
      view.fov = clampFov(Math.exp(Math.log(f.fov0) + (Math.log(f.fov1) - Math.log(f.fov0)) * e));
      fovTarget = view.fov;
      viewDirty = true;
      if (t >= 1) {
        fly = null;
        f.done();
      } else more = true;
    }
    if (inertia) {
      view.lon = normLon(view.lon + vLon * dt);
      view.lat = clampLat(view.lat + vLat * dt);
      const k = Math.exp(-dt / 0.28);
      vLon *= k;
      vLat *= k;
      viewDirty = true;
      const pxPerDeg = (S * Math.PI) / 360;
      if (Math.hypot(vLon * Math.cos(view.lat * DEG), vLat) * pxPerDeg < 6) inertia = false;
      else more = true;
    }
    if (zooming) {
      const lr = Math.log(fovTarget / view.fov);
      if (Math.abs(lr) < 0.002 || reduced()) {
        setFovAnchored(fovTarget, zoomAX, zoomAY);
        zooming = false;
      } else {
        setFovAnchored(view.fov * Math.exp(lr * (1 - Math.exp(-dt / 0.07))), zoomAX, zoomAY);
        more = true;
      }
      viewDirty = true;
    }
    if (scene.selection && scene.selectionT < 1) {
      scene.selectionT = reduced() ? 1 : Math.min(1, (now - selectionStart) / 320);
      scene.selectionT = 1 - Math.pow(1 - scene.selectionT, 3);
      if (scene.selectionT < 0.999) more = true;
      else scene.selectionT = 1;
    }
    return more;
  }

  // ───────────── the frame
  function resize(): void {
    const r = root.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    const d = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    if (w === width && h === height && d === dpr) return;
    width = w;
    height = h;
    dpr = d;
    if (w < 2 || h < 2) return;
    renderer.resize(w, h, d);
    overlay.resize(w, h, d);
    invalidate();
  }

  function fillFrame(): void {
    const zc = clipZ(view.fov, width / height);
    const atmo = layers.atmosphere;
    const day = atmo ? smoothstep(-9, 3, sunAlt) : 0;
    const twLim = atmo ? twilightLimit(sunAlt) : 99;
    const starLimit = Math.min(limitingMag, twLim);
    const sz = starZoom(view.fov);
    frameP.width = scene.width = width;
    frameP.height = scene.height = height;
    frameP.dpr = scene.dpr = dpr;
    frameP.fov = scene.fov = view.fov;
    frameP.zClip = scene.zClip = zc;
    frameP.starLimit = scene.starLimit = starLimit;
    frameP.starZoom = scene.starZoom = sz;
    frameP.sunAlt = sunAlt;
    frameP.day = scene.day = day;
    frameP.lightPollution = atmo ? lightPollution(limitingMag) : 0;
    frameP.milkyWay = layers.milkyWay && renderer.hasMilkyWay ? 0.62 * milkyWayVisibility(limitingMag) : 0;
    scene.S = S;
    scene.mount = view.mount;
    // Sun, Moon, planets
    const cx = width / 2, cy = height / 2;
    const sun = bodies[0];
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i], sp = sprites[i];
      const ok = projectVec(eqj, S, cx, cy, b.x, b.y, b.z, o3);
      sp.visible = ok && o3[2] >= zc;
      if (!sp.visible) continue;
      sp.x = o3[0];
      sp.y = o3[1];
      const pxPerDeg = (S / (1 + o3[2])) * DEG;
      const trueR = b.radiusDeg * pxPerDeg;
      if (sp.type === 0) {
        sp.r = Math.max(trueR, Math.min(4.8, Math.max(2.3, 3.4 - 0.3 * b.mag)));
        sp.alpha = Math.max(0, Math.min(1, (twLim - b.mag) / 1.2));
      } else {
        sp.r = Math.max(trueR, 7);
        sp.alpha = 1;
      }
      if (sp.type === 2) {
        // direction of sunlight across the Moon's disc: towards where the Sun is on screen
        const d = b.x * sun.x + b.y * sun.y + b.z * sun.z;
        let tx = sun.x - b.x * d, ty = sun.y - b.y * d, tz = sun.z - b.z * d;
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
        const e = 0.004;
        projectVec(eqj, S, cx, cy, b.x + tx * e, b.y + ty * e, b.z + tz * e, p3);
        let dx = p3[0] - sp.x, dy = -(p3[1] - sp.y);
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl; dy /= dl;
        const el = b.elongation * DEG;
        sp.lx = dx * Math.sin(el);
        sp.ly = dy * Math.sin(el);
        sp.lz = -Math.cos(el);
      }
    }
  }

  function frame(now: number): void {
    raf = 0;
    if (destroyed) return;
    const t0 = performance.now();
    if (width < 2 || height < 2 || renderer.lost) return;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    const sim = simNow(now);
    updateSky(sim, ephemDirty);
    ephemDirty = false;
    if (rate !== 0) timeDirty = true;
    const more = stepAnimations(now, dt);
    updateCamera();
    fillFrame();
    const t1 = performance.now();
    renderer.draw(frameP);
    const t2 = performance.now();
    overlay.draw(scene);
    glMs = t2 - t1;
    overlayMs = performance.now() - t2;

    frames++;
    stamps[stampN++ % stamps.length] = now;
    const n = Math.min(stampN, stamps.length);
    let cnt = 0, oldest = now;
    for (let i = 0; i < n; i++) {
      const s = stamps[i];
      if (now - s <= 1000) {
        cnt++;
        if (s < oldest) oldest = s;
      }
    }
    if (cnt >= 3 && now > oldest) fps = ((cnt - 1) * 1000) / (now - oldest);

    flushEvents(now);
    if (!ready) {
      ready = true;
      emit('ready', undefined);
    }
    if (more) invalidate();
    else {
      scheduleClock();
      if ((viewDirty || timeDirty) && !trailingTimer) {
        trailingTimer = window.setTimeout(() => {
          trailingTimer = 0;
          if (!destroyed) flushEvents(performance.now(), true);
        }, 110);
      }
    }
    lastFrameMs = performance.now() - t0;
  }

  /** With the clock running, wake up only when the sky has turned by about a third of a pixel. */
  function scheduleClock(): void {
    if (clockTimer) {
      clearTimeout(clockTimer);
      clockTimer = 0;
    }
    if (rate === 0 || destroyed) return;
    const pxPerDeg = (S * Math.PI) / 360;
    const ms = (0.3 / (Math.abs(rate) * 0.0041781 * pxPerDeg)) * 1000;
    if (ms < 24) invalidate();
    else clockTimer = window.setTimeout(() => { clockTimer = 0; invalidate(); }, Math.min(1000, ms));
  }

  // ───────────── picking
  const acc = new PickAccumulator();
  function pick(x: number, y: number): PickedObject | null {
    if (width < 2) return null;
    acc.reset();
    const ground = layers.ground;
    const cx = width / 2, cy = height / 2;
    const reach = 40;
    if (layers.planets) {
      for (let i = 0; i < sprites.length; i++) {
        const sp = sprites[i], b = bodies[i];
        if (!sp.visible || sp.alpha < 0.25) continue;
        if (ground && neu[6] * b.x + neu[7] * b.y + neu[8] * b.z < -Math.sin(b.radiusDeg * DEG)) continue;
        acc.offer(TIER_BODY, Math.hypot(sp.x - x, sp.y - y), sp.r, KIND_BODY, i);
      }
    }
    const data = renderer.starData;
    const stars = catalog.stars;
    const n = countBelow(renderer.starMags, scene.starLimit);
    for (let i = 0; i < n; i++) {
      const o = i * 7;
      const vx = data[o], vy = data[o + 1], vz = data[o + 2];
      const z = eqj[6] * vx + eqj[7] * vy + eqj[8] * vz;
      if (z < scene.zClip) continue;
      const w = 1 + z;
      const sx = cx + ((eqj[0] * vx + eqj[1] * vy + eqj[2] * vz) / w) * S;
      if (sx < x - reach || sx > x + reach) continue;
      const sy = cy - ((eqj[3] * vx + eqj[4] * vy + eqj[5] * vz) / w) * S;
      if (sy < y - reach || sy > y + reach) continue;
      if (ground && neu[6] * vx + neu[7] * vy + neu[8] * vz < 0) continue;
      acc.offer(stars[i].name ? TIER_NAMED : TIER_STAR, Math.hypot(sx - x, sy - y), 0, KIND_STAR, i);
    }
    if (layers.dsoMarkers) {
      const shown = overlay.dsoShown;
      for (let i = 0; i < shown.length; i++) {
        if (!shown[i]) continue;
        acc.offer(TIER_NAMED, Math.hypot(overlay.dsoX[i] - x, overlay.dsoY[i] - y), Math.min(overlay.dsoR[i], 40), KIND_DSO, i);
      }
    }
    if (layers.constellationNames) {
      const r = overlay.conRect;
      for (let i = 0; i < r.length / 4; i++) {
        if (r[i * 4 + 2] < r[i * 4]) continue;
        if (x >= r[i * 4] && x <= r[i * 4 + 2] && y >= r[i * 4 + 1] && y <= r[i * 4 + 3]) acc.offer(TIER_LABEL, 0, 0, KIND_CON, i);
      }
    }
    if (!acc.hit) return null;
    switch (acc.kind) {
      case KIND_BODY: return { kind: 'body', ref: `body:${bodies[acc.index].id}`, name: bodies[acc.index].id };
      case KIND_STAR: { const s = stars[acc.index]; return { kind: 'star', ref: `star:${s.id}`, name: s.name ?? s.desig }; }
      case KIND_DSO: { const t = catalog.resolve(`dso:${catalog.dsos[acc.index].id}`); return { kind: 'dso', ref: `dso:${catalog.dsos[acc.index].id}`, name: t?.name ?? catalog.dsos[acc.index].id }; }
      default: { const c = catalog.constellations[acc.index]; return { kind: 'constellation', ref: `con:${c.id}`, name: c.name }; }
    }
  }

  // ───────────── input
  const pointers = new Map<number, { x: number; y: number }>();
  let dragging = false, lassoing = false, moved = 0, downX = 0, downY = 0, downT = 0, downButton = 0;
  let lastMoveT = 0, lastTapT = 0, lastTapX = 0, lastTapY = 0, pinchDist = 0, pinchX = 0, pinchY = 0;
  let lassoPts: { x: number; y: number }[] = [];
  let lastHover = 0;
  const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
    const r = ovCanvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function setCursor(): void {
    ovCanvas.style.cursor = inputMode === 'none' ? 'default' : inputMode === 'lasso' ? 'crosshair' : dragging ? 'grabbing' : 'grab';
  }
  function stopMotion(): void {
    cancelFly();
    inertia = false;
    zooming = false;
    fovTarget = view.fov;
  }
  function lassoPush(x: number, y: number): void {
    lassoPts.push({ x, y });
    if (scene.lassoN * 2 + 2 > scene.lasso.length) {
      const bigger = new Float32Array(scene.lasso.length * 2);
      bigger.set(scene.lasso);
      scene.lasso = bigger;
    }
    scene.lasso[scene.lassoN * 2] = x;
    scene.lasso[scene.lassoN * 2 + 1] = y;
    scene.lassoN++;
  }
  function onPointerDown(e: PointerEvent): void {
    if (inputMode === 'none') return;
    root.focus({ preventScroll: true });
    const p = local(e);
    pointers.set(e.pointerId, p);
    try { ovCanvas.setPointerCapture(e.pointerId); } catch { /* synthetic events have no capture */ }
    stopMotion();
    if (pointers.size === 2) {
      // second finger: pinch + pan, abandon any stroke in progress
      if (lassoing) {
        lassoing = false;
        scene.lassoN = 0;
        lassoPts = [];
      }
      dragging = false;
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchX = (a.x + b.x) / 2;
      pinchY = (a.y + b.y) / 2;
      moved = 99;
      invalidate();
      return;
    }
    if (pointers.size > 2) return;
    downX = p.x; downY = p.y; downT = performance.now(); moved = 0; downButton = e.button;
    vLon = vLat = 0;
    if (inputMode === 'lasso' && e.button === 0) {
      lassoing = true;
      scene.lassoN = 0;
      scene.lassoClosed = false;
      lassoPts = [];
      lassoPush(p.x, p.y);
      invalidate();
    } else if (inputMode === 'navigate' ? e.button === 0 : e.button === 2) {
      dragging = true;
    }
    setCursor();
  }
  function onPointerMove(e: PointerEvent): void {
    if (inputMode === 'none') return;
    const p = local(e);
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      // hover feedback (mouse only)
      if (inputMode === 'navigate' && e.pointerType === 'mouse' && !fly) {
        const now = performance.now();
        if (now - lastHover > 40) {
          lastHover = now;
          ovCanvas.style.cursor = pick(p.x, p.y) ? 'pointer' : 'grab';
        }
      }
      return;
    }
    if (pointers.size === 2) {
      prev.x = p.x; prev.y = p.y;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      grab(pinchX, pinchY, mx, my);
      if (pinchDist > 4 && d > 4) setFovAnchored(view.fov * (pinchDist / d), mx, my);
      fovTarget = view.fov;
      pinchDist = d; pinchX = mx; pinchY = my;
      touchView();
      return;
    }
    moved = Math.max(moved, Math.hypot(p.x - downX, p.y - downY));
    if (lassoing) {
      const last = lassoPts[lassoPts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 2) {
        lassoPush(p.x, p.y);
        invalidate();
      }
    } else if (dragging && moved > 3) {
      const now = performance.now();
      const lon0 = view.lon, lat0 = view.lat;
      grab(prev.x, prev.y, p.x, p.y);
      const dts = Math.max(0.004, (now - lastMoveT) / 1000);
      if (lastMoveT && dts < 0.12) {
        const a = 0.5;
        vLon = vLon * (1 - a) + (lonDelta(view.lon, lon0) / dts) * a;
        vLat = vLat * (1 - a) + ((view.lat - lat0) / dts) * a;
      }
      lastMoveT = now;
      touchView();
    }
    prev.x = p.x; prev.y = p.y;
  }
  function onPointerUp(e: PointerEvent): void {
    const had = pointers.delete(e.pointerId);
    if (!had || inputMode === 'none') return;
    const p = local(e);
    const now = performance.now();
    if (pointers.size >= 1) {
      // one finger left after a pinch: it must not turn into a drag jump or a tap
      moved = 99;
      dragging = inputMode === 'navigate';
      lastMoveT = 0;
      return;
    }
    if (lassoing) {
      lassoing = false;
      if (lassoPts.length >= 3 && moved > 6) {
        scene.lassoClosed = true;
        emit('lasso', decimate(lassoPts, 300).map((q) => ({ x: q.x, y: q.y })));
      } else {
        scene.lassoN = 0;
      }
      lassoPts = [];
      invalidate();
      return;
    }
    const wasDrag = dragging && moved > (e.pointerType === 'touch' ? 9 : 4);
    dragging = false;
    setCursor();
    if (wasDrag) {
      if (now - lastMoveT < 70 && !reduced()) {
        vLon = Math.max(-500, Math.min(500, vLon));
        vLat = Math.max(-300, Math.min(300, vLat));
        const pxPerDeg = (S * Math.PI) / 360;
        if (Math.hypot(vLon * Math.cos(view.lat * DEG), vLat) * pxPerDeg > 60) {
          inertia = true;
          invalidate();
        }
      }
      return;
    }
    if (inputMode !== 'navigate' || downButton !== 0 || moved > 9 || now - downT > 600) return;
    // a click / tap
    const dbl = now - lastTapT < 320 && Math.hypot(p.x - lastTapX, p.y - lastTapY) < 28;
    lastTapT = dbl ? 0 : now;
    lastTapX = p.x; lastTapY = p.y;
    if (dbl) {
      pixelToMount(p.x, p.y, p3);
      startFly(p3[0], p3[1], view.fov, 420);
      return;
    }
    const hit = pick(p.x, p.y);
    selectionRef = hit ? hit.ref : null;
    selectionStart = now;
    scene.selectionT = 0;
    prepareHighlights();
    invalidate();
    emit('select', hit);
  }
  function onWheel(e: WheelEvent): void {
    if (inputMode === 'none') return;
    e.preventDefault();
    cancelFly();
    inertia = false;
    const p = local(e);
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
    const dy = Math.max(-240, Math.min(240, e.deltaY * unit));
    fovTarget = clampFov(fovTarget * Math.exp(dy * (e.ctrlKey ? 0.01 : 0.0016)));
    zoomAX = p.x; zoomAY = p.y;
    zooming = true;
    invalidate();
  }
  function onKey(e: KeyboardEvent): void {
    if (inputMode === 'none' || e.metaKey || e.ctrlKey || e.altKey) return;
    const step = view.fov * 0.12;
    const lonStep = step / Math.max(0.2, Math.cos(view.lat * DEG));
    const east = view.mount === 'altaz' ? 1 : -1; // screen-right in lon units
    let used = true;
    switch (e.key) {
      case 'ArrowLeft': stopMotion(); view.lon -= east * lonStep; break;
      case 'ArrowRight': stopMotion(); view.lon += east * lonStep; break;
      case 'ArrowUp': stopMotion(); view.lat += step; break;
      case 'ArrowDown': stopMotion(); view.lat -= step; break;
      case '+': case '=': cancelFly(); fovTarget = clampFov(fovTarget * 0.8); zoomAX = width / 2; zoomAY = height / 2; zooming = true; break;
      case '-': case '_': cancelFly(); fovTarget = clampFov(fovTarget * 1.25); zoomAX = width / 2; zoomAY = height / 2; zooming = true; break;
      default: used = false;
    }
    if (used) {
      e.preventDefault();
      touchView();
    }
  }
  const onContext = (e: Event) => { if (inputMode === 'lasso') e.preventDefault(); };
  const onLeave = () => { if (!dragging) setCursor(); };
  ovCanvas.addEventListener('pointerdown', onPointerDown);
  ovCanvas.addEventListener('pointermove', onPointerMove);
  ovCanvas.addEventListener('pointerup', onPointerUp);
  ovCanvas.addEventListener('pointercancel', onPointerUp);
  ovCanvas.addEventListener('pointerleave', onLeave);
  ovCanvas.addEventListener('wheel', onWheel, { passive: false });
  ovCanvas.addEventListener('contextmenu', onContext);
  root.addEventListener('keydown', onKey);

  function startFly(lon: number, lat: number, fov: number, durationMs: number): Promise<void> {
    cancelFly();
    inertia = false;
    zooming = false;
    return new Promise<void>((resolve) => {
      const dur = reduced() ? 0 : Math.max(0, durationMs);
      fly = { lon0: view.lon, lat0: view.lat, fov0: view.fov, dLon: lonDelta(lon, view.lon), lat1: clampLat(lat), fov1: clampFov(fov), t0: performance.now(), dur, done: resolve };
      invalidate();
    });
  }

  // ───────────── context loss, resize, fonts
  const onLost = (e: Event) => { e.preventDefault(); renderer.lost = true; };
  const onRestored = () => { renderer.initGL(); invalidate(); };
  glCanvas.addEventListener('webglcontextlost', onLost);
  glCanvas.addEventListener('webglcontextrestored', onRestored);
  const ro = new ResizeObserver(() => resize());
  ro.observe(root);
  const onWinResize = () => resize();
  window.addEventListener('resize', onWinResize);
  const onFonts = () => { if (!destroyed) { overlay.resetGlyphs(); invalidate(); } };
  if (document.fonts) {
    document.fonts.load("500 13px 'Figtree Variable'").then(onFonts, () => undefined);
    document.fonts.addEventListener?.('loadingdone', onFonts);
  }
  let faintRequested = false;
  function maybeLoadFaint(): void {
    if (faintRequested || limitingMag <= 6.5) return;
    faintRequested = true;
    loadFaintStars().then((f) => {
      if (destroyed || !f) return;
      renderer.setFaintStars(f);
      invalidate();
    }, (err) => console.warn('[sky] faint stars unavailable', err));
  }

  resize();
  updateSky(simNow(), true);
  updateCamera();
  maybeLoadFaint();
  invalidate();

  // ───────────── controller
  const controller: SkyController = {
    getTime: () => new Date(simNow()),
    setTime(date) {
      simBase = date.getTime();
      realBase = performance.now();
      timeDirty = true;
      invalidate();
    },
    getTimeRate: () => rate,
    setTimeRate(r) {
      const now = performance.now();
      simBase = simNow(now);
      realBase = now;
      rate = isFinite(r) ? r : 0;
      timeDirty = true;
      invalidate();
    },
    getObserver: () => ({ ...observer }),
    setObserver(o) {
      observer = { ...o };
      ephemDirty = true;
      neuAt = ephemAt = NaN;
      prepareHighlights();
      invalidate();
    },
    getLayers: () => ({ ...layers }),
    setLayers(patch) {
      Object.assign(layers, patch);
      invalidate();
    },
    getLimitingMag: () => limitingMag,
    setLimitingMag(mag) {
      limitingMag = mag;
      maybeLoadFaint();
      invalidate();
    },
    getView: () => ({ ...view }),
    setView(patch) {
      stopMotion();
      if (patch.mount && patch.mount !== view.mount) {
        // keep looking at the same piece of sky
        updateSky(simNow(), false);
        lonLatToVec(view.lon, view.lat, o3);
        if (patch.mount === 'equatorial') applyMat(transpose33(neu, tmpM), o3[0], o3[1], o3[2], p3);
        else applyMat(neu, o3[0], o3[1], o3[2], p3);
        view.mount = patch.mount;
        view.lon = vecToLon(p3[0], p3[1]);
        view.lat = vecToLat(p3[0], p3[1], p3[2]);
      }
      if (patch.lon !== undefined && isFinite(patch.lon)) view.lon = patch.lon;
      if (patch.lat !== undefined && isFinite(patch.lat)) view.lat = patch.lat;
      if (patch.roll !== undefined && isFinite(patch.roll)) view.roll = patch.roll;
      if (patch.fov !== undefined && isFinite(patch.fov)) view.fov = patch.fov;
      touchView();
      fovTarget = view.fov;
      updateCamera();
    },
    flyTo(target, opts) {
      const sim = simNow();
      updateSky(sim, false);
      const t = catalog.resolve(target, { date: new Date(sim), observer });
      if (!t) {
        console.warn(`[sky] flyTo: unknown target ${target}`);
        return Promise.resolve();
      }
      const m = raDecToMount(t.ra, t.dec);
      return startFly(m.lon, m.lat, opts?.fov ?? view.fov, opts?.durationMs ?? 900);
    },
    setHighlights(list) {
      highlightList = list.slice();
      prepareHighlights();
      invalidate();
    },
    setSelection(ref) {
      selectionRef = ref;
      selectionStart = performance.now();
      scene.selectionT = 0;
      prepareHighlights();
      invalidate();
    },
    setInputMode(mode) {
      inputMode = mode;
      dragging = lassoing = false;
      pointers.clear();
      setCursor();
    },
    clearLasso() {
      scene.lassoN = 0;
      scene.lassoClosed = false;
      lassoPts = [];
      invalidate();
    },
    project(ra, dec) {
      updateSky(simNow(), false);
      updateCamera();
      lonLatToVec(ra, dec, q3);
      const ok = projectVec(eqj, S, width / 2, height / 2, q3[0], q3[1], q3[2], o3);
      const x = o3[0], y = o3[1];
      let visible = ok && o3[2] > -0.999 && x >= 0 && y >= 0 && x <= width && y <= height;
      if (visible && layers.ground && neu[6] * q3[0] + neu[7] * q3[1] + neu[8] * q3[2] < 0) visible = false;
      return { x, y, visible };
    },
    unproject(x, y) {
      if (width < 2 || !isFinite(x) || !isFinite(y)) return null;
      updateSky(simNow(), false);
      updateCamera();
      unprojectPx(eqj, S, width / 2, height / 2, x, y, o3);
      return { ra: vecToLon(o3[0], o3[1]), dec: vecToLat(o3[0], o3[1], o3[2]) };
    },
    getSize: () => ({ width, height }),
    on(event, cb) {
      listeners[event].add(cb);
      return () => {
        listeners[event].delete(cb);
      };
    },
    getFps: () => fps,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelFly();
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(clockTimer);
      clearTimeout(trailingTimer);
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      ovCanvas.removeEventListener('pointerdown', onPointerDown);
      ovCanvas.removeEventListener('pointermove', onPointerMove);
      ovCanvas.removeEventListener('pointerup', onPointerUp);
      ovCanvas.removeEventListener('pointercancel', onPointerUp);
      ovCanvas.removeEventListener('pointerleave', onLeave);
      ovCanvas.removeEventListener('wheel', onWheel);
      ovCanvas.removeEventListener('contextmenu', onContext);
      root.removeEventListener('keydown', onKey);
      glCanvas.removeEventListener('webglcontextlost', onLost);
      glCanvas.removeEventListener('webglcontextrestored', onRestored);
      renderer.destroy();
      for (const k of Object.keys(listeners) as (keyof SkyEvents)[]) listeners[k].clear();
      ovCanvas.width = ovCanvas.height = 1;
      root.remove();
    },
  };
  statsOf.set(controller, () => ({
    drawCalls: renderer.drawCalls, vertices: renderer.vertices, frames, glErrors: renderer.glErrors,
    starsDrawn: countBelow(renderer.starMags, scene.starLimit), faintLoaded: renderer.faintCount, lastFrameMs, glMs, overlayMs,
  }));
  return controller;
}
