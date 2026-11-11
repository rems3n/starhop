/** Tonight section: what's up tonight, monthly guides, the visibility calendar and the year's events (pages live in Learn's pages folder). */
import { lazy, Suspense } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { Loading } from '@/ui';
import '@/modes/learn/learn.css';

const TonightPage = lazy(() => import('./pages').then((m) => ({ default: m.TonightPage })));
const MonthPage = lazy(() => import('./pages').then((m) => ({ default: m.MonthPage })));
const CalendarPage = lazy(() => import('./pages').then((m) => ({ default: m.CalendarPage })));
const EventsPage = lazy(() => import('./pages').then((m) => ({ default: m.EventsPage })));

const NAV: [string, string, boolean?][] = [
  [routes.tonight(), 'Tonight', true],
  [routes.month(), 'This month'],
  [routes.calendar(), 'Calendar'],
  [routes.events(), 'Events'],
];

export default function TonightRoutes() {
  return (
    <div className="ln-root">
      <nav className="ln-nav" aria-label="Tonight sections">
        {NAV.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={!!end} className="ln-nav-link">
            {label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<Loading label="Loading…" />}>
        <Routes>
          <Route index element={<TonightPage />} />
          <Route path="month" element={<MonthPage />} />
          <Route path="month/:m" element={<MonthPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="*" element={<Navigate to={routes.tonight()} replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
