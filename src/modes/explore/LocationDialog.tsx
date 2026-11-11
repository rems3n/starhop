import { useMemo, useState } from 'react';
import type { Observer } from '@/types';
import { Button, Modal } from '@/ui';
import { CITIES, cityToObserver, formatLatLon, parseManualLocation, searchCities } from './cities';
import './explore.css';

/** Extra content when the dialog is the first-run location prompt. */
export interface FirstRunOptions {
  title: string;
  intro: string;
  keepLabel: string;
  onKeep: () => void;
}

function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function timeZoneNames(): string[] {
  const f = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  try {
    return f ? f('timeZone') : [];
  } catch {
    return [];
  }
}

export function LocationDialog({ observer, onSave, onClose, firstRun }: { observer: Observer; onSave: (o: Observer) => void; onClose: () => void; firstRun?: FirstRunOptions }) {
  const [q, setQ] = useState('');
  const [geo, setGeo] = useState<{ state: 'idle' | 'asking' | 'error'; message?: string }>({ state: 'idle' });
  const [manual, setManual] = useState({ name: '', lat: observer.lat.toFixed(4), lon: observer.lon.toFixed(4), tz: observer.tz });
  const [error, setError] = useState<string | null>(null);
  const matches = useMemo(() => searchCities(q), [q]);
  const zones = useMemo(timeZoneNames, []);

  const save = (o: Observer) => {
    onSave(o);
    onClose();
  };

  const useMine = () => {
    if (!('geolocation' in navigator)) {
      setGeo({ state: 'error', message: 'This browser cannot share a location. Pick a city or type coordinates instead.' });
      return;
    }
    setGeo({ state: 'asking' });
    navigator.geolocation.getCurrentPosition(
      (pos) => save({ name: 'My location', lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4), tz: browserTz(), elevationM: pos.coords.altitude != null ? Math.round(pos.coords.altitude) : undefined }),
      (err) => setGeo({ state: 'error', message: err.code === err.PERMISSION_DENIED ? 'Location permission was not given. Pick a city or type coordinates instead.' : 'Could not get your location. Pick a city or type coordinates instead.' }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseManualLocation(manual);
    if ('error' in r) setError(r.error);
    else save(r.observer);
  };

  return (
    <Modal title={firstRun?.title ?? 'Where are you observing from?'} onClose={onClose}>
      <div className="ex-loc">
        {firstRun && <p className="st-first-intro">{firstRun.intro}</p>}
        {!firstRun && <p className="dim ex-loc-current">
          Now set to <strong>{observer.name}</strong> ({formatLatLon(observer.lat, observer.lon)}, {observer.tz.replace(/_/g, ' ')}). Your latitude decides which stars you can see; your time zone is used to show local times.
        </p>}
        <div className="row row--wrap">
          <Button variant="primary" onClick={useMine} disabled={geo.state === 'asking'}>{geo.state === 'asking' ? 'Finding you…' : 'Use my location'}</Button>
          {firstRun && <Button onClick={() => { firstRun.onKeep(); onClose(); }} title={`${formatLatLon(observer.lat, observer.lon)}, ${observer.tz.replace(/_/g, ' ')}`}>{firstRun.keepLabel}</Button>}
          {geo.state === 'error' && <span className="ex-loc-error" role="alert">{geo.message}</span>}
        </div>

        <section>
          <h5 className="ex-h5">Pick a city</h5>
          <input className="input" type="search" placeholder={`Search ${CITIES.length} cities`} aria-label="Search cities" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          <ul className="ex-loc-list" aria-label="Cities">
            {matches.map((city) => {
              const current = Math.abs(city.lat - observer.lat) < 0.01 && Math.abs(city.lon - observer.lon) < 0.01;
              return (
                <li key={`${city.name}|${city.country}`}>
                  <button type="button" className={`ex-loc-city${current ? ' is-current' : ''}`} onClick={() => save(cityToObserver(city))} aria-current={current || undefined}>
                    <span className="ex-loc-name">{city.name}</span>
                    <span className="ex-loc-country">{city.country}</span>
                    <span className="ex-loc-lat">{Math.abs(city.lat).toFixed(0)}° {city.lat >= 0 ? 'N' : 'S'}</span>
                  </button>
                </li>
              );
            })}
            {matches.length === 0 && <li className="ex-loc-none dim">No city in the list matches. Type the coordinates below instead.</li>}
          </ul>
        </section>

        <form onSubmit={submitManual} noValidate>
          <h5 className="ex-h5">Or type it in</h5>
          <div className="ex-loc-grid">
            <label className="field">Latitude (north is positive)
              <input className="input" inputMode="decimal" value={manual.lat} onChange={(e) => setManual({ ...manual, lat: e.target.value })} />
            </label>
            <label className="field">Longitude (east is positive)
              <input className="input" inputMode="decimal" value={manual.lon} onChange={(e) => setManual({ ...manual, lon: e.target.value })} />
            </label>
            <label className="field">Time zone
              <input className="input" list="ex-tz-list" value={manual.tz} onChange={(e) => setManual({ ...manual, tz: e.target.value })} spellCheck={false} />
              <datalist id="ex-tz-list">{zones.map((z) => <option key={z} value={z} />)}</datalist>
            </label>
            <label className="field">Name (optional)
              <input className="input" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="My back yard" />
            </label>
          </div>
          {error && <p className="ex-loc-error" role="alert">{error}</p>}
          <div className="row ex-loc-actions">
            <Button type="submit">Use these coordinates</Button>
            <Button variant="quiet" onClick={() => setManual({ ...manual, tz: browserTz() })}>Use this device's time zone</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
