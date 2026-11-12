/** Settings: display, account, and the learner's data (download, reset, delete). */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteAccount, exportData, resetProgress, signOut, useAccount, PROVIDER_LABEL } from '@/lib/account';
import { routes } from '@/lib/routes';
import { useSettings } from '@/store/settings';
import { SignInButtons } from '@/components/account/AccountMenu';
import { Button, Switch } from '@/ui';
import { SyncLine } from './SyncLine';
import './account.css';

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A destructive button that asks again in place instead of a browser dialog. */
function Confirm({ label, confirmLabel, onConfirm, testId }: { label: string; confirmLabel: string; onConfirm: () => Promise<void> | void; testId: string }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!asking) return <Button onClick={() => setAsking(true)} data-testid={testId}>{label}</Button>;
  return (
    <span className="pf-confirm">
      <Button
        className="pf-danger"
        disabled={busy}
        data-testid={`${testId}-confirm`}
        onClick={async () => {
          setBusy(true);
          setErr('');
          try { await onConfirm(); setAsking(false); } catch { setErr('That did not work. Try again in a moment.'); } finally { setBusy(false); }
        }}
      >
        {confirmLabel}
      </Button>
      <Button variant="quiet" onClick={() => setAsking(false)}>Cancel</Button>
      {err && <span className="pf-warn">{err}</span>}
    </span>
  );
}

export default function SettingsPage() {
  const { status, user } = useAccount();
  const redMode = useSettings((s) => s.redMode);
  const setRedMode = useSettings((s) => s.setRedMode);
  const navigate = useNavigate();
  const [done, setDone] = useState('');
  const signedIn = status === 'signed-in' && user;
  return (
    <div className="page pf-page">
      <h1 className="pf-title">Settings</h1>
      <p className="dim pf-lead">
        Your location and the defaults for the sky map and practice are on your <Link to={routes.profile()}>profile</Link>.
      </p>

      <section className="card pf-card" aria-labelledby="st-display">
        <h2 id="st-display" className="pf-h">Display</h2>
        <Switch checked={redMode} onChange={setRedMode} label="Night vision" />
        <p className="dim pf-help">Turns the screen red so your eyes stay dark-adapted outdoors.</p>
      </section>

      <section className="card pf-card" aria-labelledby="st-account">
        <h2 id="st-account" className="pf-h">Account</h2>
        {signedIn ? (
          <>
            <div className="pf-row">
              <div>
                <div className="pf-value">{user.name}</div>
                <div className="faint pf-small">{user.email ? `${user.email} · ` : ''}Signed in with {PROVIDER_LABEL[user.provider]}</div>
                <div className="faint pf-small"><SyncLine /></div>
              </div>
              <Button onClick={() => { void signOut(); navigate(routes.sky()); }}>Sign out</Button>
            </div>
            <p className="dim pf-help">Signing out clears your data from this browser. It stays in your account.</p>
          </>
        ) : (
          <>
            <p className="dim pf-help pf-help--top">You are using Starhop as a guest: everything is saved in this browser only.</p>
            <SignInButtons />
          </>
        )}
      </section>

      <section className="card pf-card" aria-labelledby="st-data">
        <h2 id="st-data" className="pf-h">Your data</h2>
        <div className="pf-row">
          <div>
            <div className="pf-value">Download your data</div>
            <p className="dim pf-help">Your settings, defaults and learning progress as a JSON file.</p>
          </div>
          <Button onClick={() => download(`starhop-${new Date().toISOString().slice(0, 10)}.json`, exportData())}>Download</Button>
        </div>
        <div className="pf-row">
          <div>
            <div className="pf-value">Reset learning progress</div>
            <p className="dim pf-help">Clears quiz history, review schedule, finished lessons and pages seen{signedIn ? ', on every device' : ''}. Your settings stay.</p>
          </div>
          <Confirm label="Reset" confirmLabel="Reset all progress" testId="reset-progress" onConfirm={() => { resetProgress(); setDone('Progress reset.'); }} />
        </div>
        {signedIn && (
          <div className="pf-row">
            <div>
              <div className="pf-value">Delete account</div>
              <p className="dim pf-help">Removes your account and everything saved to it. This cannot be undone.</p>
            </div>
            <Confirm label="Delete account" confirmLabel="Delete my account" testId="delete-account" onConfirm={async () => { await deleteAccount(); navigate(routes.sky()); }} />
          </div>
        )}
        {done && <p className="pf-ok" role="status">{done}</p>}
      </section>
    </div>
  );
}
