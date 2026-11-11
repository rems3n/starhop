import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Demo } from '@/content/schema';
import { Button, RichText, Slider } from '@/ui';
import { BORTLE, type LayerState, type SkyController } from '@/types';
import { DEFAULT_PLAY_RATE, bortleLabel, latitudeLabel, observerAtLatitude, scrubRange, scrubTime, scrubValue, shiftLocalDays, shiftLocalMonths, SCRUB_STEP_MIN } from '../logic/controls';
import { bortleLimitingMag, placeDemoStep, resolveDemoStep, type SceneContext } from '../logic/scene';
import { SkyStage } from './SkyStage';

export interface DemoPlayerProps {
  demo: Demo;
  ctx: SceneContext;
  /** Start on this step (deep links, tests) */
  initialStep?: number;
  onController?: (c: SkyController | null) => void;
  onTarget?: (ref: string) => void;
  note?: string | null;
}

/** Interprets one lesson demo (docs/LESSON-BRIEF.md): one sky view, Next/Back through the steps, control widgets. */
export function DemoPlayer({ demo, ctx, initialStep = 0, onController, onTarget, note }: DemoPlayerProps) {
  const [i, setI] = useState(Math.min(Math.max(0, initialStep), demo.steps.length - 1));
  const [ctl, setCtl] = useState<SkyController | null>(null);
  const step = demo.steps[i];
  // If the step's subject cannot be seen from the learner's place at that time, show it later that night or from a reference place.
  const placement = useMemo(() => placeDemoStep(step, ctx), [step, ctx]);
  const scene = useMemo(() => resolveDemoStep(placement.step, ctx), [placement, ctx]);
  const placementNote = placement.kind === 'as-authored' ? null : placement.note;

  // What the learner has changed with the widgets since the step began. Cleared on every step and on Reset.
  const [time, setTime] = useState(scene.time);
  const [playing, setPlaying] = useState(scene.rate !== 0);
  const [lat, setLat] = useState(scene.observer.lat);
  const [bortle, setBortle] = useState(scene.bortle);
  const resetLocal = useCallback(() => {
    setTime(scene.time);
    setPlaying(scene.rate !== 0);
    setLat(scene.observer.lat);
    setBortle(scene.bortle);
  }, [scene]);
  useEffect(resetLocal, [resetLocal]);
  useEffect(() => (ctl ? ctl.on('time', setTime) : undefined), [ctl]);

  const has = (k: Demo['controls'][number]) => demo.controls.includes(k);
  const tz = scene.observer.tz;
  const range = useMemo(() => scrubRange(scene.time, tz), [scene, tz]);
  const playRate = scene.rate || DEFAULT_PLAY_RATE;

  const jump = (d: Date) => {
    ctl?.setTime(d);
    setTime(d);
  };
  const togglePlay = () => {
    if (!ctl) return;
    ctl.setTimeRate(playing ? 0 : playRate);
    setPlaying(!playing);
  };
  const showPlay = has('play') || scene.rate !== 0;
  const anyControls = showPlay || has('time-scrub') || has('date-step') || has('month-step') || has('latitude') || has('bortle');

  return (
    <div className="ln-demo">
      <SkyStage
        scene={scene}
        label={demo.title}
        note={note ?? placementNote ?? (scene.target && scene.layers.ground && scene.view.mount === 'altaz' && scene.target.alt < 0 ? `${scene.target.name} is below the horizon at this moment, so the view is aimed at the ground. Try the step again at another time.` : null)}
        onReset={resetLocal}
        pagePins={[...(Object.keys(step.layers ?? {}) as (keyof LayerState)[]), ...(step.bortle != null ? (['limitingMag'] as const) : [])]}
        onController={(c) => {
          setCtl(c);
          onController?.(c);
        }}
      >
        <div className="ln-demo-caption">
          <div className="ln-demo-title">
            <strong>{demo.title}</strong>
            {demo.steps.length > 1 && (
              <span className="dim">
                Step {i + 1} of {demo.steps.length}
              </span>
            )}
          </div>
          <p className="ln-demo-text" aria-live="polite">
            <RichText text={step.caption} onTarget={onTarget} />
          </p>
          {demo.steps.length > 1 && (
            <div className="row">
              <Button size="sm" disabled={i === 0} onClick={() => setI(i - 1)}>
                Back
              </Button>
              <Button size="sm" variant={i < demo.steps.length - 1 ? 'primary' : 'default'} disabled={i === demo.steps.length - 1} onClick={() => setI(i + 1)}>
                Next step
              </Button>
              <div className="ln-dots" aria-hidden>
                {demo.steps.map((_, k) => (
                  <span key={k} className={k === i ? 'is-on' : ''} />
                ))}
              </div>
            </div>
          )}
        </div>
        {anyControls && (
          <div className="ln-controls">
            {showPlay && (
              <div className="ln-control">
                <Button size="sm" pressed={playing} onClick={togglePlay}>
                  {playing ? 'Pause' : 'Play'}
                </Button>
                <span className="dim">{rateWords(playRate)}</span>
              </div>
            )}
            {has('time-scrub') && (
              <label className="ln-control ln-control--wide">
                <span>Time of night</span>
                <Slider
                  label="Time of night"
                  min={0}
                  max={range.minutes}
                  step={SCRUB_STEP_MIN}
                  value={scrubValue(time, range)}
                  onChange={(v) => {
                    if (playing) {
                      ctl?.setTimeRate(0);
                      setPlaying(false);
                    }
                    jump(scrubTime(v, range));
                  }}
                />
              </label>
            )}
            {has('date-step') && (
              <div className="ln-control">
                <span>Day</span>
                <Button size="sm" aria-label="One week earlier" onClick={() => jump(shiftLocalDays(ctl?.getTime() ?? time, -7, tz))}>
                  −7
                </Button>
                <Button size="sm" aria-label="One day earlier" onClick={() => jump(shiftLocalDays(ctl?.getTime() ?? time, -1, tz))}>
                  −1 day
                </Button>
                <Button size="sm" aria-label="One day later" onClick={() => jump(shiftLocalDays(ctl?.getTime() ?? time, 1, tz))}>
                  +1 day
                </Button>
                <Button size="sm" aria-label="One week later" onClick={() => jump(shiftLocalDays(ctl?.getTime() ?? time, 7, tz))}>
                  +7
                </Button>
              </div>
            )}
            {has('month-step') && (
              <div className="ln-control">
                <span>Month</span>
                <Button size="sm" onClick={() => jump(shiftLocalMonths(ctl?.getTime() ?? time, -1, tz))}>
                  −1 month
                </Button>
                <Button size="sm" onClick={() => jump(shiftLocalMonths(ctl?.getTime() ?? time, 1, tz))}>
                  +1 month
                </Button>
              </div>
            )}
            {has('latitude') && (
              <label className="ln-control ln-control--wide">
                <span>Latitude: {latitudeLabel(lat)}</span>
                <Slider
                  label="Latitude, from the North Pole on the left to the South Pole on the right"
                  min={-90}
                  max={90}
                  value={-Math.round(lat)}
                  onChange={(v) => {
                    setLat(-v);
                    ctl?.setObserver(observerAtLatitude(scene.observer, -v));
                  }}
                />
              </label>
            )}
            {has('bortle') && (
              <label className="ln-control ln-control--wide">
                <span>{bortleLabel(bortle)}</span>
                <Slider
                  label="Light pollution, Bortle class 1 (darkest) to 9 (inner city)"
                  min={1}
                  max={9}
                  value={bortle}
                  onChange={(v) => {
                    setBortle(v);
                    ctl?.setLimitingMag(bortleLimitingMag(v));
                  }}
                />
                <span className="faint ln-control-help">{BORTLE[bortle - 1].description}</span>
              </label>
            )}
          </div>
        )}
      </SkyStage>
    </div>
  );
}

function rateWords(rate: number): string {
  const r = Math.abs(rate);
  if (r >= 86000 && r <= 86500) return 'one day per second';
  if (r >= 86400 * 2) return `${Math.round(r / 86400)} days per second`;
  if (r >= 3600) return `${+(r / 3600).toFixed(1)} h per second`;
  if (r >= 60) return `${Math.round(r / 60)} min per second`;
  return r === 1 ? 'real time' : `${r}× real time`;
}
