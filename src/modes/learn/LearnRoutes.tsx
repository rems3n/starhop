import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loading } from '@/ui';
import { LearnNav } from './components/common';
import './learn.css';

const Home = lazy(() => import('./pages/Home'));
const UnitPage = lazy(() => import('./pages/UnitPage'));
const LessonsIndex = lazy(() => import('./pages/LessonsIndex'));
const LessonPage = lazy(() => import('./pages/LessonPage'));
const TonightPage = lazy(() => import('./pages/TonightPage'));
const MonthPage = lazy(() => import('./pages/MonthPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const SignpostsPage = lazy(() => import('./pages/SignpostsPage'));
const SignpostPage = lazy(() => import('./pages/SignpostPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const ConstellationIndex = lazy(() => import('./pages/ConstellationIndex'));
const ConstellationPage = lazy(() => import('./pages/ConstellationPage'));
const ObjectsPage = lazy(() => import('./pages/ObjectsPage'));
const ObjectPage = lazy(() => import('./pages/ObjectPage'));

/** Mode 2 — Learn. Nested under /learn/*. See docs/LEARN.md. */
export default function LearnRoutes() {
  return (
    <div className="ln-root">
      <LearnNav />
      <Suspense fallback={<Loading label="Loading…" />}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="unit/:id" element={<UnitPage />} />
          <Route path="lessons" element={<LessonsIndex />} />
          <Route path="lesson/:id" element={<LessonPage />} />
          <Route path="tonight" element={<TonightPage />} />
          <Route path="month" element={<MonthPage />} />
          <Route path="month/:m" element={<MonthPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="signposts" element={<SignpostsPage />} />
          <Route path="signpost/:id" element={<SignpostPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="constellations" element={<ConstellationIndex />} />
          <Route path="constellation/:id" element={<ConstellationPage />} />
          <Route path="objects" element={<ObjectsPage />} />
          <Route path="object/:ref" element={<ObjectPage />} />
          <Route path="*" element={<Navigate to="/learn" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
