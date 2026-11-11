/**
 * The sky as a dome over you, with the altitude–azimuth grid. Drawn in an oblique orthographic view from outside
 * the dome (viewer to the south-southwest, a little above the ground; north at the back, east to the right).
 * Mode "point": drag the star (or use the sliders) and read its altitude (angle up from the horizon) and azimuth
 * (compass bearing from north through east), drawn as arcs.
 * Mode "daily": a star of chosen declination follows its daily path across the dome for the learner's latitude
 * (from settings); Play turns the Earth. It is highest exactly when it crosses the meridian (north–zenith–south).
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useSettings } from '@/store/settings';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, clamp, rad, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Altitude and azimuth on the sky dome',
  summary: 'A dome over the observer with the horizon, zenith and meridian; drag a star to read its altitude and azimuth, or play a day and watch a star peak on the meridian at your latitude.',
  params: { mode: '"point" | "daily" (default "point")', alt: 'starting altitude in point mode (default 35)', az: 'starting azimuth in point mode (default 120)', dec: 'starting declination in daily mode (default 20)' },
};

type V3 = [number, number, number]; // x = east, y = north, z = up
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const W = 720, H = 400, CX = 360, CY = 268, R = 210;
const VIEW_AZ = 200, VIEW_EL = 22;
const cam: V3 = [Math.cos(rad(VIEW_EL)) * Math.sin(rad(VIEW_AZ)), Math.cos(rad(VIEW_EL)) * Math.cos(rad(VIEW_AZ)), Math.sin(rad(VIEW_EL))];
const rx: V3 = (() => {
  const v: V3 = [-cam[1], cam[0], 0];
  const l = Math.hypot(v[0], v[1]);
  return [v[0] / l, v[1] / l, 0];
})();
const ux: V3 = [cam[1] * rx[2] - cam[2] * rx[1], cam[2] * rx[0] - cam[0] * rx[2], cam[0] * rx[1] - cam[1] * rx[0]];
const hv = (alt: number, az: number): V3 => [Math.cos(rad(alt)) * Math.sin(rad(az)), Math.cos(rad(alt)) * Math.cos(rad(az)), Math.sin(rad(alt))];
const scr = (p: V3, r = R): [number, number] => [CX + r * dot(p, rx), CY - r * dot(p, ux)];
const front = (p: V3) => dot(p, cam) >= -0.02;

function unproject(X: number, Y: number): { alt: number; az: number } {
  let a = (X - CX) / R, b = (CY - Y) / R;
  const l = Math.hypot(a, b);
  if (l > 1) {
    a /= l;
    b /= l;
  }
  const w = Math.sqrt(Math.max(0, 1 - a * a - b * b));
  const base: V3 = [a * rx[0] + b * ux[0], a * rx[1] + b * ux[1], a * rx[2] + b * ux[2]];
  const f: V3 = [base[0] + w * cam[0], base[1] + w * cam[1], base[2] + w * cam[2]];
  const k: V3 = [base[0] - w * cam[0], base[1] - w * cam[1], base[2] - w * cam[2]];
  let p: V3 = f[2] >= 0 ? f : k[2] >= 0 ? k : f;
  if (p[2] < 0) p = [p[0], p[1], 0];
  const n = Math.hypot(...p) || 1;
  p = [p[0] / n, p[1] / n, p[2] / n];
  return { alt: (Math.asin(clamp(p[2], -1, 1)) * 180) / Math.PI, az: ((Math.atan2(p[0], p[1]) * 180) / Math.PI + 360) % 360 };
}

const POINTS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast', 'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
const compass = (az: number) => POINTS[Math.round(az / 22.5) % 16];

/** polyline of points, split into front (solid) and back (faint) runs */
function runs(pts: V3[]): { d: string; front: boolean }[] {
  const out: { d: string; front: boolean }[] = [];
  let cur: [number, number][] = [];
  let f = front(pts[0]);
  pts.forEach((p, i) => {
    const pf = front(p);
    if (pf !== f && cur.length) {
      cur.push(scr(p));
      out.push({ d: `M ${cur.map((q) => q.map((v) => v.toFixed(1)).join(' ')).join(' L ')}`, front: f });
      cur = [];
      f = pf;
    }
    cur.push(scr(p));
    if (i === pts.length - 1) out.push({ d: `M ${cur.map((q) => q.map((v) => v.toFixed(1)).join(' ')).join(' L ')}`, front: f });
  });
  return out;
}
const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/** alt/az of a star of declination dec at hour angle h (hours) for latitude lat */
function altaz(lat: number, dec: number, h: number) {
  const H_ = rad(h * 15), d = rad(dec), f = rad(lat);
  const alt = Math.asin(Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(H_));
  const az = Math.atan2(-Math.sin(H_) * Math.cos(d), Math.cos(f) * Math.sin(d) - Math.sin(f) * Math.cos(d) * Math.cos(H_));
  return { alt: (alt * 180) / Math.PI, az: ((az * 180) / Math.PI + 360) % 360 };
}

