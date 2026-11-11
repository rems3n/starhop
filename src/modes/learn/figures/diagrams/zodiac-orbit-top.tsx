/**
 * Earth's orbit seen from above the north pole of the solar system, ringed by the 13 constellations the
 * ecliptic crosses (IAU boundaries, spans computed with astronomy-engine). A date slider moves Earth:
 * the line from Earth through the Sun shows the constellation hidden behind the Sun; the line pointing away
 * from the Sun shows the constellation that is up at midnight.
 */
import { useEffect, useMemo, useState } from 'react';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, polar, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';
import { ZODIAC, dayOf2027, geoEcl, norm360, zodiacAt, zodiacSpan } from './ecliptic-common';
import { Body } from 'astronomy-engine';

export const meta: DiagramMeta = {
  title: 'Earth’s orbit and the zodiac',
  summary: 'Top view of Earth circling the Sun inside the ring of zodiac constellations; slide the date to see which constellation the Sun hides and which is up at midnight.',
  params: { day: 'starting day of the year, 0–364 (default 64, early March)' },
};

const CX = 360, CY = 212, R_ORBIT = 88, R_IN = 138, R_OUT = 166, R_LAB = 180;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function arcBand(a0: number, a1: number, r0: number, r1: number) {
  const [x0, y0] = polar(CX, CY, r1, a0);
  const [x1, y1] = polar(CX, CY, r1, a1);
  const [x2, y2] = polar(CX, CY, r0, a1);
  const [x3, y3] = polar(CX, CY, r0, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 0 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 1 ${x3} ${y3} Z`;
}

export default function ZodiacOrbitTop({ params }: DiagramProps) {
  const [day, setDay] = useState(typeof params?.day === 'number' ? (params.day as number) : 64);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setDay((d) => (d + (reduced ? 7 : 1)) % 365), reduced ? 500 : 60);
    return () => clearInterval(id);
  }, [playing, reduced]);

  // Earth's position for each month start, for the little date ticks on the orbit.
  const monthLon = useMemo(() => MONTH_START.map((d) => norm360(geoEcl(Body.Sun, dayOf2027(d)).lon + 180)), []);
  const date = dayOf2027(day);
  const sunLon = geoEcl(Body.Sun, date).lon;
  const earthLon = norm360(sunLon + 180);
  const behind = zodiacAt(sunLon);
  const midnight = zodiacAt(sunLon + 180);
  const [ex, ey] = polar(CX, CY, R_ORBIT, earthLon);
  const dateLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

  return (
    <div>
      <Svg w={720} h={424} title={meta.title} desc={`Earth's orbit from above with the zodiac constellations around it. On ${dateLabel} the Sun lies in front of ${behind.name}; at midnight the sky faces ${midnight.name}.`}>
        {/* Zodiac ring */}
        {ZODIAC.map((z, i) => {
          const [a, b] = zodiacSpan(i);
          const hot = z === behind ? C.amber : z === midnight ? C.blue : null;
          const mid = (a + b) / 2;
          const [lx, ly] = polar(CX, CY, z.abbr === 'Sco' ? R_LAB + 22 : R_LAB, z.abbr === 'Sco' ? mid - 3 : z.abbr === 'Oph' ? mid + 2 : mid);
          const c = Math.cos((mid * Math.PI) / 180);
          return (
            <g key={z.abbr}>
              <path d={arcBand(a, b, R_IN, R_OUT)} fill={hot ?? (i % 2 ? 'rgba(156,176,255,0.10)' : 'rgba(156,176,255,0.18)')} fillOpacity={hot ? 0.45 : 1} stroke={C.line} />
              <Label x={lx} y={ly + 5} anchor={c > 0.35 ? 'start' : c < -0.35 ? 'end' : 'middle'} size={hot ? 'm' : 's'} color={hot ?? C.dim} weight={hot ? 700 : 500}>
                {z.name}
              </Label>
            </g>
          );
        })}
        {/* Earth's orbit with month ticks */}
        <circle cx={CX} cy={CY} r={R_ORBIT} fill="none" stroke={C.lineStrong} strokeDasharray="3 4" />
        {monthLon.map((l, i) => {
          const [tx, ty] = polar(CX, CY, R_ORBIT - 13, l);
          const [ax, ay] = polar(CX, CY, R_ORBIT - 3, l);
          const [bx, by] = polar(CX, CY, R_ORBIT + 3, l);
          return (
            <g key={i}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={C.lineStrong} />
              {i % 3 === 0 && (
                <Label x={tx} y={ty + 4} anchor="middle" size="s" color={C.faint}>
                  {MONTHS[i]}
                </Label>
              )}
            </g>
          );
        })}
        {/* Sight lines */}
        <line x1={ex} y1={ey} x2={polar(CX, CY, R_IN, sunLon)[0]} y2={polar(CX, CY, R_IN, sunLon)[1]} stroke={C.amber} strokeWidth={1.6} />
        <line x1={ex} y1={ey} x2={polar(ex, ey, R_IN - R_ORBIT + 40, earthLon)[0]} y2={polar(ex, ey, R_IN - R_ORBIT + 40, earthLon)[1]} stroke={C.blue} strokeWidth={1.6} strokeDasharray="6 4" markerEnd="url(#fig-arrow)" />
        {/* Sun */}
        <circle cx={CX} cy={CY} r={26} fill="url(#fig-glow)" />
        <circle cx={CX} cy={CY} r={11} fill={C.sun} />
        {/* Earth: day side toward the Sun */}
        <circle cx={ex} cy={ey} r={8} fill="#0b1230" stroke={C.earth} />
        <path d={`M ${polar(ex, ey, 8, sunLon + 90)[0]} ${polar(ex, ey, 8, sunLon + 90)[1]} A 8 8 0 0 0 ${polar(ex, ey, 8, sunLon - 90)[0]} ${polar(ex, ey, 8, sunLon - 90)[1]} Z`} fill={C.earth} />
        <Label x={ex + (Math.cos((earthLon * Math.PI) / 180) > 0 ? 12 : -12)} y={ey - 10} anchor={Math.cos((earthLon * Math.PI) / 180) > 0 ? 'start' : 'end'} weight={700}>
          Earth
        </Label>
        {/* Legend */}
        <line x1={18} y1={20} x2={42} y2={20} stroke={C.amber} strokeWidth={2} />
        <Label x={48} y={25} size="s" color={C.amber}>
          toward the Sun: hidden by daylight
        </Label>
        <line x1={18} y1={42} x2={42} y2={42} stroke={C.blue} strokeWidth={2} strokeDasharray="6 4" />
        <Label x={48} y={47} size="s" color={C.blue}>
          away from the Sun: up at midnight
        </Label>
        <Label x={712} y={406} anchor="end" size="s" color={C.faint}>
          seen from above Earth’s north pole · not to scale
        </Label>
        <Label x={712} y={25} anchor="end" size="s" color={C.dim}>
          Earth moves anticlockwise ↺
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Date" value={day} min={0} max={364} onChange={(v) => { setPlaying(false); setDay(v); }} format={() => dateLabel} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} label="Play a year" />
      </Controls>
      <Readout>
        {`${dateLabel}: the Sun is in front of ${behind.name}, so its stars are lost in daylight. At midnight you face the other way, toward ${midnight.name}${midnight.abbr === 'Oph' ? ' (the constellation astrology leaves out)' : ''}.`}
        {behind.abbr === 'Sco' ? ' The Sun crosses Scorpius in under a week: the boundary only clips its corner.' : ''}
      </Readout>
    </div>
  );
}
