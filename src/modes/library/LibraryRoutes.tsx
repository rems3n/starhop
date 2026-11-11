import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { Loading } from '@/ui';
import { LibraryNav } from './components/common';
import '@/modes/learn/learn.css';
import './library.css';

const Home = lazy(() => import('./pages/LibraryHome'));
const Constellations = lazy(() => import('./pages/ConstellationsList'));
const ConstellationDetail = lazy(() => import('./pages/ConstellationDetail'));
const Myths = lazy(() => import('./pages/MythsList'));
const Myth = lazy(() => import('./pages/MythPage'));
const Starhops = lazy(() => import('./pages/StarhopsList'));
const Starhop = lazy(() => import('./pages/StarhopPage'));
const Asterisms = lazy(() => import('./pages/AsterismsList'));
const Asterism = lazy(() => import('./pages/AsterismPage'));
const Stars = lazy(() => import('./pages/StarsList'));
const Objects = lazy(() => import('./pages/ObjectsList'));
const ObjectDetail = lazy(() => import('./pages/ObjectDetail'));
const Planets = lazy(() => import('./pages/PlanetsPage'));

/** Library: reference collections with search, filters and detail pages. Nested under /library/*. */
export default function LibraryRoutes() {
  return (
    <div className="lb-root">
      <LibraryNav />
      <Suspense fallback={<Loading label="Loading…" />}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="constellations" element={<Constellations />} />
          <Route path="constellation/:id" element={<ConstellationDetail />} />
          <Route path="myths" element={<Myths />} />
          <Route path="myth/:storyId" element={<Myth />} />
          <Route path="starhops" element={<Starhops />} />
          <Route path="starhop/:id" element={<Starhop />} />
          <Route path="asterisms" element={<Asterisms />} />
          <Route path="asterism/:id" element={<Asterism />} />
          <Route path="stars" element={<Stars />} />
          <Route path="objects" element={<Objects />} />
          <Route path="object/:ref" element={<ObjectDetail />} />
          <Route path="planets" element={<Planets />} />
          <Route path="*" element={<Navigate to={routes.library()} replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
