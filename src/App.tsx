import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Redirect } from '@/lib/redirect';
import { useSettings } from '@/store/settings';
import { routes } from '@/lib/routes';
import { Loading } from '@/ui';
import { SettingsMenu } from '@/components/settings/SettingsMenu';
import { FirstRunLocation } from '@/components/settings/FirstRunLocation';
import { ChatLauncher } from '@/components/chat/ChatLauncher';
import { AccountMenu } from '@/components/account/AccountMenu';

const HomePage = lazy(() => import('@/modes/home/HomePage'));
const ExplorePage = lazy(() => import('@/modes/explore/ExplorePage'));
const TonightRoutes = lazy(() => import('@/modes/tonight/TonightRoutes'));
const LearnRoutes = lazy(() => import('@/modes/learn/LearnRoutes'));
const LibraryRoutes = lazy(() => import('@/modes/library/LibraryRoutes'));
const QuizRoutes = lazy(() => import('@/modes/quiz/QuizRoutes'));
const ProfilePage = lazy(() => import('@/modes/account/ProfilePage'));
const SettingsPage = lazy(() => import('@/modes/account/SettingsPage'));
const SignInPage = lazy(() => import('@/modes/account/SignInPage'));

const p = (s: string | undefined) => s ?? '';
const quizRedirect = (splat: string) => (splat.startsWith('unit/') ? routes.practice() : `${routes.practice()}${splat ? `/${splat}` : ''}`);

const ICONS: Record<string, ReactNode> = {
  sky: <path d="M12 2.5 14.2 9l6.8.2-5.4 4.1 2 6.6L12 16l-5.6 3.9 2-6.6L3 9.2 9.8 9z" />,
  tonight: <path d="M14.5 3a8.5 8.5 0 1 0 6.4 13.9A7 7 0 0 1 14.5 3z" />,
  learn: <path d="M12 4 1.5 9 12 14l8.5-4v6H22V9zM6 13.2v3.6c0 1.6 2.7 3.2 6 3.2s6-1.6 6-3.2v-3.6l-6 2.9z" />,
  library: <path d="M4 3h4v18H4zM9.5 3h4v18h-4zM15.2 4.1l3.8-1 4 17.3-3.8 1z" />,
  practice: <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />,
};
const TABS: [string, string, string][] = [
  ['sky', routes.sky(), 'Sky'],
  ['tonight', routes.tonight(), 'Tonight'],
  ['learn', routes.learn(), 'Learn'],
  ['library', routes.library(), 'Library'],
  ['practice', routes.practice(), 'Practice'],
];

/** Pages whose content depends on the learner's location get the first-run prompt. */
const LOCATION_PAGES = ['/sky', '/tonight', '/learn'];

export default function App() {
  const redMode = useSettings((s) => s.redMode);
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [signinNotice, setSigninNotice] = useState('');
  // The server sends a failed or unavailable sign-in back as ?signin=…: say so once, then tidy the address.
  useEffect(() => {
    const q = new URLSearchParams(search);
    const r = q.get('signin');
    if (!r) return;
    setSigninNotice(r === 'unavailable' ? 'Signing in is not available on this site yet.' : 'Sign-in did not finish. Please try again.');
    q.delete('signin');
    navigate({ pathname, search: q.toString() ? `?${q}` : '' }, { replace: true });
  }, [search, pathname, navigate]);
  useEffect(() => {
    document.documentElement.dataset.red = String(redMode);
  }, [redMode]);
  const fullBleed = pathname.startsWith('/sky');
  const needsLocation = LOCATION_PAGES.some((x) => pathname === x || pathname.startsWith(`${x}/`));
  if (pathname === '/')
    return (
      <Suspense fallback={<Loading />}>
        <HomePage />
      </Suspense>
    );
  return (
    <div className={`app${fullBleed ? ' app--sky' : ''}`}>
      <nav className="app-nav" aria-label="Main">
        <NavLink to={routes.sky()} className="app-brand" title="Starhop sky map">
          Starhop
        </NavLink>
        <div className="app-tabs">
          {TABS.map(([key, to, label]) => (
            <NavLink key={key} to={to} className="app-tab">
              <svg className="app-tab-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
                {ICONS[key]}
              </svg>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
        <div className="app-nav-right app-settings">
          <SettingsMenu />
          <AccountMenu />
        </div>
      </nav>
      <main className={`app-main${fullBleed ? ' app-main--sky' : ''}`}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/sky" element={<ExplorePage />} />
            <Route path="/tonight/*" element={<TonightRoutes />} />
            <Route path="/learn/*" element={<LearnRoutes />} />
            <Route path="/library/*" element={<LibraryRoutes />} />
            <Route path="/practice/*" element={<QuizRoutes />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/signin" element={<SignInPage />} />
            {/* Old routes (v1) */}
            <Route path="/explore" element={<Redirect to={() => routes.sky()} />} />
            <Route path="/quiz/*" element={<Redirect to={(x) => quizRedirect(p(x['*']))} />} />
            <Route path="/progress" element={<Redirect to={() => routes.progress()} />} />
            <Route path="*" element={<Navigate to={routes.sky()} replace />} />
          </Routes>
        </Suspense>
      </main>
      <ChatLauncher sky={fullBleed} />
      {signinNotice && (
        <div className="app-toast panel" role="status">
          <span>{signinNotice}</span>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setSigninNotice('')}>Dismiss</button>
        </div>
      )}
      {needsLocation && <FirstRunLocation />}
    </div>
  );
}
