import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Redirect } from '@/lib/redirect';
import { routes } from '@/lib/routes';
import { Loading } from '@/ui';
import './learn.css';

const Home = lazy(() => import('./pages/Home'));
const ModulePage = lazy(() => import('./pages/ModulePage'));
const LessonPage = lazy(() => import('./pages/LessonPage'));

const p = (s: string | undefined) => s ?? '';

/** Learn = the course only. Nested under /learn/*. Old v1 Learn routes redirect to their new sections. See docs/LEARN.md. */
export default function LearnRoutes() {
  return (
    <div className="ln-root">
      <Suspense fallback={<Loading label="Loading…" />}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="module/:id" element={<ModulePage />} />
          <Route path="lesson/:id" element={<LessonPage />} />
          {/* v1 routes */}
          <Route path="lessons" element={<Redirect to={() => routes.learn()} />} />
          <Route path="unit/:id" element={<Redirect to={() => routes.learn()} />} />
          <Route path="tonight" element={<Redirect to={() => routes.tonight()} />} />
          <Route path="month" element={<Redirect to={() => routes.month()} />} />
          <Route path="month/:m" element={<Redirect to={(x) => routes.month(Number(x.m) || undefined)} />} />
          <Route path="calendar" element={<Redirect to={() => routes.calendar()} />} />
          <Route path="events" element={<Redirect to={() => routes.events()} />} />
          <Route path="constellations" element={<Redirect to={() => routes.constellations()} />} />
          <Route path="constellation/:id" element={<Redirect to={(x) => routes.constellation(p(x.id))} />} />
          <Route path="objects" element={<Redirect to={() => routes.objects()} />} />
          <Route path="object/:ref" element={<Redirect to={(x) => routes.object(p(x.ref))} />} />
          <Route path="signposts" element={<Redirect to={() => routes.asterisms()} />} />
          <Route path="signpost/:id" element={<Redirect to={(x) => routes.asterism(p(x.id))} />} />
          <Route path="*" element={<Navigate to={routes.learn()} replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
