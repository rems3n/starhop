import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDate, formatTime, zonedParts, zonedToUtc } from '@/lib/time';
import type { Observer, SkyController } from '@/types';
import { Button } from '@/ui';
import { Icon } from './icons';
import { STEP_UNITS, canStepRate, fromLocalInputValue, rateShort, rateWords, stepRate, stepTime, toLocalInputValue, type StepUnit } from './timeRates';

export interface TimeBarHandle { togglePlay(): void }

interface Props {
  ctl: SkyController | null;
  observer: Observer;
  /** Lets the page bind the space bar */
  handle?: React.MutableRefObject<TimeBarHandle | null>;
}

const UNIT_KEY = 'starhop.explore.stepUnit';

export function TimeBar({ ctl, observer, handle }: Props) {
  const tz = observer.tz;
  const [label, setLabel] = useState<{ date: string; time: string }>({ date: '', time: '' });
  const [rate, setRate] = useState(1);
  const [paused, setPaused] = useState(false);
  const [unit, setUnit] = useState<StepUnit>(() => {
    try {
      const u = localStorage.getItem(UNIT_KEY);
      return STEP_UNITS.some((x) => x.value === u) ? (u as StepUnit) : 'hour';
    } catch {
      return 'hour';
    }
  });
  const [picker, setPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState('');
  const [more, setMore] = useState(false);
  const last = useRef('');
  const wrap = useRef<HTMLDivElement>(null);

  // The engine reports time at ~10 Hz while the clock runs; React only re-renders when the shown minute changes.
  const show = useCallback((d: Date) => {
    const next = { date: formatDate(d, tz), time: formatTime(d, tz) };
    const key = `${next.date}|${next.time}`;
    if (key !== last.current) {
      last.current = key;
      setLabel(next);
    }
  }, [tz]);

  useEffect(() => {
    if (!ctl) return;
    show(ctl.getTime());
    const off = ctl.on('time', show);
    // Real time moves the label once a minute even if the engine is idle between frames.
    // The same tick keeps the buttons honest if something else (a deep link, a test) changed the engine's rate.
    const id = window.setInterval(() => {
      show(ctl.getTime());
      const r = ctl.getTimeRate();
      setPaused(r === 0);
      if (r !== 0) setRate(r);
    }, 1000);
    return () => {
      off();
      window.clearInterval(id);
    };
  }, [ctl, show]);

  const apply = useCallback((nextRate: number, nextPaused: boolean) => {
    setRate(nextRate);
    setPaused(nextPaused);
    ctl?.setTimeRate(nextPaused ? 0 : nextRate);
  }, [ctl]);

  const jump = useCallback((d: Date) => {
    if (!ctl) return;
    ctl.setTime(d);
    show(d);
  }, [ctl, show]);

  const togglePlay = useCallback(() => apply(rate, !paused), [apply, rate, paused]);
  useEffect(() => {
    if (!handle) return;
    handle.current = { togglePlay };
    return () => { handle.current = null; };
  }, [handle, togglePlay]);

  const step = (dir: 1 | -1) => ctl && jump(stepTime(ctl.getTime(), unit, dir, tz));
  const chooseUnit = (u: StepUnit) => {
    setUnit(u);
    try { localStorage.setItem(UNIT_KEY, u); } catch { /* private mode */ }
  };
  const openPicker = () => {
    if (!ctl) return;
    setPickerValue(toLocalInputValue(ctl.getTime(), tz));
    setPicker((p) => !p);
  };
  const tonightAt = (hour: number) => {
    const p = zonedParts(new Date(), tz);
    const d = zonedToUtc(p.year, p.month, p.day, hour, 0, tz);
    jump(d);
    setPickerValue(toLocalInputValue(d, tz));
  };

  useEffect(() => {
    if (!picker) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setPicker(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicker(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [picker]);

  const unitLabel = STEP_UNITS.find((u) => u.value === unit)!;
  const shownRate = paused ? 0 : rate;

  return (
    <div className={`ex-time panel${more ? ' is-more' : ''}`} ref={wrap} role="group" aria-label="Time controls">
      {picker && (
        <div className="ex-time-picker panel" role="dialog" aria-label="Jump to a date and time">
          <label className="field">
            Date and time in {observer.name} ({tz.replace(/_/g, ' ')})
            <input
              className="input"
              type="datetime-local"
              value={pickerValue}
              onChange={(e) => {
                setPickerValue(e.target.value);
                const d = fromLocalInputValue(e.target.value, tz);
                if (d) jump(d);
              }}
            />
          </label>
          <div className="row row--wrap">
            <Button size="sm" onClick={() => tonightAt(21)}>Tonight at 9 pm</Button>
            <Button size="sm" onClick={() => tonightAt(5)}>This morning at 5 am</Button>
            <Button size="sm" variant="quiet" onClick={() => setPicker(false)}>Done</Button>
          </div>
        </div>
      )}
      <div className="ex-time-main">
        <button type="button" className="ex-time-clock" onClick={openPicker} aria-expanded={picker} title="Jump to a date and time">
          <span className="ex-time-hm">{label.time || '—'}</span>
          <span className="ex-time-date">{label.date}</span>
        </button>
        <div className="ex-time-group">
          <Button size="sm" icon variant="quiet" aria-label={`Back one ${unitLabel.label.toLowerCase()}`} title={`Back one ${unitLabel.label.toLowerCase()}`} onClick={() => step(-1)}><Icon name="stepBack" /></Button>
          <Button icon variant={paused ? 'primary' : 'default'} aria-label={paused ? 'Play' : 'Pause'} title={paused ? 'Play (space)' : 'Pause (space)'} onClick={togglePlay}><Icon name={paused ? 'play' : 'pause'} /></Button>
          <Button size="sm" icon variant="quiet" aria-label={`Forward one ${unitLabel.label.toLowerCase()}`} title={`Forward one ${unitLabel.label.toLowerCase()}`} onClick={() => step(1)}><Icon name="stepForward" /></Button>
        </div>
        <Button className="ex-time-more" size="sm" variant="quiet" pressed={more} aria-label={more ? 'Fewer time controls' : 'More time controls'} onClick={() => setMore(!more)}>
          <span className="ex-time-more-rate">{rateShort(shownRate)}</span>
          <Icon name={more ? 'chevronDown' : 'chevronUp'} size={16} />
        </Button>
      </div>
      <div className="ex-time-extra">
        <label className="ex-time-unit">
          <span className="sr-only">Step size</span>
          <span className="ex-time-unit-pre" aria-hidden>Step</span>
          <select className="select" value={unit} onChange={(e) => chooseUnit(e.target.value as StepUnit)} title={unitLabel.hint}>
            {STEP_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </label>
        <div className="ex-time-group">
          <Button size="sm" icon variant="quiet" aria-label="Slower, or backwards" title="Slower, or backwards" disabled={!canStepRate(rate, -1)} onClick={() => apply(stepRate(rate, -1), false)}><Icon name="slower" /></Button>
          <span className="ex-time-rate" aria-live="polite">{rateWords(shownRate)}</span>
          <Button size="sm" icon variant="quiet" aria-label="Faster" title="Faster" disabled={!canStepRate(rate, 1)} onClick={() => apply(stepRate(rate, 1), false)}><Icon name="faster" /></Button>
        </div>
        <Button size="sm" onClick={() => { jump(new Date()); apply(1, false); }} title="Back to the present, running in real time">Now</Button>
      </div>
    </div>
  );
}
