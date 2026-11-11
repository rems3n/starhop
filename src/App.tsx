import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSettings } from '@/store/settings';
import { Button, Loading } from '@/ui';

const ExplorePage = lazy(() => import('@/modes/explore/ExplorePage'));
const LearnRoutes = lazy(() => import('@/modes/learn/LearnRoutes'));
const QuizRoutes = lazy(() => import('@/modes/quiz/QuizRoutes'));

export default function App() {
  const redMode = useSettings((s) => s.redMode);
  const setRedMode = useSettings((s) => s.setRedMode);
  const { pathname } = useLocation();
  useEffect(() => {
    document.documentElement.dataset.red = String(redMode);
  }, [redMode]);
  const fullBleed = pathname.startsWith('/explore');
  return (
    <div className="app">
      <nav className="app-nav" aria-label="Main">
        <NavLink to="/explore" className="app-brand">
          Starhop
        </NavLink>
        <div className="app-tabs">
          <NavLink to="/explore" className="app-tab">Explore</NavLink>
          <NavLink to="/learn" className="app-tab">Learn</NavLink>
          <NavLink to="/quiz" className="app-tab">Quiz</NavLink>
          <NavLink to="/progress" className="app-tab">Progress</NavLink>
        </div>
        <div className="app-nav-right">
          <Button size="sm" variant="quiet" pressed={redMode} onClick={() => setRedMode(!redMode)} title="Red night-vision mode for use outdoors">
            <span className="app-nv-long">Night vision</span>
            <span className="app-nv-short">Red</span>
          </Button>
        </div>
      </nav>
      <main className={`app-main${fullBleed ? ' app-main--sky' : ''}`}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Navigate to="/explore" replace />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/learn/*" element={<LearnRoutes />} />
            <Route path="/quiz/*" element={<QuizRoutes />} />
            <Route path="/progress" element={<QuizRoutes progressOnly />} />
            <Route path="*" element={<Navigate to="/explore" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
