/** Header settings: where you observe from (LocationDialog) and night vision. On phones it sits top-right. */
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/store/settings';
import { LocationDialog } from '@/modes/explore/LocationDialog';
import { formatLatLon } from '@/modes/explore/cities';
import { Switch } from '@/ui';
import './settings.css';

const PIN = 'M12 2.5a6.5 6.5 0 0 1 6.5 6.5c0 4.6-6.5 12.5-6.5 12.5S5.5 13.6 5.5 9A6.5 6.5 0 0 1 12 2.5zm0 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z';

export function SettingsMenu() {
  const observer = useSettings((s) => s.observer);
  const setObserver = useSettings((s) => s.setObserver);
  const redMode = useSettings((s) => s.redMode);
  const setRedMode = useSettings((s) => s.setRedMode);
  const [open, setOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
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
  return (
    <div className="st-menu" ref={ref}>
      <button type="button" className="st-trigger" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)} title="Location and display settings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false"><path d={PIN} /></svg>
        <span className="st-trigger-name">{observer.name}</span>
        {redMode && <span className="st-trigger-red" aria-label="Night vision on" />}
      </button>
      {open && (
        <div className="panel st-pop" role="dialog" aria-label="Settings">
          <div className="st-row">
            <div>
              <div className="st-label">Observing from</div>
              <div className="st-value">{observer.name}</div>
              <div className="st-sub dim">{formatLatLon(observer.lat, observer.lon)} · {observer.tz.replace(/_/g, ' ')}</div>
            </div>
            <button type="button" className="btn btn--sm" onClick={() => { setOpen(false); setLocOpen(true); }}>Change</button>
          </div>
          <div className="st-row">
            <div>
              <Switch checked={redMode} onChange={setRedMode} label="Night vision" />
              <div className="st-sub dim">Turns the screen red so your eyes stay dark-adapted outdoors.</div>
            </div>
          </div>
        </div>
      )}
      {locOpen && <LocationDialog observer={observer} onSave={setObserver} onClose={() => setLocOpen(false)} />}
    </div>
  );
}
