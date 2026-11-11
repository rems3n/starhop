/** Star-hop "follow the hop": start star(s) ringed, the hop's instructions shown, click the star you land on. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { angularSeparation } from '@/astro';
import { SkyEmbed } from '@/components/sky-embed';
import { routes } from '@/lib/routes';
import { useSettings } from '@/store/settings';
import type { Highlight, LayerState, SkyController } from '@/types';
import { Button } from '@/ui';
import { liveRng } from './logic/rng';
import { fitFov, quizLayers } from './logic/sky';
import { hopFrame, hopTolerancePx, judgeHopClick, type ScreenPoint } from './logic/starhop';
import type { HopQ, QuizData } from './logic/types';
import { Feedback, type ViewProps } from './Session';
import { debugOn } from './SkyStage';
import { cssToken } from './useQuizData';

const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/** A tap or click (not a drag) on the sky, in canvas pixels. */
function useSkyClick(stage: HTMLDivElement | null, active: boolean, onClick: (p: { x: number; y: number }) => void) {
  useEffect(() => {
    if (!stage || !active) return;
    let down: { x: number; y: number; t: number; id: number } | null = null;
    const canvas = () => stage.querySelector('canvas');
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('.qz-prompt, .qz-actions, button, a, input, select')) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      const cv = canvas();
      if (!d || !cv || d.id !== e.pointerId || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 700) return;
      const r = cv.getBoundingClientRect();
      onClick({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    stage.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    return () => {
      stage.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
    };
  }, [stage, active, onClick]);
}

export function HopStage({ q, data, result, answer, next }: ViewProps<HopQ> & { data: QuizData }) {
  const diff = useSettings((s) => s.difficulty);
  const { catalog, observer } = data;
  const [c, setC] = useState<SkyController | null>(null);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [pick, setPick] = useState<{ ref: string | null; ra: number; dec: number } | null>(null);
  const path = useMemo(() => q.path.map((r) => catalog.resolve(r)!).filter(Boolean), [q, catalog]);
  const target = useMemo(() => catalog.resolve(q.target), [q, catalog]);
  const frame = useMemo(() => hopFrame(path), [path]);
  const initial = useRef({ observer, time: data.now, timeRate: 0, layers: quizLayers(diff, { labels: false }), limitingMag: diff.limitingMag, inputMode: 'navigate' as const, showSelection: false, view: { mount: 'equatorial' as const, lon: frame.ra, lat: frame.dec, roll: 0, fov: 60 } });
  const allowed = useMemo(() => (['constellationLines', 'constellationBoundaries'] as (keyof LayerState)[]).filter((k) => (k === 'constellationLines' ? diff.lines : diff.boundaries)), [diff.lines, diff.boundaries]);

  const startHighlights = useCallback((): Highlight[] => q.start.map((ref) => ({ type: 'object', ref, label: catalog.resolve(ref)?.name ?? true })), [q, catalog]);

  // ── scene: the whole hop in view, start ringed and named, everything else unlabelled
  useEffect(() => {
    if (!c) return;
    const size = c.getSize();
    const aspect = size.width / Math.max(1, size.height);
    setPick(null);
    c.setTimeRate(0);
    c.setSelection(null);
    c.setObserver(observer);
    c.setTime(data.now);
    c.setLimitingMag(diff.limitingMag);
    c.setLayers(quizLayers(diff, { labels: false }));
    const roll = diff.randomRotation ? Math.floor(liveRng()() * 360) : 0;
    // room for the instructions above and the action bar below
    c.setView({ mount: 'equatorial', lon: frame.ra, lat: frame.dec, roll, fov: fitFov(frame.radius * 2 + 12, aspect, 1.45) });
    c.setHighlights(startHighlights());
    c.setInputMode('navigate');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, q.key]);

  // ── the learner's click
  const onClick = useCallback(
    (p: { x: number; y: number }) => {
      if (!c || !target || result) return;
      const tp = c.project(target.ra, target.dec);
      const at = c.unproject(p.x, p.y);
      const cands: ScreenPoint[] = [];
      if (at) {
        for (const s of catalog.stars) {
          if (s.mag > diff.limitingMag) break;
          if (angularSeparation(s, at) > 4) continue;
          const sp = c.project(s.ra, s.dec);
          if (sp.visible) cands.push({ id: `star:${s.id}`, x: sp.x, y: sp.y, ra: s.ra, dec: s.dec });
        }
      }
      const tol = hopTolerancePx(c.getSize().height, c.getView().fov, coarse());
      const r = judgeHopClick(p, { id: target.ref, x: tp.x, y: tp.y, ra: target.ra, dec: target.dec }, cands, tol);
      const pickedName = r.picked ? catalog.resolve(r.picked.id)?.name : null;
      setPick(r.picked ? { ref: r.picked.id, ra: r.picked.ra, dec: r.picked.dec } : at ? { ref: null, ...at } : null);
      answer({ correct: r.correct, given: r.correct ? undefined : pickedName ?? 'empty sky' });
    },
    [c, target, result, catalog, diff.limitingMag, answer],
  );
  useSkyClick(stage, !!c && !result, onClick);

  // ── reveal: the hop path, each step's star named, the target ringed (and the learner's miss)
  useEffect(() => {
    if (!c || !result) return;
    const good = cssToken('--good', '#7fd69b');
    const bad = cssToken('--bad', '#ff8f80');
    const hl: Highlight[] = [{ type: 'polyline', points: q.path, color: cssToken('--amber', '#f2b84b') }];
    q.path.forEach((ref, i) => {
      const name = catalog.resolve(ref)?.name ?? '';
      const last = i === q.path.length - 1;
      hl.push({ type: 'object', ref, label: i === 0 ? `Start · ${name}` : last ? name : `${i} · ${name}`, color: last ? good : undefined });
    });
    if (!result.correct && pick) {
      if (pick.ref && pick.ref !== q.target) hl.push({ type: 'object', ref: pick.ref, label: 'Your pick', color: bad });
      else if (!pick.ref) hl.push({ type: 'circle', center: `radec:${pick.ra.toFixed(3)},${pick.dec.toFixed(3)}`, radiusDeg: 0.6, color: bad });
    }
    c.setHighlights(hl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, result]);

  const onReady = useCallback((ctrl: SkyController) => {
    setC(ctrl);
    if (debugOn()) (window as unknown as { __quizSky?: SkyController }).__quizSky = ctrl;
  }, []);

  return (
    <div ref={setStage} className="qz-stage qz-hop" data-kind="hop">
      <SkyEmbed options={initial.current} onReady={onReady} className="qz-sky" controls="limited" allowedLayers={allowed} />
      <div className="qz-prompt panel" data-testid="prompt">
        <p className="qz-prompt-main">{result ? q.title : 'Follow the hop'}</p>
        <ol className="qz-hop-steps">
          {q.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {!result && <p className="qz-prompt-sub dim">The start is ringed. Click or tap the star where the hop ends. Drag to look around.</p>}
        {result && (
          <Feedback result={result}>
            {result.correct ? '' : result.given ? `You picked ${result.given === 'empty sky' ? 'empty sky' : result.given}. ` : ''}
            The hop ends at {q.targetName}. {q.explanation} <Link to={routes.starhop(q.hopId)}>Read the hop</Link>
          </Feedback>
        )}
      </div>
      <div className="qz-actions" data-testid="actions">
        <div className="qz-find-bar panel">
          {!result && (
            <Button size="sm" onClick={() => answer({ correct: false, skipped: true })} data-testid="show-me">
              Show me
            </Button>
          )}
          {next}
        </div>
      </div>
    </div>
  );
}
