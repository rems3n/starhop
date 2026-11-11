/**
 * The Little Dipper as a sky-quality gauge. Its seven stars run from magnitude 2 down to 5 (Polaris 1.97,
 * Kochab 2.07, Pherkad 3.00, ε UMi 4.21, ζ UMi 4.29, Yildun 4.35, η UMi 4.95; catalog values). The learner picks a
 * Bortle class (limiting magnitudes as in src/types.ts BORTLE) and sees which stars survive, plus the field
 * stars around it from the catalog. Chart: north up, east left.
 */
import { useMemo, useState } from 'react';
import { useCatalog } from '@/data/catalog';
import { useSettings } from '@/store/settings';
import { C, Controls, Label, RangeControl, Readout, Svg, rad, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Count the Little Dipper',
  summary: 'The Little Dipper and its neighbourhood under a chosen Bortle class: see which of its seven stars survive and what your count says about your sky.',
  params: { bortle: 'starting Bortle class 1–9 (default: the one in settings)' },
};

const BORTLE_LIMIT = [7.6, 7.3, 6.8, 6.3, 5.8, 5.3, 4.8, 4.3, 3.8];
const BORTLE_LABEL = ['Excellent dark site', 'Truly dark site', 'Rural sky', 'Rural/suburban transition', 'Suburban sky', 'Bright suburban sky', 'Suburban/urban transition', 'City sky', 'Inner-city sky'];

type V3 = [number, number, number];
const UMI: [string, number, number, number][] = [
  ['Polaris', 37.94625, 89.26411, 1.97], ['Yildun', 263.05377, 86.58646, 4.35], ['ε', 251.49239, 82.03726, 4.21], ['ζ', 236.01449, 77.79449, 4.29],
  ['η', 244.37687, 75.75533, 4.95], ['Pherkad', 230.18225, 71.83402, 3.0], ['Kochab', 222.67658, 74.15551, 2.07],
];
const LINE = ['Polaris', 'Yildun', 'ε', 'ζ', 'η', 'Pherkad', 'Kochab', 'ζ'];
const vec = (ra: number, dec: number): V3 => [Math.cos(rad(dec)) * Math.cos(rad(ra)), Math.cos(rad(dec)) * Math.sin(rad(ra)), Math.sin(rad(dec))];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// projection centred between Polaris and the bowl
const RA0 = 240, DEC0 = 81;
const CEN = vec(RA0, DEC0);
const E: V3 = [-Math.sin(rad(RA0)), Math.cos(rad(RA0)), 0];
const N: V3 = [-Math.sin(rad(DEC0)) * Math.cos(rad(RA0)), -Math.sin(rad(DEC0)) * Math.sin(rad(RA0)), Math.cos(rad(DEC0))];
const SC = 1150;
function project(ra: number, dec: number): [number, number] {
  const p = vec(ra, dec);
  const k = 2 / (1 + dot(p, CEN));
  // rotate the chart so the Dipper lies across the frame (90° turn, stated in the figure)
  const x = -k * dot(p, E), y = -k * dot(p, N);
  return [360 + SC * y, 190 - SC * x];
}

/** How many Little Dipper stars you count → rough limiting magnitude (matches the lesson's rule of thumb). */
function verdict(n: number) {
  if (n <= 2) return 'a very bright sky: limit brighter than magnitude 3';
  if (n === 3) return 'a limit around magnitude 3 to 4: a typical city sky';
  if (n <= 6) return 'a limit around magnitude 4.5: a bright suburban or good city night';
  return 'a limit of magnitude 5 or fainter: a suburban or darker sky';
}

export default function LittleDipperGauge({ params }: DiagramProps) {
  const setting = useSettings((s) => s.bortle);
  const lat = useSettings((s) => s.observer.lat);
  const [bortle, setBortle] = useState(typeof params?.bortle === 'number' ? (params.bortle as number) : setting);
  const limit = BORTLE_LIMIT[bortle - 1];
  const catalog = useCatalog();
  const field = useMemo(() => {
    if (!catalog) return [];
    const out: { x: number; y: number; mag: number }[] = [];
    for (const s of catalog.stars) {
      if (s.con === 'UMi' && UMI.some(([, ra, dec]) => Math.abs(ra - s.ra) < 0.01 && Math.abs(dec - s.dec) < 0.01)) continue;
      if (dot(vec(s.ra, s.dec), CEN) < Math.cos(rad(26))) continue;
      const [x, y] = project(s.ra, s.dec);
      if (x < 6 || x > 714 || y < 6 || y > 374) continue;
      out.push({ x, y, mag: s.mag });
    }
    return out;
  }, [catalog]);
  const P = Object.fromEntries(UMI.map(([n, ra, dec, mag]) => [n, { xy: project(ra, dec), mag }]));
  const seen = UMI.filter(([, , , m]) => m <= limit);
  const r = (m: number) => Math.max(1, 6.5 - m * 1.05);
  const skyGlow = Math.max(0, (bortle - 3) / 6);

  return (
    <div>
      <Svg w={720} h={380} title={meta.title} desc="The seven stars of the Little Dipper, from Polaris at the end of the handle to Kochab and Pherkad at the end of the bowl, with the surrounding stars. Stars fainter than the chosen sky's limit fade out of view; their positions are marked with small empty circles.">
        <rect x={0} y={0} width={720} height={380} rx={10} fill="#3a3550" opacity={skyGlow * 0.55} />
        {field.map((s, i) => (s.mag <= limit ? <circle key={i} cx={s.x} cy={s.y} r={r(s.mag)} fill={C.star} opacity={0.75} /> : null))}
        <polyline points={LINE.map((n) => P[n].xy.join(',')).join(' ')} fill="none" stroke={C.lineStrong} strokeDasharray="3 5" />
        {UMI.map(([n, , , m]) => {
          const [x, y] = P[n].xy;
          const vis = m <= limit;
          return (
            <g key={n}>
              {vis ? <circle cx={x} cy={y} r={r(m)} fill={n === 'Polaris' ? C.amber : C.star} /> : <circle cx={x} cy={y} r={5} fill="none" stroke={C.faint} strokeDasharray="2 2" />}
              <Label x={x} y={y + (n === 'Kochab' || n === 'ε' || n === 'Polaris' ? -14 : 24)} anchor="middle" size="s" color={vis ? C.text : C.faint}>
                {`${n} ${m.toFixed(1)}`}
              </Label>
            </g>
          );
        })}
        <Label x={20} y={30} size="s" color={C.dim}>
          numbers are magnitudes · dashed circles: too faint tonight
        </Label>
        <Label x={700} y={364} anchor="end" size="s" color={C.dim}>
          {`${BORTLE_LABEL[bortle - 1]} · limit ${limit.toFixed(1)}`}
        </Label>
        <Label x={20} y={364} size="s" color={C.dim}>
          chart turned so the Dipper lies flat
        </Label>
        <Label x={360} y={60} anchor="middle" size="l" weight={700} color={C.amber}>
          {`${seen.length} of 7`}
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Sky" value={bortle} min={1} max={9} step={1} onChange={setBortle} format={(v) => `Bortle ${v}`} />
      </Controls>
      <Readout>
        {`Under a ${BORTLE_LABEL[bortle - 1].toLowerCase()} (limit ${limit.toFixed(1)}) you would count ${seen.length} of the seven stars. If that is what you see outside, it means ${verdict(seen.length)}.`}
        {lat < 0 ? ' The Little Dipper never rises from your latitude; the same test works on any pattern whose star magnitudes you know.' : ''}
      </Readout>
    </div>
  );
}
