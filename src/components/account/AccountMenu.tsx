/** Header account button: "Sign in" for guests, the learner's avatar when signed in. Opens Profile, Settings, sign-in/out. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { currentPath, signInUrl, signOut, useAccount, PROVIDER_LABEL, type OAuthProvider } from '@/lib/account';
import './account.css';

export function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  if (provider === 'google')
    return (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    );
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden focusable="false">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** "Continue with Google" / "Continue with GitHub" / "Continue with email", or a note when accounts are not switched on. */
export function SignInButtons({ returnTo, block, onPick, email = true }: { returnTo?: string; block?: boolean; onPick?: () => void; email?: boolean }) {
  const { enabled, providers, status } = useAccount();
  if (status === 'loading') return null;
  if (!enabled || !providers.length) return <p className="faint ac-note">Accounts are not switched on for this site yet. Your settings and progress are saved in this browser.</p>;
  return (
    <div className={`ac-signin${block ? ' ac-signin--block' : ''}`}>
      {providers.filter((p): p is OAuthProvider => p !== 'email').map((p) => (
        <a key={p} className="btn ac-provider" href={signInUrl(p, returnTo)}>
          <ProviderIcon provider={p} />
          Continue with {PROVIDER_LABEL[p]}
        </a>
      ))}
      {email && providers.includes('email') && (
        <Link className="btn ac-provider ac-provider--email" to={routes.signin(returnTo ?? currentPath())} onClick={onPick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 8.2L4.6 7H4v.9l8 6.6 8-6.6V7h-.6z" /></svg>
          Continue with email
        </Link>
      )}
    </div>
  );
}

export function Avatar({ size = 28 }: { size?: number }) {
  const user = useAccount((s) => s.user);
  const [broken, setBroken] = useState(false);
  if (user?.avatar && !broken) return <img className="ac-avatar" src={user.avatar} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  const initial = (user?.name ?? '').trim().charAt(0).toUpperCase();
  return (
    <span className="ac-avatar ac-avatar--blank" style={{ width: size, height: size, fontSize: size * 0.46 }} aria-hidden>
      {initial || (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" /></svg>
      )}
    </span>
  );
}

export function AccountMenu() {
  const { status, user } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const signedIn = status === 'signed-in' && user;
  const close = () => setOpen(false);
  return (
    <div className="ac-menu" ref={ref}>
      <button
        type="button"
        className={`ac-trigger${signedIn ? ' ac-trigger--user' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={signedIn ? `Account: ${user.name}` : 'Sign in, profile and settings'}
        onClick={() => setOpen(!open)}
      >
        <Avatar size={signedIn ? 30 : 22} />
        {!signedIn && <span className="ac-trigger-label">Sign in</span>}
      </button>
      {open && (
        <div className="panel ac-pop" role="dialog" aria-label="Account">
          {signedIn ? (
            <div className="ac-who">
              <Avatar size={40} />
              <div className="ac-who-text">
                <div className="ac-name">{user.name}</div>
                {user.email && <div className="faint ac-email">{user.email}</div>}
              </div>
            </div>
          ) : (
            <div className="ac-guest">
              <p className="ac-guest-lead">Sign in to save your progress and settings, and pick up on any device.</p>
              <SignInButtons block onPick={close} />
            </div>
          )}
          <nav className="ac-links" aria-label="Account pages">
            <Link to={routes.profile()} onClick={close}>Profile and defaults</Link>
            <Link to={routes.settings()} onClick={close}>Settings</Link>
          </nav>
          {signedIn && (
            <button type="button" className="btn btn--quiet btn--sm ac-signout" onClick={() => { close(); void signOut(); }}>
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
