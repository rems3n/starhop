/**
 * A star-hop, one step at a time, on a small chart drawn from real catalog positions (stereographic, north up,
 * east left, as on a printed sky chart). Step 1: the stars you start from. Step 2: the direction (a line or an arc).
 * Step 3: the distance, marked off in fists of 10°. Step 4: the target, and how to be sure you have it.
 * Hops: "pointers" (Big Dipper → Polaris), "arcturus" (handle → Arcturus → Spica), "belt" (Orion's Belt →
 * Sirius and → Aldebaran), "triangle" (Betelgeuse + Sirius → Procyon). Background stars come from the catalog.
 */
import { useMemo, useState } from 'react';
import { useCatalog } from '@/data/catalog';
import { C, Controls, Label, Readout, Step, Svg, rad, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'A star-hop, step by step',
  summary: 'A small chart from real star positions; step through start, direction, distance in fists and arrival for a chosen hop.',
  params: { hop: '"pointers" | "arcturus" | "belt" | "triangle" (default "pointers")' },
};

type V3 = [number, number, number];
const vec = (ra: number, dec: number): V3 => [Math.cos(rad(dec)) * Math.cos(rad(ra)), Math.cos(rad(dec)) * Math.sin(rad(ra)), Math.sin(rad(dec))];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const sepDeg = (a: V3, b: V3) => (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;
/** Point `deg` along the great circle from a toward b (can go past b). */
function along(a: V3, b: V3, deg: number): V3 {
  const d = dot(a, b);
  const u = norm([b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]]);
  const t = rad(deg);
  return [Math.cos(t) * a[0] + Math.sin(t) * u[0], Math.cos(t) * a[1] + Math.sin(t) * u[1], Math.cos(t) * a[2] + Math.sin(t) * u[2]];
}

// [ra°, dec°, mag, tint] from public/data/stars.json (HYG, J2000); tint marks an obvious colour
type Tint = 'orange' | 'blue' | undefined;
const S: Record<string, [number, number, number, Tint?]> = {
  Dubhe: [165.93233, 61.75103, 1.81, 'orange'], Merak: [165.46016, 56.38243, 2.34], Phecda: [178.45752, 53.69476, 2.41], Megrez: [183.85629, 57.03262, 3.32],
  Alioth: [193.50708, 55.95982, 1.76], Mizar: [200.98121, 54.92536, 2.23], Alkaid: [206.88531, 49.31327, 1.85], Polaris: [37.94625, 89.26411, 1.97],
  Arcturus: [213.91545, 19.18241, -0.05, 'orange'], Spica: [201.29825, -11.16132, 0.98, 'blue'],
  Betelgeuse: [88.79294, 7.40706, 0.45, 'orange'], Rigel: [78.63447, -8.20164, 0.18, 'blue'], Bellatrix: [81.28277, 6.3497, 1.64], Saiph: [86.93912, -9.66961, 2.07],
  Alnitak: [85.1897, -1.94257, 1.74], Alnilam: [84.05339, -1.20192, 1.69], Mintaka: [83.00168, -0.29909, 2.25], Meissa: [83.78449, 9.93416, 3.39],
  Sirius: [101.28722, -16.71612, -1.44], Aldebaran: [68.98016, 16.5093, 0.87, 'orange'], Procyon: [114.8255, 5.22499, 0.4], Pleiades: [56.8692, 24.1053, 1.6],
};
const V = (n: string) => vec(S[n][0], S[n][1]);

interface Hop {
  label: string;
  frame: string[];
  figures: string[][];
  start: string[];
  /** Path pieces as lists of unit vectors (each drawn as a polyline) */
  path: () => V3[][];
  /** Fist ticks: [from star, toward star, total degrees] */
  fists: [string, string, number][];
  targets: string[];
  /** One name for a tight group of starting stars (instead of labelling each) */
  startLabel?: string;
  /** Turn the chart counterclockwise by this many degrees to fit a tall hop into the wide frame */
  rotate?: number;
  steps: [string, string, string, string];
}

const line = (a: string, b: string, deg: number, n = 40) => Array.from({ length: n + 1 }, (_, i) => along(V(a), V(b), (deg * i) / n));

