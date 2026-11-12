/** Profile: who you are signed in as, and the defaults the app starts from (location, sky map, practice). */
import { useState } from 'react';
import { useAccount, PROVIDER_LABEL } from '@/lib/account';
import { useSettings } from '@/store/settings';
import { Avatar, SignInButtons } from '@/components/account/AccountMenu';
import { LocationDialog } from '@/modes/explore/LocationDialog';
import { formatLatLon } from '@/modes/explore/cities';
import { LayersPanel } from '@/modes/explore/SkyPanels';
import { DifficultyPanel } from '@/modes/quiz/DifficultyPanel';
import { LengthPicker } from '@/modes/quiz/pages';
import { useQuizData } from '@/modes/quiz/useQuizData';
import { BORTLE } from '@/types';
import { Button } from '@/ui';
import { SyncLine } from './SyncLine';
import '@/modes/explore/explore.css';
import '@/modes/quiz/quiz.css';
import './account.css';

export default function ProfilePage() {
  const { status, user } = useAccount();
  const observer = useSettings((s) => s.observer);
  const setObserver = useSettings((s) => s.setObserver);
  const defaultLayers = useSettings((s) => s.defaultLayers);
  const setDefaultLayers = useSettings((s) => s.setDefaultLayers);
  const defaultBortle = useSettings((s) => s.defaultBortle);
  const setDefaultBortle = useSettings((s) => s.setDefaultBortle);
  const quizData = useQuizData();
  const [locOpen, setLocOpen] = useState(false);
  const signedIn = status === 'signed-in' && user;
  const b = BORTLE[defaultBortle - 1];
  return (
    <div className="page pf-page">
      <h1 className="pf-title">Profile</h1>
      <p className="dim pf-lead">The defaults Starhop starts from. {signedIn ? 'They are saved to your account and follow you to any device.' : 'They are saved in this browser.'}</p>

      <section className="card pf-card" aria-labelledby="pf-account">
        <h2 id="pf-account" className="pf-h">Account</h2>
        {signedIn ? (
          <div className="pf-who">
            <Avatar size={56} />
            <div>
              <div className="pf-name">{user.name}</div>
              {user.email && <div className="dim">{user.email}</div>}
              <div className="faint pf-small">Signed in with {PROVIDER_LABEL[user.provider]} · <SyncLine /></div>
            </div>
          </div>
        ) : (
          <div className="pf-guest">
            <p className="pf-guest-lead">You are using Starhop as a guest. Sign in to save your progress and these defaults to an account. What you have done in this browser comes with you.</p>
            <SignInButtons />
          </div>
        )}
      </section>

      <section className="card pf-card" aria-labelledby="pf-location">
        <h2 id="pf-location" className="pf-h">Location</h2>
        <div className="pf-row">
          <div>
            <div className="pf-value">{observer.name}</div>
            <div className="faint pf-small">{formatLatLon(observer.lat, observer.lon)} · {observer.tz.replace(/_/g, ' ')}</div>
            <p className="dim pf-help">Sets which stars rise for you and the times in Tonight, the sky map and the course.</p>
          </div>
          <Button onClick={() => setLocOpen(true)}>Change</Button>
        </div>
      </section>

      <section className="card pf-card" aria-labelledby="pf-sky">
        <h2 id="pf-sky" className="pf-h">Sky map defaults</h2>
        <p className="dim pf-help">The sky map opens with these each time. Changes you make on the map last for that visit, and the Layers panel there can save them as your defaults.</p>
        <label className="field pf-field">
          <span>Light pollution</span>
          <select className="select" value={defaultBortle} onChange={(e) => setDefaultBortle(Number(e.target.value))} data-testid="default-bortle">
            {BORTLE.map((x) => (
              <option key={x.n} value={x.n}>Bortle {x.n} · {x.label}</option>
            ))}
          </select>
          <span className="faint">{b.description} Stars to magnitude {b.limitingMag.toFixed(1)}.</span>
        </label>
        <div className="pf-layers">
          <div className="pf-sub">Layers</div>
          <LayersPanel layers={defaultLayers} onChange={setDefaultLayers} />
        </div>
      </section>

      <section className="card pf-card" aria-labelledby="pf-practice">
        <h2 id="pf-practice" className="pf-h">Practice defaults</h2>
        <div className="pf-row pf-row--top">
          <span className="dim">Questions per round</span>
          <LengthPicker />
        </div>
        {quizData ? <DifficultyPanel data={quizData} /> : <p className="faint">Loading…</p>}
      </section>

      {locOpen && <LocationDialog observer={observer} onSave={setObserver} onClose={() => setLocOpen(false)} />}
    </div>
  );
}
