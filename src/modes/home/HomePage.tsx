/** Landing page (route "/"): no app navigation. The hero is the real sky engine, slowly turning; "Enter the app" opens the Sky map. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from '@/lib/account';
import { SkyView } from '@/sky';
import { compass } from '@/lib/format';
import { formatTime } from '@/lib/time';
import { routes } from '@/lib/routes';
import { useSettings } from '@/store/settings';
import { DEFAULT_LAYERS, type LayerState, type SkyController } from '@/types';
import './home.css';

const base = import.meta.env.BASE_URL ?? './';
const HERO_LAYERS: LayerState = { ...DEFAULT_LAYERS, constellationArt: true, constellationNames: true, starNames: false, dsoMarkers: false, deepSky: false, atmosphere: false, horizon: false, ground: true };
const SECTIONS: [string, string, string, string][] = [
  ['/sky', 'Sky', 'Full planetarium with layers, a light-pollution slider and deep zoom to magnitude 11.', routes.sky()],
  ['/tonight', 'Tonight', 'What is up from your location tonight, this month and through the year.', routes.tonight()],
  ['/learn', 'Learn', 'Eight modules from dark adaptation to galaxies, built for your latitude.', routes.learn()],
  ['/library', 'Library', 'Constellations, myths, star-hops, stars and deep-sky objects.', routes.library()],
  ['/practice', 'Practice', 'Circle the constellation, follow the hop, keep what you learn.', routes.practice()],
];

export default function HomePage() {
  const account = useAccount();
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
        <div className="hm-top">
          <span className="hm-brand">Starhop</span>
          <span className="hm-top-actions">
            {account.status === 'guest' && account.enabled && <Link className="btn hm-enter-sm" to={routes.signin()}>Sign in</Link>}
            <Link className="btn hm-enter-sm" to={routes.sky()}>{account.status === 'signed-in' ? 'Open the app' : 'Enter the app'}</Link>
          </span>
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
            <h1>Know your <span>sky.</span></h1>
            <p className="hm-lede">This is the real sky over {observer.name} right now, drawn from 850,000 catalogued stars. Starhop is a live planetarium and a course that teaches you to read it.</p>
            <div className="hm-cta">
              <Link className="btn btn--primary hm-btn" to={routes.sky()}>{account.status === 'signed-in' ? 'Open the app' : 'Enter the app'}</Link>
              <Link className="btn hm-btn" to={routes.learn()}>Start the course</Link>
            </div>
          </div>
        </div>
      </header>

      <section className="hm-stats" aria-label="What is inside">
        <div><strong>851,948</strong><span>stars to magnitude 11</span></div>
        <div><strong>88</strong><span>constellations</span></div>
        <div><strong>120</strong><span>myths retold</span></div>
        <div><strong>11,798</strong><span>deep-sky objects</span></div>
        <div><strong>24</strong><span>lessons in 8 modules</span></div>
      </section>

      <section className="hm-band" style={{ backgroundImage: `url(${base}img/lessons/milky-way-panorama.jpg)` }}>
        <div className="hm-wrap"><div className="hm-inner">
          <span className="hm-kicker">Sky / live map</span>
          <h2>The whole sky, from where you stand</h2>
          <p>Set your location and time, drag across the dome and zoom from the full Milky Way down to eleventh-magnitude stars.</p>
          <Link className="btn hm-btn" to={routes.sky()}>Open the sky map</Link>
        </div></div>
        <span className="hm-credit">ESO/S. Brunier · CC BY 4.0</span>
      </section>
      <section className="hm-band hm-band--right" style={{ backgroundImage: `url(${base}img/M42-1.jpg)` }}>
        <div className="hm-wrap"><div className="hm-inner">
          <span className="hm-kicker">Library / 11,798 objects</span>
          <h2>Every nebula has an address</h2>
          <p>The Orion Nebula is 1,340 light-years away and visible without a telescope. The library tells you where to look, when, and what you will really see.</p>
          <Link className="btn hm-btn" to={routes.library()}>Browse the library</Link>
        </div></div>
        <span className="hm-credit">NASA, ESA, M. Robberto (STScI) · public domain</span>
      </section>

      <section className="hm-grid" aria-label="Sections">
        {SECTIONS.map(([path, name, text, to]) => (
          <Link key={path} className="hm-cell" to={to}><i>{path}</i><h3>{name}</h3><p>{text}</p></Link>
        ))}
      </section>
      <footer className="hm-foot"><div className="hm-wrap"><span>Starhop</span><span>Open data and images. No accounts, ads or trackers.</span><Link to={routes.sky()}>Enter the app</Link></div></footer>
    </div>
  );
}