const HOPS: Record<string, Hop> = {
  pointers: {
    label: 'Pointers to Polaris',
    frame: ['Dubhe', 'Merak', 'Phecda', 'Megrez', 'Alioth', 'Mizar', 'Alkaid', 'Polaris'],
    figures: [['Alkaid', 'Mizar', 'Alioth', 'Megrez', 'Phecda', 'Merak', 'Dubhe', 'Megrez']],
    start: ['Merak', 'Dubhe'],
    path: () => [line('Merak', 'Dubhe', sepDeg(V('Merak'), V('Dubhe')) * 6.2)],
    fists: [['Dubhe', 'Polaris', sepDeg(V('Dubhe'), V('Polaris'))]],
    targets: ['Polaris'],
    steps: [
      'Start from the two stars at the end of the Big Dipper’s bowl, farthest from the handle: Merak and Dubhe, the Pointers.',
      'Draw a line from Merak through Dubhe and keep going in the same direction, out of the bowl.',
      `Measure about three fists (${sepDeg(V('Dubhe'), V('Polaris')).toFixed(0)}°) from Dubhe, or five times the gap between the Pointers.`,
      'Polaris is the first fairly bright star you meet, alone in a dim patch of sky. The line misses it by about 2°, which is close enough.',
    ],
  },
  arcturus: {
    label: 'Arc to Arcturus',
    frame: ['Dubhe', 'Alkaid', 'Arcturus', 'Spica', 'Merak', 'Phecda'],
    figures: [['Alkaid', 'Mizar', 'Alioth', 'Megrez', 'Phecda', 'Merak', 'Dubhe', 'Megrez']],
    start: ['Alioth', 'Mizar', 'Alkaid'],
    path: () => [],
    fists: [
      ['Alkaid', 'Arcturus', sepDeg(V('Alkaid'), V('Arcturus'))],
      ['Arcturus', 'Spica', sepDeg(V('Arcturus'), V('Spica'))],
    ],
    targets: ['Arcturus', 'Spica'],
    startLabel: 'the Dipper’s handle',
    rotate: 90,
    steps: [
      'Start from the three stars of the Big Dipper’s handle: Alioth, Mizar and Alkaid. Notice that they bend.',
      'Keep the same curve going past Alkaid, away from the bowl, as if the handle were longer.',
      `About three fists (${sepDeg(V('Alkaid'), V('Arcturus')).toFixed(0)}°) along the arc, then three more (${sepDeg(V('Arcturus'), V('Spica')).toFixed(0)}°).`,
      'Arcturus is the brilliant orange star at the end of the first leg; blue-white Spica ends the second. Arc to Arcturus, speed on to Spica.',
    ],
  },
  belt: {
    label: 'Orion’s Belt, both ways',
    frame: ['Sirius', 'Aldebaran', 'Pleiades', 'Betelgeuse', 'Rigel'],
    figures: [['Betelgeuse', 'Bellatrix', 'Mintaka', 'Alnilam', 'Alnitak', 'Betelgeuse'], ['Mintaka', 'Rigel'], ['Alnitak', 'Saiph'], ['Betelgeuse', 'Meissa', 'Bellatrix']],
    start: ['Mintaka', 'Alnilam', 'Alnitak'],
    path: () => [line('Mintaka', 'Alnitak', 26), line('Alnitak', 'Mintaka', 26)],
    fists: [
      ['Alnitak', 'Sirius', sepDeg(V('Alnitak'), V('Sirius'))],
      ['Mintaka', 'Aldebaran', sepDeg(V('Mintaka'), V('Aldebaran'))],
    ],
    targets: ['Sirius', 'Aldebaran', 'Pleiades'],
    startLabel: 'Orion’s Belt',
    steps: [
      'Start from Orion’s Belt: three stars of nearly equal brightness in a short, straight row.',
      'Extend the row both ways: down and to the left, and up and to the right.',
      `About two fists each way: ${sepDeg(V('Alnitak'), V('Sirius')).toFixed(0)}° to the lower left, ${sepDeg(V('Mintaka'), V('Aldebaran')).toFixed(0)}° to the upper right.`,
      'Lower left: Sirius, the brightest star of the night. Upper right: orange Aldebaran, a little below the line, and the tiny Pleiades cluster a fist and a half beyond.',
    ],
  },
  triangle: {
    label: 'The missing corner',
    frame: ['Betelgeuse', 'Sirius', 'Procyon', 'Rigel'],
    figures: [['Betelgeuse', 'Bellatrix', 'Mintaka', 'Alnilam', 'Alnitak', 'Betelgeuse'], ['Mintaka', 'Rigel'], ['Alnitak', 'Saiph']],
    start: ['Betelgeuse', 'Sirius'],
    path: () => [line('Betelgeuse', 'Sirius', sepDeg(V('Betelgeuse'), V('Sirius')))],
    fists: [],
    targets: ['Procyon'],
    steps: [
      'Start from two stars you know: orange Betelgeuse at Orion’s shoulder and brilliant Sirius below it.',
      `They are ${sepDeg(V('Betelgeuse'), V('Sirius')).toFixed(0)}° apart. Picture an equal-sided triangle on that side, pointing away from Orion.`,
      'The missing corner is the same distance, about two and a half fists, from both stars.',
      `Procyon completes the triangle: ${sepDeg(V('Procyon'), V('Betelgeuse')).toFixed(0)}° from Betelgeuse and ${sepDeg(V('Procyon'), V('Sirius')).toFixed(0)}° from Sirius. This is the Winter Triangle; if your three stars do not make it, one of them is the wrong star or a planet.`,
    ],
  },
};

