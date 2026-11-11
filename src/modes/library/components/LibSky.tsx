/**
 * The library's embedded sky: a SkyEmbed driven by a Learn scene (place, time, camera, layers, highlights),
 * with a clock readout and an optional note. The embed's own controls give layers, light pollution, reset
 * and "Open in the sky map".
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SkyEmbed } from '@/components/sky-embed';
import { formatDate, formatTime } from '@/lib/time';
import type { SkyController } from '@/types';
import { applyScene, type SkyScene } from '@/modes/learn/logic/scene';

declare global {
  interface Window {
    /** The library sky view on screen (for headless checks) */
    __libSky?: SkyController;
  }
}

export function LibSky({ scene, onController, note, children, openTarget, size = 'tall', label, controls = 'full' }: {
  /** Memoise: re-applied whenever it changes */
  scene: SkyScene;
  onController?: (c: SkyController | null) => void;
  note?: string | null;
  children?: ReactNode;
  openTarget?: string;
  size?: 'tall' | 'small';
  label?: string;
  controls?: 'full' | 'none';
}) {
  const [ctl, setCtl] = useState<SkyController | null>(null);
  const [time, setTime] = useState(scene.time);
  const first = useRef(scene);
  const cb = useRef(onController);
  cb.current = onController;

  useEffect(() => {
    if (!ctl) return;
    applyScene(ctl, scene);
    setTime(scene.time);
  }, [ctl, scene]);

  useEffect(() => {
    if (!ctl) return;
    window.__libSky = ctl;
    cb.current?.(ctl);
    const off = ctl.on('time', setTime);
    return () => {
      off();
      cb.current?.(null);
      if (window.__libSky === ctl) delete window.__libSky;
    };
  }, [ctl]);

  const s0 = first.current;
  const obs = ctl?.getObserver() ?? scene.observer;
  const chart = scene.view.mount === 'equatorial';
  return (
    <div className={`lb-sky lb-sky--${size}`}>
      <div className="lb-sky-view" aria-label={label ?? 'Sky view'}>
        <SkyEmbed
          options={{ observer: s0.observer, time: s0.time, timeRate: 0, layers: s0.layers, limitingMag: s0.limitingMag, view: s0.view, inputMode: 'navigate' }}
          onReady={setCtl}
          controls={controls}
          openTarget={openTarget ?? scene.target?.ref}
        />
        <div className="lb-sky-clock">
          {chart ? (
            <span>Star chart, north up</span>
          ) : (
            <>
              <span>{formatDate(time, obs.tz, { month: 'short', day: 'numeric' })}</span>
              <strong>{formatTime(time, obs.tz)}</strong>
              <span className="lb-sky-place">{obs.name}</span>
            </>
          )}
        </div>
        {note && (
          <div className="lb-sky-note" role="status">
            {note}
          </div>
        )}
      </div>
      {children && <div className="lb-sky-under">{children}</div>}
    </div>
  );
}
