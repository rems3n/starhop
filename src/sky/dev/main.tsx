/** Dev harness for the sky engine: /sky-dev.html. Not part of the app bundle. */
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/figtree';
import '@/styles/tokens.css';
import { BORTLE, DEFAULT_LAYERS, DEFAULT_OBSERVER, type Highlight, type LayerState, type SkyController, type SkyEngineOptions } from '@/types';
import { SkyView, getSkyStats } from '../index';

(globalThis as { __SKY_DEBUG__?: boolean }).__SKY_DEBUG__ = true;

// The Vite dev server answers a missing optional data file (e.g. images.json before it is built) with
// index.html and status 200, which the catalog loader then fails to parse. Harness-only guard: treat an
// HTML answer to a data/*.json request as "not found".
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await realFetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/data\/[\w-]+\.json/.test(url) && (res.headers.get('content-type') ?? '').includes('text/html')) return new Response('', { status: 404 });
  return res;
};

const OPTIONS: SkyEngineOptions = {
  observer: DEFAULT_OBSERVER,
  time: new Date('2026-11-10T02:00:00Z'),
  timeRate: 0,
  limitingMag: 6.0,
  view: { mount: 'altaz', lon: 180, lat: 30, fov: 100 },
  inputMode: 'navigate',
};

export const SAMPLE_HIGHLIGHTS: Highlight[] = [
  { type: 'constellation', id: 'Ori', lines: true, boundary: true, label: true },
  { type: 'object', ref: 'star:Aldebaran', label: true },
  { type: 'object', ref: 'dso:M45', label: 'Pleiades', color: '#9cc0ff' },
  { type: 'polyline', points: ['star:Capella', 'star:Aldebaran', 'star:Rigel', 'star:Sirius', 'star:Procyon', 'star:Pollux'], closed: true, dashed: true, label: 'Winter Hexagon' },
  { type: 'angle', from: 'star:Betelgeuse', to: 'star:Rigel' },
  { type: 'angle', from: 'star:Castor', to: 'star:Pollux', label: 'about a thumb' },
  { type: 'circle', center: 'star:Polaris', radiusDeg: 10, label: '10° circle' },
  { type: 'label', at: 'altaz:120,60', text: 'A free label' },
  { type: 'trail', ref: 'body:Mars', from: '2026-10-01T00:00:00Z', to: '2027-06-01T00:00:00Z', stepHours: 24, frame: 'stars', dateLabels: true, color: '#ff8f80' },
  { type: 'trail', ref: 'star:Sirius', from: '2026-11-10T00:00:00Z', to: '2026-11-10T12:00:00Z', stepHours: 1, frame: 'horizon', dateLabels: true, color: '#7fd6a4' },
];

const LAYER_KEYS = Object.keys(DEFAULT_LAYERS) as (keyof LayerState)[];