const W = 720, H = 420, PAD = 56;

/** Catmull–Rom curve through screen points, as an SVG path. */
function smooth(pts: [number, number][]) {
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export default function StarHop({ params }: DiagramProps) {
  const hopId = typeof params?.hop === 'string' && params.hop in HOPS ? params.hop : 'pointers';
  const hop = HOPS[hopId];
  const [step, setStep] = useState(1);
  const catalog = useCatalog();

  const proj = useMemo(() => {
    const c = norm(hop.frame.map(V).reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]] as V3, [0, 0, 0] as V3));
    const ra0 = Math.atan2(c[1], c[0]);
    const east: V3 = [-Math.sin(ra0), Math.cos(ra0), 0];
    const north: V3 = [-c[2] * Math.cos(ra0), -c[2] * Math.sin(ra0), Math.hypot(c[0], c[1])];
    const rot = rad(hop.rotate ?? 0);
    const raw = (p: V3): [number, number] => {
      const k = 2 / (1 + dot(p, c));
      const x = -k * dot(p, east), y = -k * dot(p, north);
      return [x * Math.cos(rot) + y * Math.sin(rot), -x * Math.sin(rot) + y * Math.cos(rot)];
    };
    const pts = hop.frame.map((n) => raw(V(n)));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const sx = (W - 2 * PAD) / (Math.max(...xs) - Math.min(...xs) || 1);
    const sy = (H - 2 * PAD - 20) / (Math.max(...ys) - Math.min(...ys) || 1);
    const s = Math.min(sx, sy);
    const ox = W / 2 - (s * (Math.max(...xs) + Math.min(...xs))) / 2;
    const oy = H / 2 + 6 - (s * (Math.max(...ys) + Math.min(...ys))) / 2;
    const radius = Math.max(...hop.frame.map((n) => sepDeg(V(n), c))) + 14;
    return { p: (v: V3): [number, number] => { const [x, y] = raw(v); return [ox + s * x, oy + s * y]; }, c, s, radius };
  }, [hop]);

  const bg = useMemo(() => {
    if (!catalog) return [];
    const out: { x: number; y: number; r: number }[] = [];
    for (const st of catalog.stars) {
      if (st.mag > 4.6) break; // stars are sorted by magnitude
      const v = vec(st.ra, st.dec);
      if (sepDeg(v, proj.c) > proj.radius) continue;
      const [x, y] = proj.p(v);
      if (x < 4 || x > W - 4 || y < 4 || y > H - 4) continue;
      out.push({ x, y, r: Math.max(0.9, 4.2 - st.mag * 0.75) });
    }
    return out;
  }, [catalog, proj]);

  const P = (n: string) => proj.p(V(n));
  const r = (n: string) => Math.max(2.2, 6.6 - S[n][2] * 1.2);
  const colour = (n: string) => (step >= 4 && S[n][3] === 'orange' ? C.amber : step >= 4 && S[n][3] === 'blue' ? C.blue : C.star);
  const isStart = (n: string) => hop.start.includes(n);
  const isTarget = (n: string) => hop.targets.includes(n);

  // direction (step ≥ 2)
  const dirPaths: string[] =
    hopId === 'arcturus'
      ? [smooth(['Alioth', 'Mizar', 'Alkaid', 'Arcturus', 'Spica'].map(P))]
      : hop.path().map((piece) => `M ${piece.map((v) => proj.p(v).map((q) => q.toFixed(1)).join(' ')).join(' L ')}`);
  const triangle = hopId === 'triangle' ? ['Betelgeuse', 'Procyon', 'Sirius'].map(P) : null;

  const shownNames = new Set([...(hop.startLabel ? [] : hop.start), ...(step >= 4 ? hop.targets : [])]);
  const labelFor = (n: string) => (n === 'Pleiades' ? 'Pleiades' : n);

  return (
    <div>
      <Svg w={W} h={H} title={`${meta.title}: ${hop.label}`} desc={`A small star chart from real positions showing the hop "${hop.label}" in four steps: the starting stars, the direction, the distance in fists and the target.`}>
        {bg.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={C.star} opacity={0.45} />
        ))}
        {hop.figures.map((f, i) => (
          <polyline key={i} points={f.map((n) => P(n).join(',')).join(' ')} fill="none" stroke={C.lineStrong} strokeWidth={1} opacity={0.7} />
        ))}
        {step >= 2 && dirPaths.map((d, i) => <path key={i} d={d} fill="none" stroke={C.amber} strokeWidth={2} strokeDasharray="7 5" />)}
        {triangle && step >= 3 && (
          <polygon points={triangle.map((p) => p.join(',')).join(' ')} fill={C.amber} fillOpacity={0.08} stroke={C.amber} strokeWidth={1.5} strokeDasharray={step >= 4 ? undefined : '3 4'} />
        )}
        {/* fist ticks */}
        {step >= 3 &&
          hop.fists.map(([a, b, total], k) => {
            const n = Math.floor(total / 10 - 0.15); // no tick right on top of the target
            return Array.from({ length: n }, (_, i) => {
              const d = Math.min(total, (i + 1) * 10);
              const [x, y] = proj.p(along(V(a), V(b), d));
              const [x2, y2] = proj.p(along(V(a), V(b), d + 0.5));
              const dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1;
              const nx = -dy / l, ny = dx / l;
              return (
                <g key={`${k}-${i}`}>
                  <line x1={x - nx * 9} y1={y - ny * 9} x2={x + nx * 9} y2={y + ny * 9} stroke={C.amber} strokeWidth={2.5} />
                  <Label x={x + nx * 22} y={y + ny * 22 + 4} anchor="middle" size="s" color={C.amber} weight={600}>
                    {`${i + 1}`}
                  </Label>
                </g>
              );
            });
          })}
        {Object.keys(S)
          .filter((n) => hop.frame.includes(n) || hop.figures.some((f) => f.includes(n)) || isStart(n) || isTarget(n))
          .map((n) => {
            const [x, y] = P(n);
            const hidden = isTarget(n) && step < 4;
            if (n === 'Pleiades')
              return hidden ? null : (
                <g key={n}>
                  {[[-3, -2], [2, -4], [4, 1], [-1, 3], [0, 0], [-4, 2]].map(([dx, dy], i) => (
                    <circle key={i} cx={x + dx * 1.6} cy={y + dy * 1.6} r={1.6} fill={C.star} />
                  ))}
                </g>
              );
            return (
              <g key={n}>
                <circle cx={x} cy={y} r={r(n)} fill={hidden ? C.star : colour(n)} opacity={hidden ? 0.55 : 1} />
                {isStart(n) && <circle cx={x} cy={y} r={r(n) + 6} fill="none" stroke={C.text} strokeOpacity={0.6} />}
                {isTarget(n) && step >= 4 && <circle cx={x} cy={y} r={r(n) + 9} fill="none" stroke={C.amber} strokeWidth={2} />}
              </g>
            );
          })}
        {[...shownNames].map((n) => {
          const [x, y] = P(n);
          const right = x < W - 120;
          return (
            <Label key={n} x={right ? x + r(n) + 10 : x - r(n) - 10} y={y - 8} anchor={right ? 'start' : 'end'} weight={600} color={isTarget(n) ? C.amber : C.text}>
              {labelFor(n)}
            </Label>
          );
        })}
        {hop.startLabel &&
          (() => {
            const mid = P(hop.start[Math.floor(hop.start.length / 2)]);
            return (
              <Label x={mid[0] + 18} y={mid[1] + 26} weight={600}>
                {hop.startLabel}
              </Label>
            );
          })()}
        {step === 3 &&
          hop.fists.map(([a, b, total]) => {
            const [x, y] = P(b);
            return (
              <Label key={b} x={x + 14} y={y + 20} size="s" color={C.amber} weight={600}>
                {`≈${Math.round(total / 10)} fists (${total.toFixed(0)}°)`}
              </Label>
            );
          })}
        <Step x={30} y={30} n={step} />
        <Label x={48} y={35} weight={600}>
          {['Start from what you know', 'Find the direction', 'Measure the distance in fists', 'Arrive and confirm'][step - 1]}
        </Label>
        <Label x={W - 16} y={H - 14} anchor="end" size="s" color={C.dim}>
          {`${hop.rotate ? 'chart turned: north to the left' : 'chart: north up, east left'}; ticks every 10° (one fist)`}
        </Label>
      </Svg>
      <Controls>
        <button type="button" className="btn btn--sm" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
          Back
        </button>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => setStep((s) => (s >= 4 ? 1 : s + 1))}>
          {step >= 4 ? 'Start again' : 'Next step'}
        </button>
      </Controls>
      <Readout>{`Step ${step} of 4. ${hop.steps[step - 1]}`}</Readout>
    </div>
  );
}
