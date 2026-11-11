/**
 * The zodiac as a clock face for the planets. Earth is at the centre; the Sun, Mars, Jupiter and Saturn move
 * round the ring of zodiac constellations at their real geocentric positions (astronomy-engine, weekly steps,
 * 2026–2040). A coloured arc shows how far each one travelled in the last 12 months.
 */
import { useEffect, useMemo, useState } from 'react';
import { Body } from 'astronomy-engine';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, polar, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';
import { ZODIAC, geoEcl, norm180, zodiacAt, zodiacSpan } from './ecliptic-common';

export const meta: DiagramMeta = {
  title: 'How fast the planets cross the zodiac',
  summary: 'Real positions of the Sun, Mars, Jupiter and Saturn round the zodiac, 2026–2040; slide or play the years and compare a year’s travel for each.',
  params: { year: 'starting year, 2026–2040 (default 2027)' },
};

const CX = 360, CY = 212, R_IN = 152, R_OUT = 178, R_LAB = 192;
const START = Date.UTC(2026, 0, 1);
const WEEKS = 15 * 52;
const BODIES = [
  { body: Body.Sun, name: 'Sun', r: 62, color: C.sun },
  { body: Body.Mars, name: 'Mars', r: 88, color: C.red },
  { body: Body.Jupiter, name: 'Jupiter', r: 112, color: '#e3c89a' },
  { body: Body.Saturn, name: 'Saturn', r: 136, color: '#b7a6e8' },
];

export default function PlanetZodiacClock({ params }: DiagramProps) {
  const y0 = typeof params?.year === 'number' ? (params.year as number) : 2027;
  const [w, setW] = useState(Math.max(52, Math.min(WEEKS, Math.round((y0 - 2026) * 52.18) + 1)));
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  const table = useMemo(
    () => BODIES.map((b) => Array.from({ length: WEEKS + 1 }, (_, i) => geoEcl(b.body, new Date(START + i * 7 * 86400000)).lon)),
    [],
  );
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setW((x) => (x >= WEEKS ? 52 : x + (reduced ? 13 : 1))), reduced ? 600 : 70);
    return () => clearInterval(id);
  }, [playing, reduced]);

  const date = new Date(START + w * 7 * 86400000);
  const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const travel = BODIES.map((_, k) => {
    let sum = 0;
    for (let i = w - 51; i <= w; i++) sum += norm180(table[k][i] - table[k][i - 1]);
    return sum;
  });

  return (
    <div>
      <Svg w={720} h={424} title={meta.title} desc={`${label}: ${BODIES.map((b, k) => `${b.name} in ${zodiacAt(table[k][w]).name}`).join(', ')}.`}>
        {ZODIAC.map((z, i) => {
          const [a, b] = zodiacSpan(i);
          const [x0, y0_] = polar(CX, CY, R_OUT, a), [x1, y1] = polar(CX, CY, R_OUT, b);
          const [x2, y2] = polar(CX, CY, R_IN, b), [x3, y3] = polar(CX, CY, R_IN, a);
          const mid = (a + b) / 2;
          const [lx, ly] = polar(CX, CY, z.abbr === 'Sco' ? R_LAB + 22 : R_LAB, z.abbr === 'Sco' ? mid - 3 : z.abbr === 'Oph' ? mid + 2 : mid);
          const c = Math.cos((mid * Math.PI) / 180);
          return (
            <g key={z.abbr}>
              <path d={`M ${x0} ${y0_} A ${R_OUT} ${R_OUT} 0 0 0 ${x1} ${y1} L ${x2} ${y2} A ${R_IN} ${R_IN} 0 0 1 ${x3} ${y3} Z`} fill={i % 2 ? 'rgba(156,176,255,0.10)' : 'rgba(156,176,255,0.18)'} stroke={C.line} />
              <Label x={lx} y={ly + 5} anchor={c > 0.35 ? 'start' : c < -0.35 ? 'end' : 'middle'} size="s" color={C.dim}>
                {z.name}
              </Label>
            </g>
          );
        })}
        {BODIES.map((b, k) => {
          // Last 12 months as an arc along this body's track
          const pts: string[] = [];
          let lon = table[k][w - 51];
          for (let i = w - 51; i <= w; i++) {
            if (i > w - 51) lon += norm180(table[k][i] - table[k][i - 1]);
            const [x, y] = polar(CX, CY, b.r, lon);
            pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
          }
          const [px, py] = polar(CX, CY, b.r, table[k][w]);
          return (
            <g key={b.name}>
              <circle cx={CX} cy={CY} r={b.r} fill="none" stroke={C.line} strokeDasharray="2 5" />
              {k > 0 && <polyline points={pts.join(' ')} fill="none" stroke={b.color} strokeWidth={5} strokeLinecap="round" opacity={0.45} />}
              <circle cx={px} cy={py} r={k === 0 ? 8 : 6} fill={b.color} stroke={C.bg} strokeWidth={1.5} />
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={7} fill={C.earth} />
        <Label x={CX} y={CY + 22} anchor="middle" size="s" weight={600}>
          Earth
        </Label>
        {/* Legend */}
        {BODIES.map((b, k) => (
          <g key={b.name}>
            <circle cx={22} cy={20 + k * 20} r={5} fill={b.color} />
            <Label x={34} y={25 + k * 20} size="s">
              {k === 0 ? 'Sun' : `${b.name}: ${zodiacAt(table[k][w]).name}`}
            </Label>
          </g>
        ))}
        <Label x={706} y={25} anchor="end" weight={700}>
          {label}
        </Label>
        <Label x={706} y={410} anchor="end" size="s" color={C.faint}>
          arcs: distance travelled in the last 12 months
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Date" value={w} min={52} max={WEEKS} onChange={(v) => { setPlaying(false); setW(v); }} format={() => label} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} label="Play the years" />
      </Controls>
      <Readout>
        {`${label}. In the past 12 months the Sun went once round the whole ring, Mars ${Math.round(Math.abs(travel[1]))}°, Jupiter ${Math.round(Math.abs(travel[2]))}° (about one constellation) and Saturn only ${Math.round(Math.abs(travel[3]))}°. `}
        {`Jupiter is in ${zodiacAt(table[2][w]).name}; a year from now look about one constellation farther east.`}
      </Readout>
    </div>
  );
}
