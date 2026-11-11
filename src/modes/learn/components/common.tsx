import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '@/store/settings';
import { LocationDialog } from '@/modes/explore/LocationDialog';
import type { Constellation } from '@/types';
import { buildFigure } from '../logic/figure';

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

/** "For <place> · change location", opening the shared location dialog. */
export function LocationLine({ prefix = 'For' }: { prefix?: string }) {
  const observer = useSettings((s) => s.observer);
  const setObserver = useSettings((s) => s.setObserver);
  const [open, setOpen] = useState(false);
  return (
    <span className="ln-location dim">
      {prefix} {observer.name} ·{' '}
      <button type="button" className="sky-link" onClick={() => setOpen(true)}>
        change location
      </button>
      {open && <LocationDialog observer={observer} onSave={setObserver} onClose={() => setOpen(false)} />}
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
