/**
 * The planets to scale (sizes only), with the edge of the Sun for comparison. Choose a planet to compare with the
 * Earth; the readout gives a scale model (Earth = a 1 cm marble) for size and distance from the Sun.
 * Mean radii and orbit sizes: Wikipedia / NASA planetary fact sheets (checked Nov 2026). Distances between planets
 * are not to scale; the figure says so.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { fmt, sig } from './objects-lib';

export const meta: DiagramMeta = {
  title: 'The planets to scale',
  summary: 'All eight planets drawn to the same scale beside the edge of the Sun; pick one to compare it with Earth in a marble-sized scale model.',
  params: { planet: 'starting planet name (default "Jupiter")' },
};

const KM_PER_PX = 1000;
/** mean radius km, semi-major axis AU, display colour */
const P = [
  { name: 'Mercury', r: 2439.7, a: 0.387, c: '#b3aca3' },
  { name: 'Venus', r: 6051.8, a: 0.723, c: '#efe0b8' },
  { name: 'Earth', r: 6371, a: 1, c: '#5b8fd6' },
  { name: 'Mars', r: 3389.5, a: 1.524, c: '#d0714a' },
  { name: 'Jupiter', r: 69911, a: 5.203, c: '#d9b892' },
  { name: 'Saturn', r: 58232, a: 9.537, c: '#e6cf98' },
  { name: 'Uranus', r: 25362, a: 19.19, c: '#9fd8de' },
  { name: 'Neptune', r: 24622, a: 30.07, c: '#5d7fe0' },
];
const SUN_R = 695700, AU_KM = 1.496e8, RING_OUT = 136775;
const XS = [48, 72, 98, 124, 222, 432, 602, 674];
const CY = 176;

export default function PlanetSizesToScale({ params }: DiagramProps) {
  const start = P.find((p) => p.name === params?.planet)?.name ?? 'Jupiter';
  const [sel, setSel] = useState(start);
  const p = P.find((x) => x.name === sel)!;
  const earth = P[2];
  const ratio = p.r / earth.r;
  const cm = (km: number) => (km * 2) / (earth.r * 2); // Earth diameter = 1 cm
  const dist = (au: number) => { const m = (au * AU_KM) / (earth.r * 2) / 100; return m >= 1000 ? `${fmt(sig(m / 1000, 2))} km` : `${fmt(Math.round(m))} m`; };

  return (
    <div>
      <Svg w={720} h={330} title={meta.title} desc="The edge of the Sun as a huge curve on the left, then Mercury, Venus, Earth and Mars as small dots, Jupiter and Saturn as large discs (Saturn with its rings), and Uranus and Neptune as medium discs, all at the same scale.">
        <circle cx={10 - SUN_R / KM_PER_PX} cy={CY} r={SUN_R / KM_PER_PX} fill="#ffd27a" />
        <Label x={18} y={40} size="s" weight={700} color={C.amber}>Sun</Label>
        <Label x={18} y={56} size="s" color={C.dim}>(edge)</Label>
        {P.map((q, i) => {
          const r = q.r / KM_PER_PX, on = q.name === sel;
          return (
            <g key={q.name} onClick={() => setSel(q.name)} style={{ cursor: 'pointer' }}>
              {q.name === 'Saturn' && <ellipse cx={XS[i]} cy={CY} rx={RING_OUT / KM_PER_PX} ry={RING_OUT / KM_PER_PX * 0.22} fill="none" stroke="#d9c28a" strokeWidth={7} opacity={0.75} />}
              <circle cx={XS[i]} cy={CY} r={Math.max(r, 1.5)} fill={q.c} />
              {q.name === 'Saturn' && <path d={`M ${XS[i] - RING_OUT / KM_PER_PX} ${CY} A ${RING_OUT / KM_PER_PX} ${RING_OUT / KM_PER_PX * 0.22} 0 0 0 ${XS[i] + RING_OUT / KM_PER_PX} ${CY}`} fill="none" stroke="#d9c28a" strokeWidth={7} opacity={0.75} />}
              {on && <circle cx={XS[i]} cy={CY} r={Math.max(r, 4) + 6} fill="none" stroke={C.amber} strokeWidth={2} />}
              <Label x={XS[i]} y={i < 4 ? (i % 2 ? CY + 36 : CY - 24) : CY + r + 26 + (q.name === 'Saturn' ? 0 : 0)} anchor="middle" size="s" weight={on ? 700 : 500} color={on ? C.amber : C.text}>{q.name}</Label>
            </g>
          );
        })}
        {[0, 1, 2, 3].map((i) => <line key={i} x1={XS[i]} x2={XS[i]} y1={i % 2 ? CY + 8 : CY - 8} y2={i % 2 ? CY + 24 : CY - 18} stroke={C.line} />)}
        <Label x={360} y={314} anchor="middle" size="s" color={C.dim}>Sizes to scale; the spacing between planets is not (it would be hundreds of times wider).</Label>
      </Svg>
      <Controls>
        <ChoiceControl label="Compare with Earth" value={sel} options={P.map((q) => ({ value: q.name, label: q.name }))} onChange={setSel} />
      </Controls>
      <Readout>
        {sel === 'Earth'
          ? `Scale model: make the Earth a marble 1 cm across. The Sun is then a ball ${fmt(sig(cm(SUN_R) / 100, 2))} m across, ${dist(1)} away.`
          : `${p.name} is ${ratio > 1 ? `${fmt(sig(ratio, 2))} times as wide as` : `${ratio > 0.9 ? 'almost as wide as' : `${fmt(sig(1 / ratio, 2))} times narrower than`}`} the Earth${ratio > 3 ? `; about ${fmt(sig(ratio ** 3, 2))} Earths would fit inside it` : ''}. With the Earth as a 1 cm marble, ${p.name} is ${cm(p.r) >= 1 ? `${fmt(sig(cm(p.r), 2))} cm` : `${fmt(sig(cm(p.r) * 10, 2))} mm`} across and ${dist(p.a)} from a Sun ${fmt(sig(cm(SUN_R) / 100, 2))} m wide.`}
      </Readout>
    </div>
  );
}
