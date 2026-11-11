/**
 * Embedded sky map with its own compact controls (owner: sky-embed engineer; see docs/briefs/v2.md).
 * Every sky view except the full Sky page uses this instead of <SkyView>. The props contract is FIXED.
 *
 * - The page drives the sky through the controller it gets from `onReady` (a thin wrapper of the engine's).
 *   Whatever the page last set (layers, faintest stars, view) is what "Reset" returns to; a page that re-applies
 *   its scene always wins over the learner's embed choices.
 * - Embed choices are per view: they are never written to the global settings store.
 * - On Reset the root element dispatches a bubbling `SKY_EMBED_RESET_EVENT` so a page can re-apply anything
 *   else it owns (time, highlights, its own UI state).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { getBody } from '@/astro';
import { loadFaintStars, useCatalog } from '@/data/catalog';
import { routes } from '@/lib/routes';
import { aboutCount, countStarsUp, skyBrightness } from '@/modes/explore/skyCount';
import { SkyView } from '@/sky';
import { BORTLE, type FaintStars, type LayerState, type SkyController, type SkyEngineOptions, type TargetRef } from '@/types';
import { Slider, Switch } from '@/ui';
import { applyBaseline, readBaseline, trackPageController, type PageTracker } from './controller';
import { bortleForMag, filterPatch, magForBortle, radecRef, visibleLayerGroups, zoomFov } from './layers';
import './sky-embed.css';

export interface SkyEmbedProps {
  options: SkyEngineOptions;
  onReady?: (c: SkyController) => void;
  className?: string;
  style?: CSSProperties;
  /**
   * 'full'    = layer toggles, light-pollution slider, reset, "open in the sky map" (lessons, library, tonight)
   * 'limited' = only the layers listed in `allowedLayers` (quizzes, governed by difficulty)
   * 'none'    = no controls
   */
  controls?: 'full' | 'limited' | 'none';
  allowedLayers?: (keyof LayerState)[];
  /** What "Open in the sky map" should centre on (defaults to the view centre) */
  openTarget?: TargetRef;
  /** Called after the user changes a layer/limiting magnitude through the embed controls */
  onUserChange?: (change: { layers?: Partial<LayerState>; limitingMag?: number }) => void;
}

/** Dispatched (bubbling) on the embed's root element after the learner presses Reset. */
export const SKY_EMBED_RESET_EVENT = 'skyembed:reset';

export function SkyEmbed({ options, onReady, className, style, controls = 'full', allowedLayers, openTarget, onUserChange }: SkyEmbedProps) {
  const [ctl, setCtl] = useState<SkyController | null>(null);
  const [pageRev, setPageRev] = useState(0);
  const tracker = useRef<PageTracker | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const handleReady = useCallback((c: SkyController) => {
    const t: PageTracker = { baseline: readBaseline(c), onPageChange: () => setPageRev((r) => r + 1) };
    tracker.current = t;
    setCtl(c);
    onReadyRef.current?.(trackPageController(c, t));
  }, []);

  const rootCls = ['sky-embed', className].filter(Boolean).join(' ');
  return (
    <div className={rootCls} style={style} data-controls={controls}>
      <SkyView options={options} onReady={handleReady} />
      {ctl && controls !== 'none' && (
        <EmbedControls ctl={ctl} tracker={tracker} pageRev={pageRev} controls={controls} allowedLayers={allowedLayers} openTarget={openTarget} onUserChange={onUserChange} />
      )}
    </div>
  );
}

interface ControlsProps {
  ctl: SkyController;
  tracker: { current: PageTracker | null };
  pageRev: number;
  controls: 'full' | 'limited';
  allowedLayers?: (keyof LayerState)[];
  openTarget?: TargetRef;
  onUserChange?: SkyEmbedProps['onUserChange'];
}

