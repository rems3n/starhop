/**
 * First-visit walkthrough of the app. Starts by itself the first time someone lands on the sky map (after the
 * location prompt), dims the page, puts a ring around one area at a time and explains it. It can be skipped at
 * any step and replayed from Settings. Steps whose area is not on screen (some are hidden on phones) are left out.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { useAccount } from '@/lib/account';
import { routes } from '@/lib/routes';
import { useSettings } from '@/store/settings';
import './tour.css';

interface Step {
  /** CSS selector of the area to ring; none = a card in the middle of the screen */
  target?: string;
  title: string;
  text: string;
}

export function tourSteps(place: string): Step[] {
  return [
    { title: 'Welcome to Starhop', text: 'Here is a one-minute tour of the main areas. You can skip it at any point and replay it later from Settings.' },
    { title: 'This is your sky', text: `The stars over ${place} right now, or tonight once it is dark if you open the app in daylight. Drag to look around, scroll or pinch to zoom, and click any star, planet or constellation to learn about it.` },
    { target: '.ex-search', title: 'Search the sky', text: 'Type the name of a star, planet or constellation, or a catalog number such as M42, and the map flies to it.' },
    { target: '.ex-tools', title: 'Location, layers and light pollution', text: 'Set where you observe from, choose what is drawn on the map (lines, names, figures, grids), and match it to how dark your sky is.' },
    { target: '.ex-view', title: 'View controls', text: 'Zoom in and out, reset the view, and turn to face north, east, south or west.' },
    { target: '.ex-time', title: 'Travel in time', text: 'Step or play time forward and back to see what rises later tonight or in another season. Now brings you back to the present.' },
    { target: '.app-tab[href$="/tonight"]', title: 'Tonight', text: 'What is up this evening from your location, and the best times to look.' },
    { target: '.app-tab[href$="/learn"]', title: 'Learn', text: 'The guided course: eight modules that take you from your first star to all 88 constellations.' },
    { target: '.app-tab[href$="/library"]', title: 'Library', text: 'Every constellation, bright star, deep-sky object and myth in one place, with real telescope images.' },
    { target: '.app-tab[href$="/practice"]', title: 'Practice', text: 'Quizzes that bring back what you miss sooner and what you know later, until it sticks.' },
    { target: '.ch-launch', title: 'Ask Starhop', text: 'Stuck or curious? Ask the assistant a question about the sky or about using the app.' },
    { target: '.ac-trigger', title: 'Your account', text: 'Sign in to save your progress and defaults and pick up on any device. Your profile and settings are here too.' },
    { title: 'You are ready', text: 'Explore the sky on your own, or start the course and let Starhop guide you.' },
  ];
}

export const useTour = create<{ open: boolean; start: () => void; stop: () => void }>()((set) => ({
  open: false,
  start: () => set({ open: true }),
  stop: () => set({ open: false }),
}));

function rectOf(sel?: string): DOMRect | null {
  if (!sel) return null;
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < window.innerHeight ? r : null;
}

const PAD = 6;
const GAP = 14;

export function Tour() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { open, start, stop } = useTour();
  const seen = useSettings((s) => s.tourSeen);
  const setSeen = useSettings((s) => s.setTourSeen);
  const located = useSettings((s) => s.locationChosen);
  const place = useSettings((s) => s.observer.name);
  const ready = useAccount((s) => s.status !== 'loading');
  const [steps, setSteps] = useState<Step[]>([]);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);

  // First visit: begin once the sky map is up and the location prompt has been answered.
  useEffect(() => {
    if (open || seen || !located || !ready || pathname !== '/sky') return;
    const t = window.setTimeout(() => !useSettings.getState().tourSeen && start(), 1400);
    return () => window.clearTimeout(t);
  }, [open, seen, located, ready, pathname, start]);

  // On opening: keep the steps whose area is actually on this screen.
  useEffect(() => {
    if (!open) return;
    setSteps(tourSteps(place).filter((s) => !s.target || rectOf(s.target)));
    setI(0);
  }, [open, place]);

  const close = useCallback(() => {
    setSeen(true);
    stop();
  }, [setSeen, stop]);

  // Leaving the sky map ends the tour.
  useEffect(() => {
    if (open && pathname !== '/sky') close();
  }, [open, pathname, close]);

  const step = steps[i];
  const place_ = useCallback(() => {
    if (!step) return;
    const r = rectOf(step.target);
    setBox(r);
    const c = card.current;
    if (!c) return;
    const w = c.offsetWidth, h = c.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    if (!r) { setPos({ left: (vw - w) / 2, top: Math.max(12, (vh - h) / 2) }); return; }
    const below = vh - r.bottom, above = r.top;
    let top: number;
    let left = r.left + r.width / 2 - w / 2;
    if (below >= h + GAP + 12) top = r.bottom + GAP;
    else if (above >= h + GAP + 12) top = r.top - GAP - h;
    else {
      // Tall area: sit beside it.
      top = Math.min(Math.max(12, r.top), vh - h - 12);
      left = r.left - GAP - w >= 12 ? r.left - GAP - w : r.right + GAP;
    }
    setPos({ left: Math.min(Math.max(12, left), vw - w - 12), top: Math.min(Math.max(12, top), vh - h - 12) });
  }, [step]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    place_();
    next.current?.focus({ preventScroll: true });
    window.addEventListener('resize', place_);
    const t = window.setInterval(place_, 400); // panels can move while the map settles
    return () => {
      window.removeEventListener('resize', place_);
      window.clearInterval(t);
    };
  }, [open, step, place_]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') setI((n) => Math.min(steps.length - 1, n + 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      else return;
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, steps.length, close]);

  if (!open || !step) return null;
  const last = i === steps.length - 1;
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
      <div className="tour-block" />
      {box ? (
        <div className="tour-ring" style={{ left: box.left - PAD, top: box.top - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }} />
      ) : (
        <div className={`tour-dim${i > 0 && !last ? ' tour-dim--light' : ''}`} />
      )}
      <div ref={card} className="tour-card panel" style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}>
        <div className="tour-count" aria-hidden="true">{i + 1} / {steps.length}</div>
        <h3 id="tour-title">{step.title}</h3>
        <p id="tour-text">{step.text}</p>
        <div className="tour-actions">
          {!last && <button type="button" className="tour-skip" onClick={close}>Skip tour</button>}
          <span className="tour-spacer" />
          {i > 0 && <button type="button" className="btn btn--sm" onClick={() => setI(i - 1)}>Back</button>}
          {last ? (
            <>
              <button type="button" className="btn btn--sm" onClick={() => { close(); navigate(routes.learn()); }}>Start the course</button>
              <button ref={next} type="button" className="btn btn--primary btn--sm" onClick={close}>Explore the sky</button>
            </>
          ) : (
            <button ref={next} type="button" className="btn btn--primary btn--sm" onClick={() => setI(i + 1)}>{i === 0 ? 'Start' : 'Next'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
