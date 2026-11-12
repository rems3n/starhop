/**
 * Landing page (route "/"): no app navigation. The hero is the real sky engine, slowly turning.
 * The scroll follows the story of the hook video: what am I looking at → the live sky → zoom in to real telescope
 * images → the myths → test yourself → the course → what will you find?
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
import './home.css';

const base = import.meta.env.BASE_URL ?? './';
const HERO_LAYERS: LayerState = { ...DEFAULT_LAYERS, constellationArt: true, constellationNames: true, starNames: false, dsoMarkers: false, deepSky: false, atmosphere: false, horizon: false, ground: true };
const GALLERY = [
  { src: 'M16-2.jpg', name: 'Pillars of Creation', credit: 'Hubble · NASA, ESA, Hubble Heritage Team' },
  { src: 'M51-1.jpg', name: 'Whirlpool Galaxy', credit: 'NASA and ESA' },
  { src: 'M104-2.jpg', name: 'Sombrero Galaxy', credit: 'Webb · NASA, ESA, CSA, STScI' },
  { src: 'M45-1.jpg', name: 'Pleiades', credit: 'NASA, ESA, AURA/Caltech, Palomar' },
];
const MODULES: [string, string][] = [
  ['How to look', 'Dark-adapt your eyes, find north, measure the sky with your hand.'],
  ['How the sky moves', 'Why the stars turn through the night and change with the seasons.'],
  ['Finding your way', 'Star-hopping: use the patterns you know to find the ones you do not.'],
  ['Your first constellations', 'The fifteen brightest, most recognizable figures from where you live.'],
  ['Season by season', 'Every other constellation you can see, in the evenings it is best placed.'],
  ['Sun, Moon and planets', 'The ecliptic, the zodiac, phases, eclipses and the wandering planets.'],
  ["What's out there", 'Star colours and types, clusters, nebulae and galaxies.'],
  ['Beyond your horizon', 'The sky you cannot see from home, and where to go to see it.'],
];

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
            <p className="hm-lede">You have looked up your whole life. Starhop shows you what you are looking at: the live sky over {observer.name}, the stories behind the stars, and a course that teaches you to read it.</p>
            <Cta />
          </div>
        </div>
      </header>

      <section className="hm-band" style={{ backgroundImage: `url(${base}img/lessons/milky-way-panorama.jpg)` }}>
        <div className="hm-wrap"><div className="hm-inner">
          <span className="hm-kicker">01 / The sky, live</span>
          <h2>What am I looking at?</h2>
          <p>Starhop draws the sky over you right now, from wherever you are. Drag across the dome, turn on the constellation lines and names, and see what is up tonight.</p>
          <Link className="btn hm-btn" to={routes.sky()}>Open the sky map</Link>
        </div></div>
        <span className="hm-credit">ESO/S. Brunier · CC BY 4.0</span>
      </section>

      <section className="hm-band hm-band--right" style={{ backgroundImage: `url(${base}img/M42-1.jpg)` }}>
        <div className="hm-wrap"><div className="hm-inner">
          <span className="hm-kicker">02 / Zoom in on anything</span>
          <h2>Past the constellations</h2>
          <p>Zoom from the whole Milky Way down to Orion's sword and the nebula inside it. Thousands of nebulae, clusters and galaxies, with real images from Hubble, Webb and the great observatories.</p>
          <Link className="btn hm-btn" to={routes.objects()}>See the deep sky</Link>
        </div></div>
        <span className="hm-credit">Orion Nebula · NASA, ESA, M. Robberto (STScI) · public domain</span>
      </section>
      <section className="hm-gallery" aria-label="Real telescope images">
        {GALLERY.map((g) => (
          <figure key={g.src}>
            <img src={`${base}img/${g.src}`} alt={g.name} loading="lazy" />
            <figcaption><b>{g.name}</b><span>{g.credit}</span></figcaption>
          </figure>
        ))}
      </section>

      <section className="hm-band" style={{ backgroundImage: `url(${base}img/home/stories.jpg)` }}>
        <div className="hm-wrap"><div className="hm-inner">
          <span className="hm-kicker">03 / 120 myths retold</span>
          <h2>Every star has a story</h2>
          <p>The hunter and the scorpion who never share the sky. The queen who boasted too much. Read the myths behind the figures, told from the ancient sources, and the patterns start to stick.</p>
          <Link className="btn hm-btn" to={routes.myths()}>Read the myths</Link>
        </div></div>
        <span className="hm-credit">Constellation art: Johan Meuris, Stellarium · Free Art License</span>
      </section>

      <section className="hm-band hm-band--right" style={{ backgroundImage: `url(${base}img/home/practice.jpg)` }}>
        <div className="hm-wrap"><div className="hm-inner">
          <span className="hm-kicker">04 / Practice</span>
          <h2>Then test yourself</h2>
          <p>Circle Orion on a sky with no labels. Follow a star-hop from memory. What you miss comes back sooner and what you know comes back later, until you know the sky by heart.</p>
          <Link className="btn hm-btn" to={routes.practice()}>Try a round</Link>
        </div></div>
      </section>

      <section className="hm-course" aria-labelledby="hm-course-h">
        <div className="hm-wrap">
          <div className="hm-course-head">
            <span className="hm-kicker">05 / The course</span>
            <h2 id="hm-course-h">From your first star to all 88 constellations</h2>
            <p>A guided course in eight modules, built for your latitude. Start with the skills every observer uses, learn fifteen anchor constellations, then fill in the whole sky season by season.</p>
          </div>
          <ol className="hm-modules">
            {MODULES.map(([title, text], i) => (
              <li key={title}><i>{String(i + 1).padStart(2, '0')}</i><h3>{title}</h3><p>{text}</p></li>
            ))}
          </ol>
          <div className="hm-stats" aria-label="What is inside">
            <div><strong>8</strong><span>course modules</span></div>
            <div><strong>24</strong><span>lessons</span></div>
            <div><strong>88</strong><span>constellations</span></div>
            <div><strong>120</strong><span>myths retold</span></div>
            <div><strong>11,798</strong><span>deep-sky objects</span></div>
          </div>
          <Link className="btn hm-btn" to={routes.learn()}>Start the course</Link>
        </div>
      </section>

      <section className="hm-final">
        <div className="hm-wrap">
          <h2>What will you <span>find?</span></h2>
          <Cta />
        </div>
      </section>
      <footer className="hm-foot"><div className="hm-wrap"><span>Starhop</span><span>Open data and images. No ads or trackers.</span><Link to={routes.sky()}>Enter the app</Link></div></footer>
    </div>
  );
}
