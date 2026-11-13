/**
 * The home page below the hero: seven beats that follow the hook video. Each beat shows a short looping clip of
 * the real app (filmed the same way as the video), which plays while the beat is on screen. With reduced motion
 * the clip's poster frame is shown instead.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '@/lib/routes';

const base = import.meta.env.BASE_URL ?? './';

function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setSeen(true), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

/** A muted looping clip from public/video/home: loads when near the screen, plays only while visible. */
function Clip({ name, label, credit }: { name: string; label: string; credit?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const v = ref.current;
    if (!v || still || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [still]);
  return (
    <figure className="hm-viz">
      {still ? (
        <img src={`${base}video/home/${name}.jpg`} alt={label} loading="lazy" />
      ) : (
        <video ref={ref} src={`${base}video/home/${name}.mp4`} poster={`${base}video/home/${name}.jpg`} muted loop playsInline preload="none" aria-label={label} />
      )}
      {credit && <figcaption>{credit}</figcaption>}
    </figure>
  );
}

function Beat({ n, kicker, title, children, visual, flip, action, after }: { n: string; kicker: string; title: ReactNode; children: ReactNode; visual: ReactNode; flip?: boolean; action?: ReactNode; after?: ReactNode }) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`hm-beat${flip ? ' hm-beat--flip' : ''}${seen ? ' is-in' : ''}`}>
      <div className="hm-wrap hm-beat-grid">
        <div className="hm-beat-text">
          <span className="hm-kicker">{n} / {kicker}</span>
          <h2>{title}</h2>
          {children}
          {action}
        </div>
        {visual}
      </div>
      {after}
    </section>
  );
}

const MODULES = ['How to look', 'How the sky moves', 'Finding your way', 'Your first constellations', 'Season by season', 'Sun, Moon and planets', "What's out there", 'Beyond your horizon'];

export function Story({ cta }: { cta: ReactNode }) {
  const [end, endSeen] = useInView<HTMLElement>();
  return (
    <>
      <Beat n="01" kicker="The question" title="You've looked up your whole life." visual={<Clip name="orion" label="Stars over Brooklyn; lines and names appear and the pattern becomes Orion" />}>
        <p className="hm-big">But what are you actually looking at?</p>
      </Beat>

      <Beat flip n="02" kicker="The sky, live" title="The sky, from wherever you are." visual={<Clip name="live" label="The southern sky turning above the horizon in the Starhop sky map" />} action={<Link className="btn hm-btn" to={routes.sky()}>Open the sky map</Link>}>
        <p>Starhop draws the sky over you right now: every star, planet and constellation above your horizon. Open it in daylight and it shows you tonight, once it's dark.</p>
      </Beat>

      <Beat n="03" kicker="Zoom in" title="Past the constellations." visual={<Clip name="zoom" label="Zooming from Orion into its sword, ending on the Hubble image of the Orion Nebula" credit="Orion Nebula · NASA, ESA, M. Robberto (STScI/ESA)" />} action={<Link className="btn hm-btn" to={routes.objects()}>See the deep sky</Link>}>
        <p>Zoom from the whole sky into Orion's sword, and the nebula hiding inside it. 11,798 nebulae, clusters and galaxies, with real images from Hubble and Webb.</p>
      </Beat>

      <Beat flip n="04" kicker="Stories" title="Every star has a story." visual={<Clip name="stories" label="Constellation figures fading in over the stars: Orion, Taurus, Gemini and the Unicorn" credit="Constellation art · Johan Meuris, Stellarium" />} action={<Link className="btn hm-btn" to={routes.myths()}>Read the myths</Link>}>
        <p>Orion the hunter and the scorpion that killed him are placed on opposite sides of the sky, so one always sets as the other rises. Read the myths behind the figures and the patterns start to stick.</p>
      </Beat>

      <Beat n="05" kicker="Practice" title="Then test yourself." visual={<Clip name="quiz" label="A practice round: a loop is drawn around Orion on an unlabelled sky and marked correct" />} action={<Link className="btn hm-btn" to={routes.practice()}>Try a round</Link>}>
        <p>Circle the constellation on a sky with no labels. What you miss comes back sooner and what you know comes back later, until you know the sky by heart.</p>
      </Beat>

      <Beat
        flip
        n="06"
        kicker="The course"
        title="From your first star to all 88 constellations."
        visual={<Clip name="course" label="Scrolling through the course modules in Starhop" />}
        action={<Link className="btn hm-btn" to={routes.learn()}>Start the course</Link>}
        after={
          <div className="hm-wrap">
            <ol className="hm-path">
              {MODULES.map((m, i) => (
                <li key={m} style={{ animationDelay: `${0.4 + i * 0.25}s` }}><i>{String(i + 1).padStart(2, '0')}</i><span>{m}</span></li>
              ))}
            </ol>
          </div>
        }
      >
        <p>A guided course in eight modules, built for where you live.</p>
      </Beat>

      <section ref={end} className={`hm-final${endSeen ? ' is-in' : ''}`}>
        <div className="hm-wrap">
          <svg className="hm-flare" viewBox="0 0 240 240" aria-hidden="true">
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
