import { describe, expect, it } from 'vitest';
import { applyBaseline, readBaseline, trackPageController } from '@/components/sky-embed/controller';
import { bortleForMag, EMBED_LAYER_GROUPS, filterPatch, magForBortle, quizAllowedLayers, radecRef, visibleLayerGroups, zoomFov } from '@/components/sky-embed/layers';
import { BORTLE, DEFAULT_LAYERS, type LayerState, type SkyController, type ViewState } from '@/types';

describe('layer groups', () => {
  it('covers every layer exactly once, in the four groups', () => {
    const keys = EMBED_LAYER_GROUPS.flatMap((g) => g.items.map((i) => i.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(keys)).toEqual(new Set(Object.keys(DEFAULT_LAYERS)));
    expect(EMBED_LAYER_GROUPS.map((g) => g.title)).toEqual(['Constellations', 'Stars and objects', 'Guides', 'Ground and air']);
  });
  it('full shows all, none shows nothing, limited keeps only allowed keys and drops empty groups', () => {
    expect(visibleLayerGroups('full')).toBe(EMBED_LAYER_GROUPS);
    expect(visibleLayerGroups('none', ['constellationLines'])).toEqual([]);
    const lim = visibleLayerGroups('limited', ['constellationLines', 'equatorialGrid']);
    expect(lim.map((g) => g.title)).toEqual(['Constellations', 'Guides']);
    expect(lim.flatMap((g) => g.items.map((i) => i.key))).toEqual(['constellationLines', 'equatorialGrid']);
    expect(visibleLayerGroups('limited')).toEqual([]);
  });
  it('filterPatch never lets a limited embed change other layers', () => {
    const patch: Partial<LayerState> = { constellationLines: true, ground: false, atmosphere: true };
    expect(filterPatch(patch, 'limited', ['constellationLines'])).toEqual({ constellationLines: true });
    expect(filterPatch(patch, 'full')).toBe(patch);
    expect(filterPatch(patch, 'none')).toEqual({});
  });
});

describe('quiz allowed layers', () => {
  const easy = { lines: true, boundaries: false, labels: false };
  it('follows the difficulty', () => {
    expect(quizAllowedLayers(easy, 'find')).toContain('constellationLines');
    expect(quizAllowedLayers({ ...easy, lines: false }, 'find')).not.toContain('constellationLines');
    expect(quizAllowedLayers({ ...easy, boundaries: true }, 'find')).toContain('constellationBoundaries');
    expect(quizAllowedLayers(easy, 'find')).not.toContain('constellationBoundaries');
  });
  it('labels only when the difficulty has them, and never when naming', () => {
    expect(quizAllowedLayers(easy, 'find')).not.toContain('constellationNames');
    expect(quizAllowedLayers({ ...easy, labels: true }, 'find')).toEqual(expect.arrayContaining(['constellationNames', 'starNames']));
    expect(quizAllowedLayers({ ...easy, labels: true }, 'name')).not.toContain('constellationNames');
  });
  it('never ground, horizon or atmosphere while finding; never named planets or deep-sky markers', () => {
    const f = quizAllowedLayers({ lines: true, boundaries: true, labels: true }, 'find');
    for (const k of ['ground', 'horizon', 'atmosphere', 'planets', 'dsoMarkers'] as const) expect(f).not.toContain(k);
    const s = quizAllowedLayers(easy, 'skyobj');
    expect(s).not.toContain('atmosphere');
    expect(s).not.toContain('planets');
    expect(quizAllowedLayers(easy, 'hop')).not.toContain('ground');
  });
});

describe('bortle and view helpers', () => {
  it('round-trips Bortle classes and picks the nearest class for any magnitude', () => {
    for (const b of BORTLE) expect(bortleForMag(magForBortle(b.n))).toBe(b.n);
    expect(bortleForMag(4.0)).toBe(9); // easy quiz magnitude sits nearest Bortle 9 (3.8)
    expect(bortleForMag(9)).toBe(1);
    expect(bortleForMag(0)).toBe(9);
    expect(magForBortle(0)).toBe(BORTLE[0].limitingMag);
  });
  it('formats a radec ref and clamps zoom', () => {
    expect(radecRef(-10, 41.234)).toBe('radec:350.00,41.23');
    expect(zoomFov(100, 'in')).toBeCloseTo(100 / 1.4);
    expect(zoomFov(150, 'out')).toBe(160);
    expect(zoomFov(1.2, 'in')).toBe(1);
  });
});

function fakeController() {
  let layers: LayerState = { ...DEFAULT_LAYERS };
  let mag = 5;
  let view: ViewState = { mount: 'altaz', lon: 180, lat: 30, roll: 0, fov: 90 };
  let time = new Date(0);
  const c = {
    getLayers: () => ({ ...layers }),
    setLayers: (p: Partial<LayerState>) => void (layers = { ...layers, ...p }),
    getLimitingMag: () => mag,
    setLimitingMag: (m: number) => void (mag = m),
    getView: () => ({ ...view }),
    setView: (p: Partial<ViewState>) => void (view = { ...view, ...p }),
    getTime: () => time,
    setTime: (d: Date) => void (time = d),
    setTimeRate: () => undefined,
    setObserver: () => undefined,
    setHighlights: () => undefined,
    setSelection: () => undefined,
    getFps() {
      return this === c ? 60 : -1;
    },
  };
  return c as unknown as SkyController & typeof c;
}

describe('page controller tracking', () => {
  it('records what the page sets as the reset baseline, and not what the embed sets', () => {
    const raw = fakeController();
    let changes = 0;
    const t = { baseline: readBaseline(raw), user: { layers: {} }, pinned: new Set<never>(), onPageChange: () => changes++ };
    const page = trackPageController(raw, t);
    page.setLayers({ constellationBoundaries: true });
    page.setLimitingMag(4.3);
    page.setView({ fov: 40 });
    page.setTime(new Date(1000));
    expect(changes).toBe(2);
    // the learner changes things through the raw controller
    raw.setLayers({ equatorialGrid: true, constellationBoundaries: false });
    raw.setLimitingMag(7.6);
    raw.setView({ fov: 10, lon: 0 });
    raw.setTime(new Date(5000));
    // a later partial page patch only overrides its own keys in the baseline
    page.setLayers({ starNames: false });
    expect(raw.getLayers().equatorialGrid).toBe(true);
    applyBaseline(raw, t.baseline);
    expect(raw.getLayers()).toEqual({ ...DEFAULT_LAYERS, constellationBoundaries: true, starNames: false });
    expect(raw.getLimitingMag()).toBe(4.3);
    expect(raw.getView()).toEqual({ mount: 'altaz', lon: 180, lat: 30, roll: 0, fov: 40 });
    expect(raw.getTime().getTime()).toBe(1000);
  });
  it('passes every other method through, bound to the real controller', () => {
    const raw = fakeController();
    const page = trackPageController(raw, { baseline: readBaseline(raw), user: { layers: {} }, pinned: new Set() });
    const { getFps } = page;
    expect(getFps()).toBe(60);
    expect(page.getLimitingMag()).toBe(5);
  });

  it("keeps the learner's filters when the page shows something new, unless the page pins them", () => {
    const raw = fakeController();
    const t = { baseline: readBaseline(raw), user: { layers: { constellationLines: false } }, pinned: new Set<'limitingMag' | 'equatorialGrid'>(), limiting: 0 } as unknown as Parameters<typeof trackPageController>[1];
    t.user.limitingMag = 3.8;
    const page = trackPageController(raw, t);
    // the page applies a new scene with lines on and a 5.3 limit: the learner's choices win
    page.setLayers({ constellationLines: true, starNames: true });
    page.setLimitingMag(5.3);
    expect(raw.getLayers().constellationLines).toBe(false);
    expect(raw.getLayers().starNames).toBe(true);
    expect(raw.getLimitingMag()).toBe(3.8);
    // the baseline (what Reset returns to) is still the page's own setting
    expect(t.baseline.layers.constellationLines).toBe(true);
    expect(t.baseline.limitingMag).toBe(5.3);
    // a pinned key: the page wins and the learner's override for it is dropped
    t.pinned = new Set(['limitingMag', 'constellationLines']);
    page.setLayers({ constellationLines: true });
    page.setLimitingMag(6.5);
    expect(raw.getLayers().constellationLines).toBe(true);
    expect(raw.getLimitingMag()).toBe(6.5);
    expect(t.user.limitingMag).toBeUndefined();
    expect('constellationLines' in t.user.layers).toBe(false);
  });
});

