import { describe, expect, it } from 'vitest';
import { altAzOf } from '@/astro';
import type { DemoStep } from '@/content/schema';
import { zonedParts } from '@/lib/time';
import { REFERENCE_NORTH, REFERENCE_SOUTH, demoStepSubject, placeDemoStep, resolveDemoStep, type SceneContext } from '@/modes/learn/logic/scene';
import { BROOKLYN } from './fixtures/load';
import { learnCatalog } from './learn-catalog';

const cat = learnCatalog();
const NOW = new Date('2026-11-11T01:30:00Z');
const SYDNEY = { name: 'Sydney, Australia', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' };
const LONDON = { name: 'London, UK', lat: 51.51, lon: -0.13, tz: 'Europe/London' };
const NEW_YORK = { name: 'New York, NY', lat: 40.71, lon: -74.01, tz: 'America/New_York' };
const ctxAt = (observer: typeof SYDNEY): SceneContext => ({ observer, bortle: 6, now: NOW, resolve: cat.resolve });
const step = (s: Partial<DemoStep>): DemoStep => ({ caption: 'A caption for the test.', ...s });

/** Altitude of the step's subject in the scene the player would show */
function shownAlt(s: DemoStep, ctx: SceneContext) {
  const scene = resolveDemoStep(s, ctx);
  const ref = demoStepSubject(s)!;
  const t = cat.resolve(ref, { date: scene.time, observer: scene.observer })!;
  return { scene, alt: altAzOf(t.ra, t.dec, scene.time, scene.observer).alt };
}

describe('demo steps that work everywhere', () => {
  it('shows a Big Dipper step from mid-northern latitudes to a Sydney learner, at the same clock time', () => {
    const s = step({ time: 'month:4 21:00', view: { target: 'asterism:big-dipper', fov: 60 } });
    const p = placeDemoStep(s, ctxAt(SYDNEY));
    expect(p.kind).toBe('reference');
    if (p.kind !== 'reference') return;
    expect(p.observer).toEqual(REFERENCE_NORTH);
    expect(p.note).toBe('This step is shown from mid-northern latitudes, because from Sydney, Australia, the Big Dipper is below the horizon at that time.');
    const { scene, alt } = shownAlt(p.step, ctxAt(SYDNEY));
    expect(scene.observer.name).toBe('mid-northern latitudes (New York)');
    expect(zonedParts(scene.time, REFERENCE_NORTH.tz)).toMatchObject({ month: 4, day: 15, hour: 21, minute: 0 });
    expect(alt).toBeGreaterThan(30);
  });

  it('leaves an Orion step at 21:00 in January alone for a London learner', () => {
    const s = step({ time: 'month:1 21:00', view: { target: 'con:Ori', fov: 60 } });
    const p = placeDemoStep(s, ctxAt(LONDON));
    expect(p.kind).toBe('as-authored');
    expect(p.step).toBe(s);
  });

  it('shows a Southern Cross step from mid-southern latitudes to a New York learner', () => {
    const s = step({ time: 'month:5 21:00', highlights: [{ type: 'constellation', id: 'Cru' }] });
    const p = placeDemoStep(s, ctxAt(NEW_YORK));
    expect(p.kind).toBe('reference');
    if (p.kind !== 'reference') return;
    expect(p.observer).toEqual(REFERENCE_SOUTH);
    expect(p.note).toMatch(/^This step is shown from mid-southern latitudes, because from New York, NY, .* is below the horizon at that time\.$/);
    const { scene, alt } = shownAlt(p.step, ctxAt(NEW_YORK));
    expect(zonedParts(scene.time, REFERENCE_SOUTH.tz)).toMatchObject({ month: 5, day: 15, hour: 21 });
    expect(alt).toBeGreaterThan(30);
  });

  it('moves a step to later the same night when the target rises there', () => {
    // Mid-November, 19:00: Orion has not risen yet from Brooklyn, but it is high after midnight.
    const s = step({ time: 'month:11 19:00', view: { target: 'con:Ori', fov: 60 } });
    const p = placeDemoStep(s, ctxAt(BROOKLYN));
    expect(p.kind).toBe('later');
    if (p.kind !== 'later') return;
    expect(p.step.observer).toBeUndefined();
    expect(p.note).toMatch(/^This step is shown at \d{1,2}:\d{2} [AP]M, when Orion is highest that night from Brooklyn, NY/);
    const { scene, alt } = shownAlt(p.step, ctxAt(BROOKLYN));
    expect(scene.observer).toEqual(BROOKLYN);
    expect(alt).toBeGreaterThan(40);
    const local = zonedParts(scene.time, BROOKLYN.tz);
    expect(local.day === 16 && local.hour < 6).toBe(true); // after midnight, before dawn
  });

  it('never moves steps with a fixed observer, a star-chart mount or the ground switched off', () => {
    const fixed = step({ observer: SYDNEY, time: 'month:4 21:00', view: { target: 'asterism:big-dipper' } });
    expect(placeDemoStep(fixed, ctxAt(NEW_YORK)).kind).toBe('as-authored');
    const chart = step({ time: 'month:4 21:00', view: { target: 'asterism:big-dipper', mount: 'equatorial' } });
    expect(placeDemoStep(chart, ctxAt(SYDNEY)).kind).toBe('as-authored');
    const noGround = step({ time: 'month:4 21:00', view: { target: 'asterism:big-dipper' }, layers: { ground: false } });
    expect(placeDemoStep(noGround, ctxAt(SYDNEY)).kind).toBe('as-authored');
  });

  it('uses the first object or constellation highlight when there is no view target, and skips horizon points', () => {
    expect(demoStepSubject(step({ highlights: [{ type: 'label', at: 'star:Vega', text: 'x' }, { type: 'object', ref: 'star:Polaris' }] }))).toBe('star:Polaris');
    expect(demoStepSubject(step({ view: { target: 'point:south' } }))).toBeNull();
    expect(demoStepSubject(step({}))).toBeNull();
    expect(placeDemoStep(step({ view: { target: 'point:south' } }), ctxAt(SYDNEY)).kind).toBe('as-authored');
  });
});
