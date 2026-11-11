import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SkyView } from '@/sky';
import { formatDate, formatTime } from '@/lib/time';
import type { SkyController } from '@/types';
import { applyScene, type SkyScene } from '../logic/scene';
import { exploreHref } from '../hooks';

declare global {
  interface Window {
    /** The sky view currently on screen in Learn (for the headless checks in scripts/learn) */
    __learnSky?: SkyController;
    __learnScene?: SkyScene;
  }
}

export interface SkyStageProps {
  /** Memoise this: the scene is re-applied whenever the object changes */
  scene: SkyScene;
  onController?: (c: SkyController | null) => void;
  /** Called after Reset re-applies the scene (clear any local control state) */
  onReset?: () => void;
  /** Short line shown over the bottom of the sky, e.g. "X is below the horizon" */
  note?: string | null;
  /** Controls placed under the sky */
  children?: ReactNode;
  exploreTarget?: string;
  label?: string;
}

/** One sky view driven by a scene, with the clock readout, Reset and "Open in Explore". */
export function SkyStage({ scene, onController, onReset, note, children, exploreTarget, label }: SkyStageProps) {
  const [ctl, setCtl] = useState<SkyController | null>(null);
  const [time, setTime] = useState(scene.time);
  const first = useRef(scene);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const cbRef = useRef(onController);
  cbRef.current = onController;

  useEffect(() => {
    if (!ctl) return;
    applyScene(ctl, scene);
    setTime(scene.time);
    window.__learnScene = scene;
  }, [ctl, scene]);

  useEffect(() => {
    if (!ctl) return;
    window.__learnSky = ctl;
    cbRef.current?.(ctl);
    const off = ctl.on('time', setTime);
    return () => {
      off();
      cbRef.current?.(null);
      if (window.__learnSky === ctl) delete window.__learnSky;
    };
  }, [ctl]);

  const s0 = first.current;
  const tz = (ctl?.getObserver() ?? scene.observer).tz;
  const place = (ctl?.getObserver() ?? scene.observer).name;
  return (
    <div className="ln-stage">
      <div className="ln-stage-sky" aria-label={label ?? 'Sky view'}>
        <SkyView
          options={{ observer: s0.observer, time: s0.time, timeRate: 0, layers: s0.layers, limitingMag: s0.limitingMag, view: s0.view, inputMode: 'navigate' }}
          onReady={setCtl}
        />
        <div className="ln-stage-clock">
          <span>{formatDate(time, tz, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <strong>{formatTime(time, tz)}</strong>
          <span className="ln-stage-place">{place}</span>
        </div>
        <div className="ln-stage-tools">
          <button
            type="button"
            className="ln-stage-tool"
            title="Put the sky back the way this step set it up"
            onClick={() => {
              if (ctl) applyScene(ctl, sceneRef.current);
              setTime(sceneRef.current.time);
              onReset?.();
            }}
          >
            Reset
          </button>
          <Link className="ln-stage-tool" to={exploreHref(exploreTarget ?? scene.target?.ref, time)}>
            Open in Explore
          </Link>
        </div>
        {note && (
          <div className="ln-stage-note" role="status">
            {note}
          </div>
        )}
      </div>
      {children && <div className="ln-stage-under">{children}</div>}
    </div>
  );
}
