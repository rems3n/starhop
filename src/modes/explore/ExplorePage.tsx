import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { altAzOf, currentNightDate, getBody, visibilityOn } from '@/astro';
import { ObjectInfo } from '@/components/object';
import { asterismIdOf, visTargetOf } from '@/components/object/targets';
import { asterismById } from '@/content';
import { loadDeepDsos, useCatalog } from '@/data/catalog';
import { formatTime } from '@/lib/time';
import { SkyView, deepLimit, getSkyStats } from '@/sky';
import { registerSky } from '@/ai/bridge';
import { useSettings } from '@/store/settings';
import { BORTLE, type Highlight, type ResolvedTarget, type SkyController, type SkyEngineOptions, type TargetRef } from '@/types';
import { Button, Segmented } from '@/ui';
import { HelpPanel } from './HelpPanel';
import { Icon } from './icons';
import { LocationDialog } from './LocationDialog';
import { SearchBox, type SearchBoxHandle } from './SearchBox';
import { choosePresentation, defaultSkyTime } from './present';
import { LayersPanel, LightPollutionPanel } from './SkyPanels';
import { TimeBar, type TimeBarHandle } from './TimeBar';
import { fovWords, lookingWords } from './timeRates';
import './explore.css';

type Popover = 'layers' | 'light' | 'help' | null;
/** 'live' = the sky from your location at the map's time; 'atlas' = the whole sky as a chart, no horizon or time of day */
export type SkyMode = 'live' | 'atlas';
interface Notice { text: string; action: 'now' | 'live' }

const limitFor = (bortle: number) => BORTLE[Math.min(9, Math.max(1, bortle)) - 1].limitingMag;

/** Extra drawing for a selection the engine's own marker does not cover. */
function highlightsFor(t: ResolvedTarget): Highlight[] {
  if (t.kind === 'constellation' && t.constellation) return [{ type: 'constellation', id: t.constellation.id, lines: true, boundary: true, label: true }];
  const aid = t.kind === 'asterism' ? asterismIdOf(t.ref) : null;
  const a = aid ? asterismById.get(aid) : undefined;
  if (a) return a.lines.map((points, i) => ({ type: 'polyline' as const, points, closed: a.closed && a.lines.length === 1, label: i === 0 ? a.name : undefined }));
  return [];
}

/** Field of view to fly to: frame constellations, keep context around single objects, never zoom out for them. */
function flyFov(t: ResolvedTarget, current: number): number {
  if (t.kind === 'constellation' || t.kind === 'asterism') return t.fov ?? 60;
  return Math.min(current, Math.max(t.fov ?? 40, t.kind === 'dso' ? 20 : 40));
}

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/** Starting view, and where "Reset view" returns: facing north, horizon at the bottom, Polaris and the Dippers in frame. */
const HOME_VIEW = { mount: 'altaz' as const, lon: 0, lat: 35, fov: 100, roll: 0 };