function Harness() {
  const ctl = useRef<SkyController | null>(null);
  const [layers, setLayers] = useState<LayerState>({ ...DEFAULT_LAYERS });
  const [mag, setMag] = useState(6.0);
  const [rate, setRate] = useState(0);
  const [mount, setMount] = useState<'altaz' | 'equatorial'>('altaz');
  const [lasso, setLasso] = useState(false);
  const [info, setInfo] = useState('');
  const [picked, setPicked] = useState('');
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      const c = ctl.current;
      if (!c) return;
      const s = getSkyStats(c);
      const v = c.getView();
      setInfo(`${c.getFps().toFixed(0)} fps · ${s?.drawCalls ?? 0} draws · ${s?.vertices ?? 0} verts · ${(s?.lastFrameMs ?? 0).toFixed(2)} ms · fov ${v.fov.toFixed(1)}° · ${c.getTime().toISOString().slice(0, 19)}Z`);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const onReady = (c: SkyController) => {
    ctl.current = c;
    const w = window as unknown as { __sky?: SkyController; __skyReady?: number; __skyEvents?: unknown[]; __skyStats?: () => unknown; __SAMPLE?: Highlight[] };
    w.__sky = c;
    w.__skyReady = (w.__skyReady ?? 0) + 1;
    w.__skyEvents = [];
    w.__skyStats = () => getSkyStats(c);
    w.__SAMPLE = SAMPLE_HIGHLIGHTS;
    c.on('select', (p) => {
      setPicked(p ? `${p.name} (${p.ref})` : 'empty sky');
      w.__skyEvents!.push({ type: 'select', p });
    });
    c.on('lasso', (pts) => {
      setPicked(`lasso with ${pts.length} points`);
      w.__skyEvents!.push({ type: 'lasso', n: pts.length, pts });
    });
  };
  const c = () => ctl.current;
  const btn = { font: '500 12px var(--font-ui)', background: 'var(--night-700)', color: 'var(--text)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' } as const;

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <SkyView options={OPTIONS} onReady={onReady} />
      <div id="strip" style={{ position: 'absolute', left: 8, top: 8, maxWidth: 'min(340px, calc(100vw - 16px))', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, padding: 10, font: '400 12px var(--font-ui)', color: 'var(--text-dim)', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={btn} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Controls'}</button>
          <span id="fps" style={{ fontVariantNumeric: 'tabular-nums' }}>{info}</span>
        </div>
        {open && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
              {LAYER_KEYS.map((k) => (
                <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={layers[k]} onChange={(e) => { const n = { ...layers, [k]: e.target.checked }; setLayers(n); c()?.setLayers({ [k]: e.target.checked }); }} />
                  {k}
                </label>
              ))}
            </div>
            <label>
              Limiting magnitude {mag.toFixed(1)} (Bortle {BORTLE.reduce((a, b) => (Math.abs(b.limitingMag - mag) < Math.abs(a.limitingMag - mag) ? b : a)).n})
              <input type="range" min={3.5} max={7.6} step={0.1} value={mag} style={{ width: '100%' }} onChange={(e) => { const v = Number(e.target.value); setMag(v); c()?.setLimitingMag(v); }} />
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              Time rate
              {[-3600, 0, 1, 60, 600, 3600].map((r) => (
                <button key={r} style={{ ...btn, borderColor: r === rate ? 'var(--amber)' : 'var(--line-strong)' }} onClick={() => { setRate(r); c()?.setTimeRate(r); }}>{r}×</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button style={btn} onClick={() => { const m = mount === 'altaz' ? 'equatorial' : 'altaz'; setMount(m); c()?.setView({ mount: m }); }}>Mount: {mount}</button>
              <button style={btn} onClick={() => c()?.setView({ roll: (c()!.getView().roll + 20) % 360 })}>Roll +20°</button>
              <button style={{ ...btn, borderColor: lasso ? 'var(--amber)' : 'var(--line-strong)' }} onClick={() => { setLasso(!lasso); c()?.setInputMode(lasso ? 'navigate' : 'lasso'); if (lasso) c()?.clearLasso(); }}>Lasso {lasso ? 'on' : 'off'}</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button style={btn} onClick={() => c()?.flyTo('con:Ori', { fov: 40 })}>Orion</button>
              <button style={btn} onClick={() => c()?.flyTo('star:Polaris', { fov: 50 })}>Polaris</button>
              <button style={btn} onClick={() => c()?.flyTo('dso:M31', { fov: 12 })}>M31</button>
              <button style={btn} onClick={() => c()?.flyTo('body:Jupiter', { fov: 30 })}>Jupiter</button>
              <button style={btn} onClick={() => c()?.setHighlights(SAMPLE_HIGHLIGHTS)}>Sample highlights</button>
              <button style={btn} onClick={() => c()?.setHighlights([])}>Clear</button>
            </div>
            <div id="picked">{picked || 'Click the sky to pick an object'}</div>
          </>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
