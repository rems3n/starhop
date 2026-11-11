import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { routes } from '@/lib/routes';
import type { TargetRef } from '@/types';

const NAV: [string, string, boolean?][] = [
  [routes.library(), 'Overview', true],
  [routes.constellations(), 'Constellations'],
  [routes.myths(), 'Myths'],
  [routes.starhops(), 'Star-hops'],
  [routes.asterisms(), 'Asterisms'],
  [routes.stars(), 'Stars'],
  [routes.objects(), 'Deep sky'],
  [routes.planets(), 'Planets'],
];

export function LibraryNav() {
  return (
    <nav className="lb-nav" aria-label="Library collections">
      {NAV.map(([to, label, end]) => (
        <NavLink key={to} to={to} end={!!end} className="lb-nav-link">
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function ListHead({ title, lede, aside }: { title: string; lede: ReactNode; aside?: ReactNode }) {
  return (
    <header className="lb-head">
      <h1>{title}</h1>
      <p className="lb-lede">{lede}</p>
      {aside}
    </header>
  );
}

/** Library page for a sky reference: constellations, asterisms and everything else. */
export function refHref(ref: TargetRef): string {
  if (ref.startsWith('con:')) return routes.constellation(ref.slice(4));
  if (ref.startsWith('asterism:')) return routes.asterism(ref.slice(9));
  return routes.object(ref);
}

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** [12,1,2] → "Dec–Feb"; [3,4,7] → "Mar–Apr, Jul"; [] → "" */
export function shortMonths(months: number[]): string {
  const set = new Set(months);
  if (!set.size) return '';
  if (set.size === 12) return 'All year';
  const starts = [...set].filter((m) => !set.has(m === 1 ? 12 : m - 1)).sort((a, b) => a - b);
  return starts
    .map((s) => {
      let e = s;
      while (set.has(e === 12 ? 1 : e + 1)) e = e === 12 ? 1 : e + 1;
      return s === e ? MONTH_SHORT[s - 1] : `${MONTH_SHORT[s - 1]}–${MONTH_SHORT[e - 1]}`;
    })
    .join(', ');
}

/** Strip the inline [[ref|label]] and *emphasis* markup for previews. */
export function plain(text: string): string {
  return text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
}
