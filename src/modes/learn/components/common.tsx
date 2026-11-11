import { useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useSettings } from '@/store/settings';
import { Button, Modal } from '@/ui';
import { DEFAULT_OBSERVER, type Constellation, type Observer } from '@/types';
import { buildFigure } from '../logic/figure';

const NAV: [string, string, boolean?][] = [
  ['/learn', 'Path', true],
  ['/learn/lessons', 'Lessons'],
  ['/learn/tonight', 'Tonight'],
  ['/learn/month', 'This month'],
  ['/learn/calendar', 'Calendar'],
  ['/learn/signposts', 'Signposts'],
  ['/learn/events', 'Events'],
  ['/learn/constellations', 'Constellations'],
  ['/learn/objects', 'Objects'],
];

export function LearnNav() {
  return (
    <nav className="ln-nav" aria-label="Learn sections">
      {NAV.map(([to, label, end]) => (
        <NavLink key={to} to={to} end={!!end} className="ln-nav-link">
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/** A reading page. `wide` drops the max width for tables and split layouts. */
export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={`ln-page${wide ? ' ln-page--wide' : ''}`}>{children}</div>;
}

export function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <div className="ln-crumbs">
      {items.map(([label, to], i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden> / </span>}
          {to ? <Link to={to}>{label}</Link> : <span>{label}</span>}
        </span>
      ))}
    </div>
  );
}

/** Text beside a sticky sky on desktop; sky above the text on a phone. */
export function Split({ sky, children }: { sky: ReactNode; children: ReactNode }) {
  return (
    <div className="ln-split">
      <div className="ln-split-sky">{sky}</div>
      <div className="ln-split-text">{children}</div>
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="ln-section">
      <div className="ln-section-head">
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const PLACES: Observer[] = [
  DEFAULT_OBSERVER,
  { name: 'Los Angeles, CA', lat: 34.05, lon: -118.24, tz: 'America/Los_Angeles' },
  { name: 'Chicago, IL', lat: 41.88, lon: -87.63, tz: 'America/Chicago' },
  { name: 'London, UK', lat: 51.51, lon: -0.13, tz: 'Europe/London' },
  { name: 'Quito, Ecuador', lat: -0.18, lon: -78.47, tz: 'America/Guayaquil' },
  { name: 'Sydney, Australia', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' },
];

/** "For Brooklyn, NY · change" with a small location picker. */
export function LocationLine({ prefix = 'For' }: { prefix?: string }) {
  const observer = useSettings((s) => s.observer);
  const setObserver = useSettings((s) => s.setObserver);
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState(String(observer.lat));
  const [lon, setLon] = useState(String(observer.lon));
  const [msg, setMsg] = useState('');
  const browserTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const pick = (o: Observer) => {
    setObserver(o);
    setOpen(false);
  };
  const custom = () => {
    const la = Number(lat), lo = Number(lon);
    if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return setMsg('Latitude must be between −90 and 90, longitude between −180 and 180.');
    pick({ name: `${Math.abs(la).toFixed(1)}°${la >= 0 ? 'N' : 'S'}, ${Math.abs(lo).toFixed(1)}°${lo >= 0 ? 'E' : 'W'}`, lat: la, lon: lo, tz: browserTz });
  };
  return (
    <span className="ln-location dim">
      {prefix} {observer.name} ·{' '}
      <button type="button" className="sky-link" onClick={() => setOpen(true)}>
        change location
      </button>
      {open && (
        <Modal title="Where are you observing from?" onClose={() => setOpen(false)}>
          <div className="stack">
            <div className="row row--wrap">
              {PLACES.map((p) => (
                <Button key={p.name} size="sm" pressed={p.name === observer.name} onClick={() => pick(p)}>
                  {p.name}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (!navigator.geolocation) return setMsg('This browser cannot share a location.');
                navigator.geolocation.getCurrentPosition(
                  (p) => pick({ name: 'My location', lat: p.coords.latitude, lon: p.coords.longitude, tz: browserTz }),
                  () => setMsg('Could not get your location. Enter it below instead.'),
                );
              }}
            >
              Use my current location
            </Button>
            <div className="row row--wrap">
              <label className="field">
                Latitude (north is positive)
                <input className="input" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
              </label>
              <label className="field">
                Longitude (east is positive)
                <input className="input" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} />
              </label>
              <Button onClick={custom}>Use these</Button>
            </div>
            <p className="dim ln-small">Times for a typed-in place are shown in this device's time zone ({browserTz}).</p>
            {msg && <p className="ln-small" role="alert">{msg}</p>}
          </div>
        </Modal>
      )}
    </span>
  );
}

/** Tiny stick figure from the catalog lines: north up, east left, as seen in the sky. */
export function ConFigure({ con, size = 72 }: { con: Constellation; size?: number }) {
  const f = useMemo(() => buildFigure(con.lines, size), [con, size]);
  return (
    <svg className="ln-figure" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <path d={f.d} fill="none" stroke="var(--vega)" strokeOpacity="0.6" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      {f.dots.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.6" fill="var(--text)" />
      ))}
    </svg>
  );
}

export function Check({ done }: { done: boolean }) {
  return (
    <span className={`ln-check${done ? ' is-done' : ''}`} aria-label={done ? 'Done' : 'Not done yet'}>
      {done ? '✓' : ''}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="ln-empty dim">{children}</p>;
}
