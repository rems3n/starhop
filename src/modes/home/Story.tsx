/**
 * The home page below the hero: seven beats that follow the hook video, each with one line-and-gradient
 * animation (no photographs). An animation starts when its beat scrolls into view; with reduced motion the
 * finished drawing is shown still.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { nightWindow } from '@/astro';
import { formatTime } from '@/lib/time';
import { routes } from '@/lib/routes';
import { useSettings } from '@/store/settings';

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setSeen(true), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

function Beat({ n, kicker, title, children, visual, flip, action }: { n: string; kicker: string; title: ReactNode; children: ReactNode; visual: ReactNode; flip?: boolean; action?: ReactNode }) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`hm-beat${flip ? ' hm-beat--flip' : ''}${seen ? ' is-in' : ''}`}>
      <div className="hm-wrap hm-beat-grid">
        <div className="hm-beat-text">
          <span className="hm-kicker">{n} / {kicker}</span>
          <h2>{title}</h2>
          <p>{children}</p>
          {action}
        </div>
        <div className="hm-viz" aria-hidden="true">{visual}</div>
      </div>
    </section>
  );
}

// ── 1. Scattered stars become Orion
const ORI: Record<string, [number, number]> = { meissa: [262, 62], betelgeuse: [196, 112], bellatrix: [318, 122], alnitak: [236, 204], alnilam: [258, 196], mintaka: [280, 188], saiph: [214, 300], rigel: [330, 286] };
const ORI_LINES: [string, string][] = [['meissa', 'betelgeuse'], ['meissa', 'bellatrix'], ['betelgeuse', 'alnitak'], ['bellatrix', 'mintaka'], ['alnitak', 'alnilam'], ['alnilam', 'mintaka'], ['alnitak', 'saiph'], ['mintaka', 'rigel']];
const FIELD: [number, number, number][] = [[40, 50, 1.2], [92, 150, 1], [70, 262, 1.4], [130, 318, 1], [150, 40, 1], [392, 60, 1.3], [440, 150, 1], [470, 250, 1.2], [410, 318, 1], [372, 214, 0.9], [120, 220, 0.9], [486, 44, 1], [24, 180, 0.9], [356, 336, 1.1]];

function OrionViz() {
  return (
    <svg viewBox="0 0 520 360">
      {FIELD.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} className="hv-dim" />)}
      {ORI_LINES.map(([a, b], i) => (
        <line key={i} x1={ORI[a][0]} y1={ORI[a][1]} x2={ORI[b][0]} y2={ORI[b][1]} pathLength={1} className="hv-draw" style={{ animationDelay: `${0.5 + i * 0.22}s` }} />
      ))}
      {Object.entries(ORI).map(([k, [x, y]]) => <circle key={k} cx={x} cy={y} r={k === 'betelgeuse' || k === 'rigel' ? 3.6 : 2.6} className="hv-star" />)}
      <text x="352" y="204" className="hv-label hv-fade" style={{ animationDelay: '2.5s' }}>Orion</text>
    </svg>
  );
}

// ── 2. Dusk falls and the stars come out
const DUSK_STARS: [number, number, number][] = [[60, 60, 1.6], [130, 120, 1.1], [200, 50, 1.3], [270, 140, 1], [330, 70, 1.8], [400, 120, 1.2], [460, 50, 1.4], [100, 180, 1], [360, 190, 1.1], [240, 96, 1], [480, 170, 1], [30, 130, 1.1]];
function DuskViz({ place, dark }: { place: string; dark: string }) {
  return (
    <svg viewBox="0 0 520 360">
      <defs>
        <linearGradient id="hv-dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1030" />
          <stop offset="0.7" stopColor="#3b2a6b" />
          <stop offset="1" stopColor="#c2553f" />
        </linearGradient>
        <clipPath id="hv-above"><rect width="520" height="262" /></clipPath>
      </defs>
      <rect width="520" height="262" fill="url(#hv-dusk)" className="hv-duskfade" />
      <g clipPath="url(#hv-above)"><circle cx="260" cy="232" r="22" className="hv-sun" /></g>
      {DUSK_STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} className="hv-star hv-fade" style={{ animationDelay: `${1.6 + i * 0.12}s` }} />)}
      <line x1="0" y1="262" x2="520" y2="262" className="hv-line" />
      <text x="20" y="296" className="hv-mono">{place}</text>
      <text x="500" y="296" textAnchor="end" className="hv-mono hv-swap-a">Daylight</text>
      <text x="500" y="296" textAnchor="end" className="hv-mono hv-accent hv-fade" style={{ animationDelay: '2.4s' }}>{dark}</text>
    </svg>
  );
}

// ── 3. Rings fall inward: constellation → nebula → galaxy
const ZOOM = ['The whole sky', 'Orion', 'Orion Nebula · 1,344 light-years', 'Andromeda Galaxy · 2.5 million light-years'];
function ZoomViz() {
  return (
    <div className="hv-zoom">
      <svg viewBox="0 0 520 320">
        <defs>
          <radialGradient id="hv-glow">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="0.12" stopColor="#b9a4ff" stopOpacity="0.7" />
            <stop offset="0.45" stopColor="#5b3fd1" stopOpacity="0.28" />
            <stop offset="1" stopColor="#5b3fd1" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="260" cy="160" r="150" fill="url(#hv-glow)" className="hv-pulse" />
        {[0, 1, 2, 3].map((i) => <circle key={i} cx="260" cy="160" r="150" className="hv-ring" style={{ animationDelay: `${i * -1.5}s` }} />)}
        <path d="M260 146 L262 158 L274 160 L262 162 L260 174 L258 162 L246 160 L258 158 Z" fill="#fff" />
      </svg>
      <div className="hv-steps">{ZOOM.map((z, i) => <span key={z} style={{ animationDelay: `${i * 2}s` }}>{z}</span>)}</div>
    </div>
  );
}

// ── 4. Orion and Scorpius on opposite sides of a turning sky
const MINI_ORI: [number, number][] = [[-14, -26], [14, -22], [-6, -2], [0, -4], [6, -6], [-12, 22], [16, 18]];
const MINI_SCO: [number, number][] = [[-22, -20], [-18, -8], [-12, 2], [-2, 10], [8, 18], [18, 20], [26, 12], [24, 2]];
function OppositeViz() {
  const poly = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <svg viewBox="0 0 520 360">
      <defs><clipPath id="hv-dome"><rect width="520" height="250" /></clipPath></defs>
      <g clipPath="url(#hv-dome)">
        <circle cx="260" cy="250" r="190" className="hv-line hv-dash" />
        <g className="hv-turn">
          <g transform="translate(70 250) scale(1.7)">
            <polyline points="-14,-26 -6,-2 -12,22" className="hv-fig" /><polyline points="14,-22 6,-6 16,18" className="hv-fig" /><polyline points="-6,-2 0,-4 6,-6" className="hv-fig" />
            {MINI_ORI.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" className="hv-star" />)}
          </g>
          <g transform="translate(450 250) rotate(180) scale(1.7)">
            <polyline points={poly(MINI_SCO)} className="hv-fig hv-fig--b" />
            {MINI_SCO.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 2 ? 3.2 : 2.2} className={i === 2 ? 'hv-star hv-star--red' : 'hv-star'} />)}
          </g>
        </g>
      </g>
      <line x1="30" y1="250" x2="490" y2="250" className="hv-line" />
      <text x="40" y="282" className="hv-mono">West</text>
      <text x="480" y="282" textAnchor="end" className="hv-mono">East</text>
      <text x="260" y="320" textAnchor="middle" className="hv-mono hv-accent">One sets as the other rises</text>
    </svg>
  );
}

// ── 5. A lasso, a check, and reviews spreading out
const CAS: [number, number][] = [[150, 74], [205, 128], [262, 92], [314, 146], [372, 98]];
const REVIEWS: [number, string][] = [[60, '1 day'], [146, '3 days'], [236, '1 week'], [344, '3 weeks'], [468, '2 months']];
function QuizViz() {
  return (
    <svg viewBox="0 0 520 360">
      {FIELD.slice(0, 9).map(([x, y, r], i) => <circle key={i} cx={x} cy={y * 0.62} r={r} className="hv-dim" />)}
      {CAS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" className="hv-star" />)}
      <ellipse cx="262" cy="110" rx="150" ry="66" pathLength={1} className="hv-draw hv-lasso" style={{ animationDelay: '0.5s' }} transform="rotate(-4 262 110)" />
      <g className="hv-pop" style={{ animationDelay: '1.9s' }}>
        <circle cx="424" cy="64" r="17" className="hv-check-bg" />
        <path d="M415 64 L422 71 L434 57" className="hv-check" />
      </g>
      <line x1="60" y1="264" x2="468" y2="264" className="hv-line" />
      {REVIEWS.map(([x, label], i) => (
        <g key={label} className="hv-fade" style={{ animationDelay: `${2.4 + i * 0.3}s` }}>
          <circle cx={x} cy="264" r="6" className="hv-node" />
          <text x={x} y="296" textAnchor={i === 0 ? 'start' : i === REVIEWS.length - 1 ? 'end' : 'middle'} className="hv-mono">{label}</text>
        </g>
      ))}
      <text x="60" y="236" className="hv-mono hv-accent hv-fade" style={{ animationDelay: '2.3s' }}>Next reviews</text>
    </svg>
  );
}

// ── 6. Eight modules light up; the count runs to 88
const MODULES = ['How to look', 'How the sky moves', 'Finding your way', 'Your first constellations', 'Season by season', 'Sun, Moon and planets', "What's out there", 'Beyond your horizon'];
function CourseBeat() {
  const [ref, seen] = useInView<HTMLElement>();
  const [count, setCount] = useState(1);
  useEffect(() => {
    if (!seen) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setCount(88); return; }
    let raf = 0;
    const t0 = performance.now() + 600;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / 2600));
      setCount(Math.round(1 + 87 * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen]);
  return (
    <section ref={ref} className={`hm-beat hm-course${seen ? ' is-in' : ''}`}>
      <div className="hm-wrap">
        <div className="hm-course-head">
          <div className="hm-beat-text">
            <span className="hm-kicker">06 / The course</span>
            <h2>From your first star to all 88 constellations.</h2>
            <p>A guided course in eight modules, built for where you live.</p>
            <Link className="btn hm-btn" to={routes.learn()}>Start the course</Link>
          </div>
          <div className="hm-count" aria-hidden="true"><strong>{count}</strong><span>of 88 constellations</span></div>
        </div>
        <ol className="hm-path">
          {MODULES.map((m, i) => (
            <li key={m} style={{ animationDelay: `${0.5 + i * 0.3}s` }}><i>{String(i + 1).padStart(2, '0')}</i><span>{m}</span></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Story({ cta }: { cta: ReactNode }) {
  const observer = useSettings((s) => s.observer);
  const [q, qSeen] = useInView<HTMLElement>();
  const [end, endSeen] = useInView<HTMLElement>();
  const w = nightWindow(new Date(), observer);
  const dusk = w.astroDusk ?? w.nauticalDusk ?? w.civilDusk;
  return (
    <>
      <section ref={q} className={`hm-beat hm-question${qSeen ? ' is-in' : ''}`}>
        <div className="hm-wrap hm-beat-grid">
          <div className="hm-beat-text">
            <span className="hm-kicker">01 / The question</span>
            <h2>You've looked up your whole life.</h2>
            <p className="hm-big">But what are you actually looking at?</p>
          </div>
          <div className="hm-viz" aria-hidden="true"><OrionViz /></div>
        </div>
      </section>

      <Beat flip n="02" kicker="The sky, live" title="The sky, from wherever you are." visual={<DuskViz place={observer.name} dark={dusk ? `Dark at ${formatTime(dusk, observer.tz)}` : 'Tonight'} />} action={<Link className="btn hm-btn" to={routes.sky()}>Open the sky map</Link>}>
        Starhop draws the sky over you right now: every star, planet and constellation above your horizon. Open it in daylight and it shows you tonight, once it's dark.
      </Beat>

      <Beat n="03" kicker="Zoom in" title="Past the constellations." visual={<ZoomViz />} action={<Link className="btn hm-btn" to={routes.objects()}>See the deep sky</Link>}>
        Zoom from the whole sky into Orion's sword, and the nebula hiding inside it. 11,798 nebulae, clusters and galaxies, with real images from Hubble and Webb inside the app.
      </Beat>

      <Beat flip n="04" kicker="Stories" title="Every star has a story." visual={<OppositeViz />} action={<Link className="btn hm-btn" to={routes.myths()}>Read the myths</Link>}>
        Orion the hunter and the scorpion that killed him are placed on opposite sides of the sky, so one always sets as the other rises. Read the myths behind the figures and the patterns start to stick.
      </Beat>

      <Beat n="05" kicker="Practice" title="Then test yourself." visual={<QuizViz />} action={<Link className="btn hm-btn" to={routes.practice()}>Try a round</Link>}>
        Circle the constellation on a sky with no labels. What you miss comes back sooner and what you know comes back later, until you know the sky by heart.
      </Beat>

      <CourseBeat />

      <section ref={end} className={`hm-final${endSeen ? ' is-in' : ''}`}>
        <div className="hm-wrap">
          <svg className="hm-flare" viewBox="0 0 240 240" aria-hidden="true">
            <defs>
              <radialGradient id="hv-end">
                <stop offset="0" stopColor="#8f7bff" stopOpacity="0.55" />
                <stop offset="1" stopColor="#8f7bff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="120" cy="120" r="120" fill="url(#hv-end)" className="hv-fade" />
            <g className="hv-flare-d"><path d="M120 66 L126 114 L174 120 L126 126 L120 174 L114 126 L66 120 L114 114 Z" transform="rotate(45 120 120)" fill="#fff" /></g>
            <g className="hv-flare-m"><path d="M120 14 L131 109 L226 120 L131 131 L120 226 L109 131 L14 120 L109 109 Z" fill="#fff" /></g>
          </svg>
          <h2>What will you <span>find?</span></h2>
          {cta}
        </div>
      </section>
    </>
  );
}