function EmbedControls({ ctl, tracker, pageRev, controls, allowedLayers, openTarget, onUserChange }: ControlsProps) {
  const [open, setOpen] = useState(false);
  const [layers, setLayers] = useState<LayerState>(() => ctl.getLayers());
  const [mag, setMag] = useState(() => ctl.getLimitingMag());
  const [openHref, setOpenHref] = useState(() => routes.sky(openTarget));
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const groups = useMemo(() => visibleLayerGroups(controls, allowedLayers), [controls, allowedLayers]);
  const full = controls === 'full';

  // read what the page set whenever the panel opens, and while it is open when the page changes the scene
  useEffect(() => {
    if (!open) return;
    setLayers(ctl.getLayers());
    setMag(ctl.getLimitingMag());
  }, [open, pageRev, ctl]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  }, []);

  // focus into the panel on open; Escape closes from anywhere while open
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>('input, button:not(.se-close)');
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const toggle = (key: keyof LayerState, v: boolean) => {
    const patch = filterPatch({ [key]: v }, controls, allowedLayers);
    if (!Object.keys(patch).length) return;
    ctl.setLayers(patch);
    setLayers((l) => ({ ...l, ...patch }));
    onUserChange?.({ layers: patch });
  };
  const setBortle = (n: number) => {
    const m = magForBortle(n);
    ctl.setLimitingMag(m);
    setMag(m);
    onUserChange?.({ limitingMag: m });
  };
  const zoom = (dir: 'in' | 'out') => ctl.setView({ fov: zoomFov(ctl.getView().fov, dir) });
  const reset = (e: MouseEvent<HTMLButtonElement>) => {
    const b = tracker.current?.baseline;
    if (!b) return;
    const root = e.currentTarget.closest('.sky-embed');
    if (controls === 'full') applyBaseline(ctl, b);
    else {
      // limited: only touch what the learner could change, plus the camera
      ctl.setLayers(filterPatch(b.layers, controls, allowedLayers));
      ctl.setView(b.view);
    }
    setLayers(ctl.getLayers());
    setMag(ctl.getLimitingMag());
    onUserChange?.(controls === 'full' ? { layers: b.layers, limitingMag: b.limitingMag } : { layers: filterPatch(b.layers, controls, allowedLayers) });
    root?.dispatchEvent(new CustomEvent(SKY_EMBED_RESET_EVENT, { bubbles: true }));
  };
  const refreshHref = () => {
    let ref = openTarget;
    if (!ref) {
      const { width, height } = ctl.getSize();
      const c = ctl.unproject(width / 2, height / 2);
      if (c) ref = radecRef(c.ra, c.dec);
    }
    setOpenHref(routes.sky(ref, ctl.getTime()));
  };

  return (
    <>
      <div className="se-bar" role="toolbar" aria-label="Sky view controls" aria-orientation="vertical">
        {groups.length > 0 || full ? (
          <button
            ref={btnRef}
            type="button"
            className="se-btn se-btn--layers"
            aria-expanded={open}
            aria-controls={panelId}
            title={full ? 'Layers and light pollution' : 'Layers'}
            onClick={() => (open ? close() : setOpen(true))}
          >
            <Icon d={P.layers} />
            <span className="se-btn-text">Layers</span>
          </button>
        ) : null}
        <div className="se-zoom">
          <button type="button" className="se-btn" aria-label="Zoom in" title="Zoom in" onClick={() => zoom('in')}>
            <Icon d={P.plus} />
          </button>
          <button type="button" className="se-btn" aria-label="Zoom out" title="Zoom out" onClick={() => zoom('out')}>
            <Icon d={P.minus} />
          </button>
        </div>
        <button type="button" className="se-btn" aria-label="Reset" title="Reset: put the sky back the way this page set it up" onClick={reset}>
          <Icon d={P.reset} />
        </button>
        {full && (
          <Link className="se-btn" to={openHref} aria-label="Open in sky map" title="Open in sky map" onPointerEnter={refreshHref} onPointerDown={refreshHref} onFocus={refreshHref}>
            <Icon d={P.open} />
          </Link>
        )}
      </div>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="se-panel panel"
          role="dialog"
          aria-modal="false"
          aria-label={full ? 'Layers and light pollution' : 'Layers'}
        >
          <div className="se-panel-head">
            <strong>Layers</strong>
            <button type="button" className="se-btn se-close" aria-label="Close" onClick={() => close()}>
              <Icon d={P.close} />
            </button>
          </div>
          <div className="se-panel-body">
            {groups.length === 0 && <p className="faint se-empty">No layers can be changed here.</p>}
            <div className="se-groups">
              {groups.map((g) => (
                <fieldset key={g.title} className="se-group">
                  <legend>{g.title}</legend>
                  {g.items.map((it) => (
                    <Switch key={it.key} label={it.label} checked={layers[it.key]} onChange={(v) => toggle(it.key, v)} />
                  ))}
                </fieldset>
              ))}
            </div>
            {full && <LightPollution ctl={ctl} mag={mag} onBortle={setBortle} />}
          </div>
        </div>
      )}
    </>
  );
}

function LightPollution({ ctl, mag, onBortle }: { ctl: SkyController; mag: number; onBortle: (n: number) => void }) {
  const catalog = useCatalog();
  const bortle = bortleForMag(mag);
  const b = BORTLE[bortle - 1];
  const [faint, setFaint] = useState<FaintStars | null>(null);
  useEffect(() => {
    if (mag <= 6.5 || faint) return;
    let live = true;
    loadFaintStars().then((f) => live && f && setFaint(f), () => undefined);
    return () => {
      live = false;
    };
  }, [mag, faint]);
  // the time and place of this view, read once per panel opening
  const [when] = useState(() => ({ date: ctl.getTime(), observer: ctl.getObserver() }));
  const count = useMemo(() => (catalog ? countStarsUp(catalog.stars, faint, mag, when.date, when.observer) : null), [catalog, faint, mag, when]);
  const day = useMemo(() => skyBrightness(getBody('Sun', when.date, when.observer).alt) === 'day', [when]);
  return (
    <fieldset className="se-group se-light">
      <legend>Light pollution</legend>
      <div className="se-light-head">
        <span className="se-light-class">Bortle {b.n}</span>
        <span className="se-light-label">{b.label}</span>
      </div>
      <Slider label="Light pollution, Bortle class 1 (darkest) to 9 (inner city)" min={1} max={9} value={bortle} onChange={onBortle} />
      <div className="se-light-ends" aria-hidden>
        <span>1 · darkest</span>
        <span>9 · inner city</span>
      </div>
      <p className="se-light-count" aria-live="polite">
        {count == null ? (
          'Counting stars…'
        ) : (
          <>
            <strong>{aboutCount(count)} stars</strong> above the horizon are this bright{day ? ' (once it is dark)' : ''}.
          </>
        )}{' '}
        <span className="faint">Faintest star: magnitude {mag.toFixed(1)}.</span>
      </p>
    </fieldset>
  );
}

const P = {
  layers: 'M12 3 2.5 8.2 12 13.4l9.5-5.2zM4.6 11.6 2.5 12.8 12 18l9.5-5.2-2.1-1.2L12 15.7zM4.6 16.2 2.5 17.4 12 22.6l9.5-5.2-2.1-1.2-7.4 4.1z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  minus: 'M5 11h14v2H5z',
  close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z',
  reset: 'M12 4a8 8 0 1 1-7.4 5h2.2A6 6 0 1 0 12 6v3L7.5 5 12 1z',
  open: 'M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14zM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
};

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d={d} />
    </svg>
  );
}

export { quizAllowedLayers } from './layers';
