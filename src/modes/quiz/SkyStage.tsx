/** Sky-first questions: find it (lasso), name it, and "what is ringed?". One sky engine is reused across questions. */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getBody, scoreConstellationLasso, type LassoResult } from '@/astro';
import { formatTime } from '@/lib/time';
import { quizAllowedLayers, SkyEmbed } from '@/components/sky-embed';
import { useSettings } from '@/store/settings';
import type { Highlight, SkyController } from '@/types';
import { Button } from '@/ui';
import { matchConstellation } from './logic/match';
import { liveRng } from './logic/rng';
import { fitFov, quizLayers, startView } from './logic/sky';
import type { FindQ, NameQ, QuizData, SkyObjQ } from './logic/types';
import { Choices, Feedback, type ViewProps } from './Session';
import { cssToken, isTyping } from './useQuizData';

type SkyQ = FindQ | NameQ | SkyObjQ;

export const LASSO_RULE =
  'Your loop counts when it holds at least 70% of the constellation’s main stars (the ones bright enough to be drawn), takes in no more than a couple of main stars of other constellations, and is not more than about four times the size of the figure.';

/** Embed toolbar on the right edge, vertically centred: clear of the prompt (top) and the answer bar (bottom). */
const EMBED_PLACEMENT = { '--se-bar-top': '50%', '--se-bar-shift': '-50%' } as CSSProperties;