export default function AltAzDome({ params }: DiagramProps) {
  const daily = params?.mode === 'daily';
  const observer = useSettings((s) => s.observer);
  const reduced = usePrefersReducedMotion();
  const [alt, setAlt] = useState(typeof params?.alt === 'number' ? (params.alt as number) : 35);
  const [az, setAz] = useState(typeof params?.az === 'number' ? (params.az as number) : 120);
  const [dec, setDec] = useState(typeof params?.dec === 'number' ? (params.dec as number) : 20);
  const [hour, setHour] = useState(-4);
  const [playing, setPlaying] = useState(false);
  const dragging = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setHour((h) => (h >= 12 ? -12 : h + (reduced ? 1 : 0.1))), reduced ? 500 : 50);
    return () => clearInterval(id);
  }, [playing, reduced]);

  const lat = observer.lat;
  const minDec = Math.max(-89, lat - 89), maxDec = Math.min(89, lat + 89);
  const decC = clamp(dec, minDec, maxDec);
  const star = daily ? altaz(lat, decC, hour) : { alt, az };
  const p = hv(star.alt, star.az);
  const [sx, sy] = scr(p);
  const up = star.alt >= 0;
  const peak = 90 - Math.abs(lat - decC);
  const peakAz = decC > lat ? 0 : 180;

  const onPointer = (e: RPointerEvent<HTMLDivElement>, kind: 'down' | 'move' | 'up') => {
    if (daily) return;
    if (kind === 'up') {
      dragging.current = false;
      return;
    }
    const svg = wrap.current?.querySelector('svg');
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const X = ((e.clientX - r.left) / r.width) * W, Y = ((e.clientY - r.top) / r.height) * H;
    if (kind === 'down') {
      if (Math.hypot(X - sx, Y - sy) > 40) return;
      dragging.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
    if (!dragging.current) return;
    e.preventDefault();
    const q = unproject(X, Y);
    setAlt(Math.round(q.alt));
    setAz(Math.round(q.az) % 360);
  };

  const horizon = range(0, 360, 96).map((a) => hv(0, a));
  const silhouette = (() => {
    // upper half of the sphere's outline (great circle perpendicular to the view), above the horizon
    const pts: V3[] = [];
    for (let t = 0; t <= 360; t += 3) {
      const c = Math.cos(rad(t)), s = Math.sin(rad(t));
      const v: V3 = [c * rx[0] + s * ux[0], c * rx[1] + s * ux[1], c * rx[2] + s * ux[2]];
      if (v[2] >= 0) pts.push(v);
    }
    return pts;
  })();
  const altArc = range(0, Math.max(0, star.alt), 30).map((a) => hv(a, star.az));
  const azArc = range(0, star.az, Math.max(4, Math.round(star.az / 4))).map((a) => hv(0, a));
  const meridian = range(0, 180, 60).map((t) => hv(t <= 90 ? t : 180 - t, t <= 90 ? 0 : 180));
  const pathPts = daily ? range(-12, 12, 192).map((h) => altaz(lat, decC, h)) : [];

  const ptsAbove = (arr: { alt: number; az: number }[]) => {
    // split at horizon crossings into runs above the horizon
    const segs: V3[][] = [];
    let cur: V3[] = [];
    for (const q of arr) {
      if (q.alt >= 0) cur.push(hv(q.alt, q.az));
      else if (cur.length) {
        segs.push(cur);
        cur = [];
      }
    }
    if (cur.length) segs.push(cur);
    return segs;
  };

  return (
    <div ref={wrap} onPointerDown={(e) => onPointer(e, 'down')} onPointerMove={(e) => onPointer(e, 'move')} onPointerUp={(e) => onPointer(e, 'up')} style={{ touchAction: daily ? undefined : 'pan-y' }}>
      <Svg w={W} h={H} title={meta.title} desc="A transparent dome over a small figure standing at its centre. The horizon is the rim, the zenith the top. A star on the dome has an altitude arc rising from the horizon to it, and an azimuth arc running along the horizon from north to below it. The meridian runs from north through the zenith to south.">
        {/* ground disc */}
        <path d={`M ${horizon.map((q) => scr(q).map((v) => v.toFixed(1)).join(' ')).join(' L ')} Z`} fill="#141a33" stroke={C.lineStrong} strokeWidth={1.5} />
        {/* altitude circles and azimuth lines (back half faint) */}
        {[30, 60].map((a) =>
          runs(range(0, 360, 96).map((t) => hv(a, t))).map((r, i) => <path key={`${a}-${i}`} d={r.d} fill="none" stroke={C.line} strokeDasharray="3 4" opacity={r.front ? 1 : 0.5} />),
        )}
        {[45, 90, 135, 225, 270, 315].map((t) =>
          runs(range(0, 90, 30).map((a) => hv(a, t))).map((r, i) => <path key={`v${t}-${i}`} d={r.d} fill="none" stroke={C.line} opacity={r.front ? 0.8 : 0.4} />),
        )}
        {/* meridian */}
        {runs(meridian).map((r, i) => (
          <path key={`m${i}`} d={r.d} fill="none" stroke={C.blue} strokeWidth={daily ? 2.2 : 1.4} opacity={r.front ? 0.9 : 0.5} />
        ))}
        {/* dome outline */}
        <path d={`M ${silhouette.map((q) => scr(q).map((v) => v.toFixed(1)).join(' ')).join(' L ')}`} fill="none" stroke={C.lineStrong} strokeWidth={1.5} />
        {/* compass points */}
        {[
          [0, 'N'],
          [90, 'E'],
          [180, 'S'],
          [270, 'W'],
        ].map(([a, t]) => {
          const [x, y] = scr(hv(0, a as number), R + 22);
          return (
            <Label key={t as string} x={x} y={y + 5} anchor="middle" weight={700} color={t === 'N' ? C.amber : C.text}>
              {t as string}
            </Label>
          );
        })}
        {/* zenith */}
        <circle cx={scr([0, 0, 1])[0]} cy={scr([0, 0, 1])[1]} r={3.5} fill={C.text} />
        <Label x={scr([0, 0, 1])[0] + 8} y={scr([0, 0, 1])[1] - 8} size="s" color={C.dim}>
          zenith, 90°
        </Label>
        <Label x={scr(hv(40, 180))[0] + 8} y={scr(hv(40, 180))[1] + 4} size="s" color={C.blue}>
          meridian
        </Label>
        {/* daily path */}
        {daily &&
          ptsAbove(pathPts).flatMap((seg, i) =>
            seg.length > 1
              ? runs(seg).map((r, j) => <path key={`p${i}-${j}`} d={r.d} fill="none" stroke={C.amber} strokeWidth={r.front ? 2 : 1.2} strokeDasharray="5 4" opacity={r.front ? 0.9 : 0.4} />)
              : [],
          )}
        {/* observer */}
        <g>
          <circle cx={CX} cy={CY - 22} r={6} fill={C.moon} />
          <line x1={CX} y1={CY - 16} x2={CX} y2={CY} stroke={C.moon} strokeWidth={3} strokeLinecap="round" />
          <Label x={CX + 10} y={CY + 18} size="s" color={C.dim}>
            you
          </Label>
        </g>
        {/* arcs */}
        {up && (
          <>
            <path d={`M ${azArc.map((q) => scr(q, R * 0.999).map((v) => v.toFixed(1)).join(' ')).join(' L ')}`} fill="none" stroke={C.amber} strokeWidth={3} opacity={0.85} />
            <path d={`M ${altArc.map((q) => scr(q).map((v) => v.toFixed(1)).join(' ')).join(' L ')}`} fill="none" stroke={C.good} strokeWidth={3} />
            <line x1={CX} y1={CY - 22} x2={sx} y2={sy} stroke={C.text} strokeOpacity={0.35} strokeDasharray="3 4" />
            {(() => {
              const [ax, ay] = scr(hv(Math.max(4, star.alt / 2), star.az));
              const [bx, by] = scr(hv(0, star.az / 2), R + 6);
              return (
                <>
                  <Label x={ax + 10} y={ay + 4} color={C.good} weight={700}>
                    {`altitude ${Math.round(star.alt)}°`}
                  </Label>
                  <Label x={bx} y={by + (dot(hv(0, star.az / 2), cam) > 0 ? 26 : -10)} anchor="middle" color={C.amber} weight={700}>
                    {`azimuth ${Math.round(star.az)}°`}
                  </Label>
                </>
              );
            })()}
          </>
        )}
        {/* star */}
        <circle cx={sx} cy={sy} r={up ? 9 : 6} fill={up ? C.star : C.faint} stroke={C.amber} strokeWidth={daily ? 0 : 2} opacity={up ? 1 : 0.5} style={{ cursor: daily ? undefined : 'grab' }} />
        {!daily && (
          <Label x={sx + 14} y={sy - 10} size="s" color={C.dim}>
            drag me
          </Label>
        )}
        <Label x={20} y={30} size="s" color={C.dim}>
          {daily ? `latitude ${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'} (${observer.name})` : 'the sky as a dome over you'}
        </Label>
      </Svg>
      <Controls>
        {daily ? (
          <>
            <RangeControl label="Star's declination" value={decC} min={Math.ceil(minDec)} max={Math.floor(maxDec)} step={1} onChange={setDec} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}°`} />
            <RangeControl label="Time from crossing the meridian" value={Math.round(hour * 4) / 4} min={-12} max={12} step={0.25} onChange={(v) => { setPlaying(false); setHour(v); }} format={(v) => (Math.abs(v) < 0.13 ? 'now crossing' : `${Math.abs(v).toFixed(1)} h ${v < 0 ? 'before' : 'after'}`)} />
            <PlayButton playing={playing} onToggle={() => setPlaying((v) => !v)} label="Turn the Earth" />
          </>
        ) : (
          <>
            <RangeControl label="Altitude" value={alt} min={0} max={90} step={1} onChange={setAlt} format={(v) => `${v}°`} />
            <RangeControl label="Azimuth" value={az} min={0} max={359} step={1} onChange={setAz} format={(v) => `${v}°`} />
          </>
        )}
      </Controls>
      <Readout>
        {daily
          ? !up
            ? `The star is below your horizon right now. ${peak > 0 ? `It will peak ${Math.round(peak)}° up when it crosses the meridian.` : 'From your latitude a star this far south never rises.'}`
            : Math.abs(hour) < 0.13
              ? `Crossing the meridian: the star is at its highest, ${Math.round(star.alt)}° up, due ${peakAz === 0 ? 'north' : 'south'}${peak > 89 ? ' (overhead)' : ''}. This is the best moment to look at it.`
              : `${Math.abs(hour).toFixed(1)} hours ${hour < 0 ? 'before' : 'after'} crossing the meridian: altitude ${Math.round(star.alt)}°, azimuth ${Math.round(star.az)}° (${compass(star.az)}), ${hour < 0 ? 'still climbing' : 'sinking'}. Its highest will be ${Math.round(peak)}° on the meridian.`
          : `Altitude ${Math.round(alt)}° (${alt >= 89 ? 'straight overhead' : `about ${Math.round(alt / 10)} fist${Math.round(alt / 10) === 1 ? '' : 's'} up from the horizon`}), azimuth ${Math.round(az)}° (${compass(az)}). Face ${compass(az)}, then look ${Math.round(alt)}° up.`}
      </Readout>
    </div>
  );
}
