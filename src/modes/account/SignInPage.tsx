/** Sign in or create an account: Google/GitHub buttons where set up, and an email-and-password form. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { emailAuth, useAccount, PASSWORD_MIN } from '@/lib/account';
import { routes } from '@/lib/routes';
import { SignInButtons } from '@/components/account/AccountMenu';
import { Button } from '@/ui';
import './account.css';

const safe = (r: string | null) => (r && /^\/(?![/\\])/.test(r) && !r.startsWith('/signin') ? r : routes.sky());

export default function SignInPage() {
  const { status, enabled, providers } = useAccount();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const back = safe(params.get('return'));
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (status === 'signed-in') navigate(back, { replace: true });
  }, [status, back, navigate]);
  if (status === 'loading') return null;
  if (!enabled)
    return (
      <div className="page pf-page pf-signin">
        <h1 className="pf-title">Sign in</h1>
        <p className="dim">Accounts are not switched on for this site yet. Your settings and progress are saved in this browser.</p>
      </div>
    );
  const signup = mode === 'signup';
  const oauth = providers.some((p) => p !== 'email');
  return (
    <div className="page pf-page pf-signin">
      <h1 className="pf-title">{signup ? 'Create your account' : 'Sign in'}</h1>
      <p className="dim pf-lead">Save your progress and defaults, and pick up on any device. What you have done in this browser comes with you.</p>
      <section className="card pf-card">
        {oauth && (
          <>
            <SignInButtons returnTo={back} block email={false} />
            <div className="pf-or"><span>or with email</span></div>
          </>
        )}
        <form
          className="pf-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await emailAuth(mode, { email, password, ...(signup ? { name } : {}) });
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {signup && (
            <label className="field">
              <span>Name</span>
              <input className="input" type="text" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? PASSWORD_MIN : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
            {signup && <span className="faint">At least {PASSWORD_MIN} characters. A few unrelated words works well.</span>}
          </label>
          <label className="pf-check">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
          </label>
          {error && <p className="pf-warn" role="alert">{error}</p>}
          <Button variant="primary" type="submit" disabled={busy}>{busy ? 'One moment…' : signup ? 'Create account' : 'Sign in'}</Button>
        </form>
        <p className="dim pf-switch">
          {signup ? 'Already have an account?' : 'New to Starhop?'}{' '}
          <button type="button" className="pf-linkbtn" onClick={() => { setMode(signup ? 'login' : 'signup'); setError(''); }}>{signup ? 'Sign in' : 'Create an account'}</button>
        </p>
      </section>
      <p className="faint pf-small">
        Or <Link to={back}>keep using Starhop as a guest</Link>.
      </p>
    </div>
  );
}