export const debugOn = () => typeof window !== 'undefined' && /[?&]debug=1/.test(window.location.search + window.location.hash);
const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export function SkyStage({ q, data, result, answer, next }: ViewProps<SkyQ> & { data: QuizData }) {
  const diff = useSettings((s) => s.difficulty);
  const { catalog, observer } = data;
  const [c, setC] = useState<SkyController | null>(null);
  const [tool, setTool] = useState<'draw' | 'move'>('draw');
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [hasLoop, setHasLoop] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [lasso, setLasso] = useState<LassoResult | null>(null);
  const fitRef = useRef(60);
  const stageRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const con = q.kind === 'skyobj' ? null : catalog.conById.get(q.conId) ?? null;
  const real = useMemo(() => (q.kind !== 'name' && q.tonightTime ? { date: new Date(q.tonightTime), observer } : undefined), [q, observer]);
  const objTarget = useMemo(() => (q.kind === 'skyobj' ? catalog.resolve(q.ref, real ?? { date: data.now, observer }) : null), [q, catalog, real, data.now, observer]);

  // the learner may toggle only what the difficulty already allows (see quizAllowedLayers)
  const allowedLayers = useMemo(() => quizAllowedLayers(diff, q.kind), [diff, q.kind]);
  const initial = useRef({ observer, time: data.now, timeRate: 0, layers: quizLayers(diff), limitingMag: diff.limitingMag, inputMode: 'none' as const, showSelection: false, view: { mount: 'equatorial' as const, lon: 0, lat: 40, roll: 0, fov: 90 } });

  // ── set the scene for each question
  useEffect(() => {
    if (!c) return;
    const size = c.getSize();
    const aspect = size.width / Math.max(1, size.height);
    const rng = liveRng();
    setTool('draw');
    setHasLoop(false);
    setHint(null);
    setLasso(null);
    c.clearLasso();
    c.setTimeRate(0);
    c.setSelection(null);
    c.setObserver(observer);
    c.setTime(real ? real.date : data.now);
    c.setLimitingMag(diff.limitingMag);
    if (q.kind === 'skyobj') {
      if (!objTarget) return;
      c.setLayers(quizLayers(diff, { labels: false, real: !!real }));
      fitRef.current = q.fov;
      c.setView(startView({ target: { ra: objTarget.ra, dec: objTarget.dec, fov: q.fov / 1.12 }, diff, aspect, rng, centred: true, real }));
      c.setHighlights([]);
      c.setInputMode('navigate');
      return;
    }
    if (!con) return;
    const fov = catalog.resolve(`con:${con.id}`)?.fov ?? 60;
    fitRef.current = fitFov(fov, aspect);
    if (q.kind === 'find') {
      c.setLayers(quizLayers(diff, { real: !!real }));
      c.setView(startView({ target: { ra: con.ra, dec: con.dec, fov }, diff, aspect, rng, real }));
      c.setHighlights([]);
      c.setInputMode('lasso');
    } else {
      c.setLayers(quizLayers(diff, { labels: false }));
      c.setView(startView({ target: { ra: con.ra, dec: con.dec, fov }, diff, aspect, rng, centred: true }));
      c.setHighlights([{ type: 'constellation', id: con.id, lines: diff.lines, boundary: !diff.lines, label: false }]);
      c.setInputMode('navigate');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, q.key]);

  // ── find it: tool, Space to move, lasso scoring
  const finding = q.kind === 'find' && !result;
  useEffect(() => {
    if (c && finding) c.setInputMode(tool === 'draw' && !spaceHeld ? 'lasso' : 'navigate');
  }, [c, finding, tool, spaceHeld]);

  useEffect(() => {
    if (!finding) {
      setSpaceHeld(false);
      return;
    }
    const down = (e: KeyboardEvent) => {
      if (e.key !== ' ' || isTyping(e)) return;
      e.preventDefault();
      if (!e.repeat) setSpaceHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      e.preventDefault();
      setSpaceHeld(false);
    };
    const blur = () => setSpaceHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [finding]);

  useEffect(() => {
    if (!c || !finding || !con) return;
    return c.on('lasso', (points) => {
      const r = scoreConstellationLasso({ polygon: points, constellation: con, catalog, project: (ra, dec) => c.project(ra, dec), limitingMag: diff.limitingMag, minPadPx: coarse() ? 44 : 30 });
      if (r.reason === 'invalid') {
        c.clearLasso();
        setHasLoop(false);
        setHint('That loop was too small to count. Draw one closed loop right around the whole figure.');
        return;
      }
      setHasLoop(true);
      setLasso(r);
      answer({ correct: r.correct, message: r.message });
    });
  }, [c, finding, con, catalog, diff.limitingMag, answer]);

  // ── reveal
  useEffect(() => {
    if (!c || !result) return;
    c.setInputMode('navigate');
    if (q.kind === 'skyobj') return;
    if (!con) return;
    const hl: Highlight[] = [{ type: 'constellation', id: con.id, lines: true, label: true }];
    if (q.kind === 'find' && lasso) {
      const bad = cssToken('--bad', '#ff8f80');
      for (const id of lasso.missedTargets) hl.push({ type: 'object', ref: `star:${id}`, label: false, color: bad });
    }
    c.setHighlights(hl);
    if (q.kind === 'find') {
      // the whole revealed figure must sit in the open sky between the prompt panel and the action bar
      const size = c.getSize();
      const stage = stageRef.current?.getBoundingClientRect();
      const top = stage && promptRef.current ? promptRef.current.getBoundingClientRect().bottom - stage.top + 6 : size.height * 0.15;
      const bottom = stage && actionsRef.current?.firstElementChild ? actionsRef.current.firstElementChild.getBoundingClientRect().top - stage.top - 6 : size.height * 0.85;
      const pts = con.mainStars.map((id) => catalog.starById.get(id)).filter((s) => !!s).map((s) => c.project(s.ra, s.dec));
      const inView = pts.length > 0 && pts.every((p) => p.visible && p.x > 8 && p.x < size.width - 8 && p.y > top && p.y < bottom) && c.getView().fov <= fitRef.current * 1.8;
      if (!inView) {
        c.clearLasso();
        setHasLoop(false);
        // a little wider than the fit, so the figure clears the prompt panel once centred
        void c.flyTo(`con:${con.id}`, { fov: Math.min(150, fitRef.current * 1.35), durationMs: 700 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, result]);

  const onReady = useCallback((ctrl: SkyController) => {
    setC(ctrl);
    if (debugOn()) (window as unknown as { __quizSky?: SkyController }).__quizSky = ctrl;
  }, []);

  const clear = () => {
    c?.clearLasso();
    setHasLoop(false);
    setHint(null);
  };

  const when = real ? `Tonight’s sky at ${formatTime(real.date, observer.tz)}` : null;
  return (
    <div ref={stageRef} className="qz-stage" data-kind={q.kind} data-tool={q.kind === 'find' && !result ? (tool === 'draw' && !spaceHeld ? 'draw' : 'move') : undefined}>
      <SkyEmbed options={initial.current} onReady={onReady} className="qz-sky" controls="limited" allowedLayers={allowedLayers} style={EMBED_PLACEMENT} />
      {c && q.kind === 'skyobj' && objTarget && (
        <SkyMarker c={c} ra={objTarget.ra} dec={objTarget.dec} kind={q.objKind} label={result ? q.answerText : null} dotSize={q.objKind === 'planet' && objTarget.body && real ? planetDot(getBody(objTarget.body, real.date, observer).mag) : 0} />
      )}

      <div ref={promptRef} className="qz-prompt panel" data-testid="prompt">
        {q.kind === 'find' && con && (
          <>
            <p className="qz-prompt-main">
              Find <strong>{con.name}</strong> <span className="dim">{con.english}</span>
            </p>
            {!result && <p className="qz-prompt-sub dim">{hint ?? (tool === 'move' ? 'Drag to look around, scroll or pinch to zoom. Switch back to Draw to answer.' : `Draw one loop around it.${when ? ` ${when}.` : ''}`)}</p>}
          </>
        )}
        {q.kind === 'name' && (
          <>
            <p className="qz-prompt-main">Which constellation is highlighted?</p>
            {!result && <p className="qz-prompt-sub dim">{diff.lines ? 'Its figure is drawn in amber.' : 'Its region is outlined in amber.'} Drag to look around.</p>}
          </>
        )}
        {q.kind === 'skyobj' && (
          <>
            <p className="qz-prompt-main">{q.prompt}</p>
            {!result && when && <p className="qz-prompt-sub dim">{when}. Drag to look around.</p>}
          </>
        )}
        {result && (
          <Feedback result={result}>
            {q.kind === 'find' ? result.message ?? `This is ${q.answerText}.` : q.kind === 'name' ? (
              <>
                {result.given && !result.correct ? `You answered ${result.given}. ` : ''}This is {con?.name} ({con?.english}).
              </>
            ) : (
              <>
                {result.correct ? '' : `It is ${q.answerText}. `}
                {q.explanation}
              </>
            )}
          </Feedback>
        )}
      </div>

      <div ref={actionsRef} className="qz-actions" data-testid="actions">
        {q.kind === 'find' && !result && (
          <div className="qz-find-bar panel">
            <div className="qz-tool" role="group" aria-label="What dragging does">
              <button type="button" aria-pressed={tool === 'draw' && !spaceHeld} onClick={() => setTool('draw')} data-tool="draw">
                <PenIcon /> Draw
              </button>
              <button type="button" aria-pressed={tool === 'move' || spaceHeld} onClick={() => setTool('move')} data-tool="move">
                <HandIcon /> Move
              </button>
            </div>
            <span className="qz-find-tip faint">Hold Space to move · scroll to zoom</span>
            <Button size="sm" variant="quiet" disabled={!hasLoop} onClick={clear}>
              Clear
            </Button>
            <Button size="sm" onClick={() => answer({ correct: false, skipped: true, message: `This is ${q.answerText}.` })} data-testid="show-me">
              Show me
            </Button>
          </div>
        )}
        {q.kind === 'find' && result && (
          <div className="qz-find-bar panel">
            {hasLoop && (
              <Button size="sm" variant="quiet" onClick={clear}>
                Clear my loop
              </Button>
            )}
            <details className="qz-rule">
              <summary>How is this scored?</summary>
              <p>{LASSO_RULE}</p>
            </details>
            {next}
          </div>
        )}
        {q.kind === 'name' && con && <NameAnswer q={q} data={data} result={result} answer={answer} next={next} />}
        {q.kind === 'skyobj' && (
          <div className="qz-answer panel">
            <Choices choices={q.choices} answerIndex={q.answerIndex} picked={result?.given ? q.choices.indexOf(result.given) : null} locked={!!result} onPick={(i) => answer({ correct: i === q.answerIndex, given: q.choices[i] })} />
            <div className="qz-answer-foot">
              {!result && (
                <Button size="sm" variant="quiet" onClick={() => answer({ correct: false, skipped: true })}>
                  I don’t know
                </Button>
              )}
              {next}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NameAnswer({ q, data, result, answer, next }: ViewProps<NameQ> & { data: QuizData }) {
  const { catalog } = data;
  const [text, setText] = useState('');
  useEffect(() => setText(''), [q.key]);
  const con = catalog.conById.get(q.conId)!;
  const names = q.choices.map((id) => catalog.conById.get(id)?.name ?? id);
  return (
    <div className="qz-answer panel">
      {q.typed ? (
        <form
          className="qz-type"
          onSubmit={(e) => {
            e.preventDefault();
            if (result || !text.trim()) return;
            answer({ correct: matchConstellation(text, con, catalog.constellations).correct, given: text.trim() });
          }}
        >
          <input key={q.key} className="input" autoFocus disabled={!!result} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type its name or abbreviation" aria-label="Constellation name" autoComplete="off" autoCapitalize="off" spellCheck={false} />
          {!result && (
            <Button variant="primary" type="submit" disabled={!text.trim()}>
              Check
            </Button>
          )}
        </form>
      ) : (
        <Choices choices={names} answerIndex={q.choices.indexOf(q.conId)} picked={result?.given ? names.indexOf(result.given) : null} locked={!!result} onPick={(i) => answer({ correct: q.choices[i] === q.conId, given: names[i] })} />
      )}
      <div className="qz-answer-foot">
        {!result && (
          <Button size="sm" variant="quiet" onClick={() => answer({ correct: false, skipped: true })}>
            I don’t know
          </Button>
        )}
        {next}
      </div>
    </div>
  );
}

const planetDot = (mag: number) => Math.max(4, Math.min(10, 7 - mag * 1.2));

/**
 * A ring (and for planets and deep-sky objects, a marker) that follows a sky position. Drawn here rather than
 * by the engine because the engine's planet and deep-sky layers always print names (docs/requests/quiz.md).
 */
function SkyMarker({ c, ra, dec, kind, label, dotSize }: { c: SkyController; ra: number; dec: number; kind: 'star' | 'dso' | 'planet'; label: string | null; dotSize: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const p = c.project(ra, dec);
        const size = c.getSize();
        const on = Number.isFinite(p.x) && p.x > -40 && p.y > -40 && p.x < size.width + 40 && p.y < size.height + 40;
        el.style.opacity = on ? '1' : '0';
        if (on) el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [c, ra, dec]);
  return (
    <div ref={ref} className="qz-marker" data-kind={kind} data-testid="marker">
      <span className="qz-marker-ring" />
      {kind === 'planet' && <span className="qz-marker-dot" style={{ width: dotSize, height: dotSize }} />}
      {kind === 'dso' && <span className="qz-marker-dso" />}
      {label && <span className="qz-marker-label">{label}</span>}
    </div>
  );
}

const PenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 2.5c3.3 0 5.5 2 5.5 4.6 0 2.8-2.6 4.9-5.8 4.9-2.8 0-5.2-1.6-5.2-4.2 0-2.200 1.700-4 4-4.700" strokeDasharray="2.2 2" />
    <path d="M10.500 13.500l3-3" />
  </svg>
);
const HandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 1.500v13M1.500 8h13M8 1.500L6 3.500M8 1.500l2 2M8 14.500l-2-2M8 14.500l2-2M1.500 8l2-2M1.500 8l2 2M14.500 8l-2-2M14.500 8l-2 2" />
  </svg>
);