export default function ExplorePage() {
  const catalog = useCatalog();
  const observer = useSettings((s) => s.observer);
  const bortle = useSettings((s) => s.bortle);
  const layers = useSettings((s) => s.layers);
  const setObserver = useSettings((s) => s.setObserver);
  const setBortle = useSettings((s) => s.setBortle);
  const setLayers = useSettings((s) => s.setLayers);
  const [params, setParams] = useSearchParams();
  const showFps = params.get('fps') === '1';
  const targetParam = params.get('target');
  // ?t=<ISO instant> opens the sky at that moment with the clock paused (used by "Open in Explore" from lessons).
  const timeParam = params.get('t');
  const startTime = timeParam && !isNaN(Date.parse(timeParam)) ? new Date(timeParam) : null;

  // Opened with no moment or object asked for while the Sun is up: start at tonight's dusk, where there are stars to see.
  const autoTime = useRef(!startTime && !targetParam ? defaultSkyTime(new Date(), observer) : null);

  const [ctl, setCtl] = useState<SkyController | null>(null);
  const ctlRef = useRef<SkyController | null>(null);
  const [selected, setSelected] = useState<TargetRef | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [readout, setReadout] = useState('');
  const [fps, setFps] = useState(0);
  const [popover, setPopover] = useState<Popover>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setModeState] = useState<SkyMode>('live');
  const modeRef = useRef<SkyMode>('live');
  const [notice, setNotice] = useState<Notice | null>(() => (autoTime.current ? { text: autoTime.current.message, action: 'now' } : null));
  const search = useRef<SearchBoxHandle>(null);
  const timeBar = useRef<TimeBarHandle | null>(null);
  const handledParam = useRef<string | null>(null);
  const deepTried = useRef(new Set<string>());

  // Engine options are read once; later changes go through the controller.
  const options = useRef<SkyEngineOptions>({
    observer,
    time: startTime ?? autoTime.current?.time ?? new Date(),
    timeRate: startTime ? 0 : 1,
    layers,
    limitingMag: limitFor(bortle),
    view: { ...HOME_VIEW },
    inputMode: 'navigate',
  }).current;

  const onReady = useCallback((c: SkyController) => {
    ctlRef.current = c;
    setCtl(c);
    (window as unknown as { __explore?: SkyController }).__explore = c;
  }, []);

  // Settings → engine
  useEffect(() => { ctl?.setObserver(observer); }, [ctl, observer]);
  // Still on the automatic dusk when the location changes (the first-run prompt, usually): move to that place's dusk.
  useEffect(() => {
    if (!ctl || !autoTime.current) return;
    const next = defaultSkyTime(new Date(), observer);
    if (next && next.time.getTime() === autoTime.current.time.getTime()) return;
    autoTime.current = next;
    ctl.setTime(next ? next.time : new Date());
    setNotice(next ? { text: next.message, action: 'now' } : null);
  }, [ctl, observer]);
  useEffect(() => { ctl?.setLimitingMag(limitFor(bortle)); }, [ctl, bortle]);
  // The atlas is a chart of the whole sky: nothing hides below a horizon and there is no daylight.
  useEffect(() => { ctl?.setLayers(mode === 'atlas' ? { ...layers, ground: false, atmosphere: false, horizon: false, azimuthalGrid: false } : layers); }, [ctl, layers, mode]);

  // Engine → React, coarsely: the panels only need the time to the minute, and the readout only when its words change.
  useEffect(() => {
    if (!ctl) return;
    let lastSim = ctl.getTime().getTime();
    let lastReal = 0;
    setDate(new Date(lastSim));
    const offTime = ctl.on('time', (d) => {
      const now = performance.now();
      if (Math.abs(d.getTime() - lastSim) < 60000 || now - lastReal < 400) return;
      lastSim = d.getTime();
      lastReal = now;
      setDate(d);
    });
    // Trailing update so the panel ends on the exact time after a jump or when the clock is paused.
    const tick = window.setInterval(() => {
      const t = ctl.getTime().getTime();
      if (Math.abs(t - lastSim) >= 30000) {
        lastSim = t;
        lastReal = performance.now();
        setDate(new Date(t));
      }
    }, 1000);
    let last = '';
    const showView = () => {
      const v = ctl.getView();
      let text = v.mount === 'altaz' ? `${lookingWords(v.lon, v.lat)} · ${fovWords(v.fov)}` : fovWords(v.fov);
      // zoomed in with the deep-sky layer: say how faint the stars now go (when that differs from the Bortle limit)
      const base = ctl.getLimitingMag();
      const actual = getSkyStats(ctl)?.starLimit;
      const lim = ctl.getLayers().deepSky ? deepLimit(base, v.fov) : base;
      if (lim - base >= 0.05 && !(actual !== undefined && actual < base - 0.01)) text += ` · stars to mag ${lim.toFixed(1)}`;
      if (text !== last) {
        last = text;
        setReadout(text);
      }
    };
    showView();
    const offView = ctl.on('view', showView);
    const unsubLayers = useSettings.subscribe(() => window.setTimeout(showView, 0));
    return () => {
      offTime();
      offView();
      unsubLayers();
      window.clearInterval(tick);
    };
  }, [ctl]);

  useEffect(() => {
    if (!ctl || !showFps) return;
    const id = window.setInterval(() => setFps(ctl.getFps()), 500);
    return () => window.clearInterval(id);
  }, [ctl, showFps]);

  const writeParam = useCallback((ref: string | null) => {
    handledParam.current = ref;
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (ref) next.set('target', ref);
      else next.delete('target');
      return next;
    }, { replace: true });
  }, [setParams]);

  const select = useCallback((ref: TargetRef | null, opts: { fly?: boolean; fov?: number } = {}) => {
    const c = ctlRef.current;
    if (!c || !catalog) return;
    if (!ref) {
      setSelected(null);
      c.setSelection(null);
      c.setHighlights([]);
      writeParam(null);
      setNotice(null);
      return;
    }
    const t = catalog.resolve(ref, { date: c.getTime(), observer: c.getObserver() });
    if (!t) {
      // an NGC/IC object beyond the curated list: load the full deep-sky catalogue once, then try again
      if (ref.startsWith('dso:') && !deepTried.current.has(ref)) {
        deepTried.current.add(ref);
        loadDeepDsos().then(() => select(ref, opts), () => undefined);
      }
      return;
    }
    if (t.kind === 'point') {
      // A bare direction has nothing to describe: just look there.
      void c.flyTo(t.ref);
      return;
    }
    setSelected(t.ref);
    setSheetOpen(false);
    c.setSelection(t.ref);
    c.setHighlights(highlightsFor(t));
    writeParam(t.ref);
    if (opts.fly) void c.flyTo(t.ref, { fov: opts.fov ?? flyFov(t, c.getView().fov) });
  }, [catalog, writeParam]);

  const setMode = useCallback((next: SkyMode, opts: { keepView?: boolean } = {}) => {
    const c = ctlRef.current;
    if (!c || modeRef.current === next) return;
    const size = c.getSize();
    const centre = c.unproject(size.width / 2, size.height / 2);
    modeRef.current = next;
    setModeState(next);
    setPopover(null);
    if (next === 'atlas') {
      c.setView({ mount: 'equatorial', roll: 0, ...(centre ? { lon: centre.ra, lat: centre.dec } : {}) });
      return;
    }
    setNotice(null);
    c.setView({ mount: 'altaz', roll: 0 });
    if (opts.keepView) return;
    // back under a real horizon: stay on the selection if it is up, otherwise face north
    const sel = selectedRef.current && catalog ? catalog.resolve(selectedRef.current, { date: c.getTime(), observer: c.getObserver() }) : null;
    const alt = sel ? (sel.body ? getBody(sel.body, c.getTime(), c.getObserver()).alt : altAzOf(sel.ra, sel.dec, c.getTime(), c.getObserver()).alt) : -90;
    if (sel && alt > 5) void c.flyTo(sel.ref, { durationMs: 0 });
    else void c.flyTo(`altaz:${HOME_VIEW.lon},${HOME_VIEW.lat}`, { fov: HOME_VIEW.fov, durationMs: 0 });
  }, [catalog]);

  /**
   * Show an object the learner asked for by name so that it is actually in view: the live sky if it is up in the
   * dark now, otherwise tonight at its best time, otherwise the atlas. Returns what was done.
   */
  const present = useCallback((ref: TargetRef, opts: { fov?: number } = {}): { mode: 'live' | 'time' | 'atlas'; time?: Date } => {
    const c = ctlRef.current;
    if (!c || !catalog) return { mode: 'live' };
    const t = catalog.resolve(ref, { date: c.getTime(), observer: c.getObserver() });
    if (!t || modeRef.current === 'atlas') {
      // already on the atlas (everything is visible there), or not resolvable yet: plain select
      select(ref, { fly: true, fov: opts.fov });
      return { mode: modeRef.current === 'atlas' ? 'atlas' : 'live' };
    }
    const p = choosePresentation(t, c.getTime(), c.getObserver(), catalog);
    if (p.mode === 'time') {
      autoTime.current = null;
      c.setTime(p.time);
      setNotice({ text: p.message, action: 'now' });
      // the engine needs a frame at the new time before a glide lands in the right place
      window.setTimeout(() => select(ref, { fly: true, fov: opts.fov }), 60);
      return { mode: 'time', time: p.time };
    }
    if (p.mode === 'atlas') {
      setMode('atlas');
      setNotice({ text: p.message, action: 'live' });
      window.setTimeout(() => select(ref, { fly: true, fov: opts.fov }), 30);
      return { mode: 'atlas' };
    }
    setNotice(null);
    select(ref, { fly: true, fov: opts.fov });
    return { mode: 'live' };
  }, [catalog, select, setMode]);

  const backToNow = () => {
    const c = ctlRef.current;
    if (!c) return;
    autoTime.current = null;
    c.setTime(new Date());
    c.setTimeRate(1);
    setNotice(null);
    resetRef.current();
  };

  // Clicks in the sky
  useEffect(() => {
    if (!ctl) return;
    return ctl.on('select', (hit) => select(hit ? hit.ref : null));
  }, [ctl, select]);

  // ?target=… on load and whenever another screen links here
  useEffect(() => {
    if (!ctl || !catalog || !targetParam || targetParam === handledParam.current) return;
    handledParam.current = targetParam;
    if (timeParam) select(targetParam, { fly: true });
    else present(targetParam);
  }, [ctl, catalog, targetParam, select, present, timeParam]);

  // Page-level keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || locationOpen) return;
      if (e.key === '/' && !isTyping(e.target)) {
        e.preventDefault();
        search.current?.focus();
      } else if ((e.key === 'Home' || e.key === '0') && !isTyping(e.target)) {
        e.preventDefault();
        resetRef.current();
      } else if (e.key === ' ' && !isTyping(e.target) && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement)) {
        e.preventDefault();
        timeBar.current?.togglePlay();
      } else if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.obj-lightbox')) {
        if (popover) setPopover(null);
        else if (selected && !isTyping(e.target)) select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popover, selected, select, locationOpen]);

  const face = (az: number) => {
    const c = ctlRef.current;
    if (!c) return;
    const v = c.getView();
    void c.flyTo(`altaz:${az},${Math.min(Math.max(v.mount === 'altaz' ? v.lat : 30, 15), 45)}`);
  };
  const resetView = () => {
    const c = ctlRef.current;
    if (!c) return;
    if (modeRef.current === 'atlas') {
      // atlas home: the north celestial pole region the live home view also frames
      void c.flyTo('point:ncp', { fov: HOME_VIEW.fov });
      return;
    }
    if (c.getView().mount !== 'altaz') c.setView({ mount: 'altaz', roll: 0 });
    void c.flyTo(`altaz:${HOME_VIEW.lon},${HOME_VIEW.lat}`, { fov: HOME_VIEW.fov });
  };
  const resetRef = useRef(resetView);
  resetRef.current = resetView;
  const zoom = (factor: number) => {
    const c = ctlRef.current;
    if (!c) return;
    const v = c.getView();
    const centre = c.unproject(c.getSize().width / 2, c.getSize().height / 2);
    const fov = Math.min(150, Math.max(1, v.fov * factor));
    if (centre) void c.flyTo(`radec:${centre.ra},${centre.dec}`, { fov, durationMs: 250 });
    else c.setView({ fov });
  };
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  // The assistant drives this page through the same functions as the buttons above.
  useEffect(() => {
    if (!ctl || !catalog) return;
    const openPhoto = () => { window.setTimeout(() => document.querySelector<HTMLElement>('.ex-info .obj-thumb-btn')?.click(), 700); };
    return registerSky({ ctl, select, present, openPhoto, selected: () => selectedRef.current, resetView: () => resetRef.current(), zoom: (f) => zoomRef.current(f), mode: () => modeRef.current, setMode });
  }, [ctl, catalog, select, present, setMode]);
  const toggle = (p: Exclude<Popover, null>) => setPopover((cur) => (cur === p ? null : p));

  const b = BORTLE[bortle - 1];
  return (
    <div className={`ex-root${selected ? ' has-info' : ''}${sheetOpen ? ' sheet-open' : ''}`}>
      <SkyView options={options} onReady={onReady} className="ex-sky" />

      <div className="ex-top">
        <SearchBox ref={search} catalog={catalog} onChoose={(t) => present(t.ref)} />
        <div className="ex-tools">
          <Button className="ex-tool panel" onClick={() => setLocationOpen(true)} title="Change where you are observing from" aria-label={`Location: ${observer.name}. Change`}>
            <Icon name="pin" size={16} />
            <span className="ex-tool-text">{observer.name}</span>
          </Button>
          <Button className="ex-tool panel" pressed={popover === 'layers'} aria-expanded={popover === 'layers'} onClick={() => toggle('layers')}>
            <Icon name="layers" size={16} />
            <span className="ex-tool-text">Layers</span>
          </Button>
          <Button className="ex-tool panel" pressed={popover === 'light'} aria-expanded={popover === 'light'} onClick={() => toggle('light')} title={`Light pollution: Bortle ${b.n}, ${b.label.toLowerCase()}`}>
            <Icon name="glow" size={16} />
            <span className="ex-tool-text">Bortle {b.n}<span className="ex-tool-sub"> · {b.label}</span></span>
          </Button>
        </div>
        {popover && popover !== 'help' && (
          <section className="ex-popover panel" aria-label={popover === 'layers' ? 'Layers' : 'Light pollution'}>
            <div className="panel-head">
              <h4>{popover === 'layers' ? 'Layers' : 'Light pollution'}</h4>
              <Button variant="quiet" size="sm" icon aria-label="Close" onClick={() => setPopover(null)}><Icon name="close" size={16} /></Button>
            </div>
            <div className="panel-body ex-popover-body">
              {popover === 'layers' ? <LayersPanel layers={layers} onChange={setLayers} /> : <LightPollutionPanel bortle={bortle} onBortle={setBortle} catalog={catalog} observer={observer} date={date} />}
            </div>
          </section>
        )}
      </div>

      <div className="ex-view panel" role="group" aria-label="View controls">
        <Button size="sm" icon variant="quiet" aria-label="Zoom in" title="Zoom in" onClick={() => zoom(0.6)}><Icon name="plus" size={16} /></Button>
        <Button size="sm" icon variant="quiet" aria-label="Zoom out" title="Zoom out" onClick={() => zoom(1 / 0.6)}><Icon name="minus" size={16} /></Button>
        <Button size="sm" icon variant="quiet" aria-label="Reset view: face north" title="Reset view: face north (Home key)" onClick={resetView}><Icon name="home" size={16} /></Button>
        {mode === 'live' && <span className="ex-view-sep" aria-hidden />}
        {mode === 'live' && ([['N', 0, 'north'], ['E', 90, 'east'], ['S', 180, 'south'], ['W', 270, 'west']] as const).map(([letter, az, word]) => (
          <Button key={letter} size="sm" icon variant="quiet" aria-label={`Face ${word}`} title={`Face ${word}`} onClick={() => face(az)}>{letter}</Button>
        ))}
        <span className="ex-view-sep" aria-hidden />
        <Button size="sm" icon variant="quiet" pressed={popover === 'help'} aria-expanded={popover === 'help'} aria-label="Controls help" title="Mouse, touch and keyboard controls" onClick={() => toggle('help')}>?</Button>
      </div>
      {popover === 'help' && (
        <section className="ex-helpbox panel" aria-label="Controls">
          <div className="panel-head">
            <h4>Controls</h4>
            <Button variant="quiet" size="sm" icon aria-label="Close" onClick={() => setPopover(null)}><Icon name="close" size={16} /></Button>
          </div>
          <div className="panel-body"><HelpPanel /></div>
        </section>
      )}

      {selected && catalog && ctl && (
        <aside className="ex-info panel" aria-label="Selected object">
          <div className="ex-info-bar">
            <button type="button" className="ex-info-grip" onClick={() => setSheetOpen(!sheetOpen)} aria-expanded={sheetOpen}>
              <Icon name={sheetOpen ? 'chevronDown' : 'chevronUp'} size={16} />
              {sheetOpen ? 'Show less' : 'Show details'}
            </button>
            <Button variant="quiet" size="sm" icon aria-label="Centre in the sky" title="Centre in the sky" onClick={() => select(selected, { fly: true })}><Icon name="target" size={16} /></Button>
            <Button variant="quiet" size="sm" icon aria-label="Close" title="Close (Esc)" onClick={() => select(null)}><Icon name="close" size={16} /></Button>
          </div>
          <div className="ex-info-body">
            {mode === 'live' && <BestTimeHint targetRef={selected} date={date} ctl={ctl} onShow={() => select(selected, { fly: true })} />}
            <ObjectInfo targetRef={selected} observer={observer} date={date} variant="panel" onTarget={(ref) => select(ref, { fly: true })} />
          </div>
        </aside>
      )}

      {notice && (
        <div className="ex-notice panel" role="status">
          <span>{notice.text}</span>
          <Button size="sm" variant="primary" onClick={notice.action === 'now' ? backToNow : () => setMode('live')}>{notice.action === 'now' ? 'Back to now' : 'Back to live sky'}</Button>
          <Button size="sm" variant="quiet" icon aria-label="Dismiss" onClick={() => setNotice(null)}><Icon name="close" size={14} /></Button>
        </div>
      )}

      <div className="ex-bottom">
        <div className="ex-mode">
          <Segmented<SkyMode> label="Sky map mode" value={mode} onChange={(m) => setMode(m)} options={[{ value: 'live', label: 'Live sky' }, { value: 'atlas', label: 'Atlas' }]} />
        </div>
        <p className="ex-readout" aria-live="off">
          {readout}
          {showFps && <span className="ex-fps"> · {fps.toFixed(0)} fps</span>}
        </p>
        {mode === 'live' ? <TimeBar ctl={ctl} observer={observer} handle={timeBar} /> : <p className="ex-atlas-note panel">Atlas: the whole sky as a chart. No horizon and no time of day, so everything can be found.</p>}
      </div>

      {locationOpen && <LocationDialog observer={observer} onSave={setObserver} onClose={() => setLocationOpen(false)} />}
    </div>
  );
}

/** When the selected object is below the horizon (the view then shows the ground), offer to jump to its best time tonight. */
function BestTimeHint({ targetRef, date, ctl, onShow }: { targetRef: TargetRef; date: Date; ctl: SkyController; onShow: () => void }) {
  const catalog = useCatalog();
  const observer = useSettings((s) => s.observer);
  const info = useMemo(() => {
    if (!catalog) return null;
    const t = catalog.resolve(targetRef, { date, observer });
    if (!t || t.body === 'Sun') return null;
    const alt = t.body ? getBody(t.body, date, observer).alt : altAzOf(t.ra, t.dec, date, observer).alt;
    if (alt >= 0) return null;
    const v = visibilityOn(visTargetOf(t, catalog), currentNightDate(date, observer), observer);
    return { name: t.name, best: v.bestTime };
  }, [catalog, targetRef, date, observer]);
  if (!info) return null;
  return (
    <div className="ex-hint" role="status">
      <span>{info.name} is below the horizon at this time.</span>
      {info.best && (
        <Button size="sm" onClick={() => { ctl.setTime(info.best!); window.setTimeout(onShow, 60); }}>
          Jump to {formatTime(info.best, observer.tz)}, when it is highest in the dark
        </Button>
      )}
    </div>
  );
}
