/**
 * Landing page (route "/"): no app navigation. The hero is the real sky engine, slowly turning.
 * Below it, Story.tsx follows the hook video beat by beat with drawn animations instead of photographs.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from '@/lib/account';
import { SkyView } from '@/sky';
import { compass } from '@/lib/format';
import { formatTime } from '@/lib/time';
import { routes } from '@/lib/routes';
import { useSettings } from '@/store/settings';
import { DEFAULT_LAYERS, type LayerState, type SkyController } from '@/types';
import { Story } from './Story';
import './home.css';

const HERO_LAYERS: LayerState = { ...DEFAULT_LAYERS, constellationArt: true, constellationNames: true, starNames: false, dsoMarkers: false, deepSky: false, atmosphere: false, horizon: false, ground: true };
/** The page's call to action, at the top and again at the end. */
function Cta() {
  const account = useAccount();
  if (account.status === 'signed-in') return <div className="hm-cta"><Link className="btn btn--primary hm-btn" to={routes.sky()}>Open the app</Link></div>;
  return (
    <div className="hm-cta">
      <Link className="btn btn--primary hm-btn" to={routes.sky()}>Enter the app</Link>
      {account.enabled && (
        <>
          <Link className="btn hm-btn" to={routes.signin(undefined, 'signup')}>Sign up</Link>
          <Link className="hm-signin" to={routes.signin()}>Sign in</Link>
        </>
      )}
    </div>
  );
}

export default function HomePage() {
  const observer = useSettings((s) => s.observer);
  const [ctl, setCtl] = useState<SkyController | null>(null);
  const [figures, setFigures] = useState(true);
  const [lines, setLines] = useState(true);
  const [spin, setSpin] = useState(true);
  const [readout, setReadout] = useState({ dir: 'S', time: '' });
  const heroRef = useRef<HTMLDivElement>(null);
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Slow pan around the horizon; stops while the visitor drags, and for good if they ask.
  useEffect(() => {
    if (!ctl || !spin || reduce) return;
    let raf = 0, last = performance.now(), held = false;
    const el = heroRef.current;
    const down = () => (held = true), up = () => (held = false);
    el?.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!held && !document.hidden) ctl.setView({ lon: (ctl.getView().lon + dt * 1.6) % 360 });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el?.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
  }, [ctl, spin, reduce]);

  useEffect(() => {
    if (!ctl) return;
    const upd = () => setReadout({ dir: compass(ctl.getView().lon), time: formatTime(ctl.getTime(), observer.tz) });
    upd();
    const id = setInterval(upd, 1000);
    return () => clearInterval(id);
  }, [ctl, observer.tz]);

  useEffect(() => { ctl?.setLayers({ constellationArt: figures, constellationLines: lines }); }, [ctl, figures, lines]);

  // The page must keep scrolling when the wheel is over the hero: keep the event from the sky's zoom handler.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener('wheel', stop, { capture: true });
    return () => el.removeEventListener('wheel', stop, { capture: true });
  }, []);

  return (
    <div className="hm">
      <header className="hm-hero" ref={heroRef}>
        <div className={`hm-sky${coarse ? ' is-static' : ''}`}>
          <SkyView
            options={{ observer, time: new Date(), timeRate: reduce ? 0 : 60, layers: HERO_LAYERS, limitingMag: 6.3, view: { mount: 'altaz', lon: 180, lat: 34, fov: 92, roll: 0 }, inputMode: coarse ? 'none' : 'navigate', showSelection: false }}
            onReady={setCtl}
          />
        </div>
        <div className="hm-hud" role="group" aria-label="Live sky controls">
          <div className="hm-hud-row"><span>Live sky</span><b>{observer.name}</b></div>
          <div className="hm-hud-row"><span>Local time</span><b>{readout.time}</b></div>
          <div className="hm-hud-row"><span>Looking</span><b>{readout.dir}</b></div>
          <div className="hm-seg">
            <button type="button" aria-pressed={figures} onClick={() => setFigures(!figures)}>Figures</button>
            <button type="button" aria-pressed={lines} onClick={() => setLines(!lines)}>Lines</button>
            <button type="button" aria-pressed={spin} onClick={() => setSpin(!spin)}>Turn</button>
          </div>
          {!coarse && <span>Drag the sky to look around.</span>}
        </div>
        <div className="hm-copy">
          <div className="hm-wrap">
            <h1>Starhop</h1>
            <p className="hm-sub">Know your <span>sky.</span></p>
            <p className="hm-lede">A live planetarium and a course that teaches you to read it.</p>
            <Cta />
          </div>
        </div>
      </header>

      <Story cta={<Cta />} />

      <footer className="hm-foot"><div className="hm-wrap"><span>Starhop</span><span>Open data and images. No ads or trackers.</span><Link to={routes.sky()}>Enter the app</Link></div></footer>
    </div>
  );
}
