/**
 * When the Moon is up, night by night, through one real lunation (new Moon 6 April 2027 → 6 May 2027) at the
 * learner's location. Each column is one day from noon to the next noon (local time); dark = night, the bar =
 * the Moon above the horizon (astronomy-engine rise/set times). Phase icons along the top. Select a day to read
 * the exact times.
 */
import { useMemo, useState } from 'react';
import { Body, Illumination, MoonPhase } from 'astronomy-engine';
import { C, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { atLocal, fmtTime, litPath, phaseName, placeName, upIntervals, useObserver } from './ecliptic-common';

export const meta: DiagramMeta = {
  title: 'When the Moon is up',
  summary: 'Moon-up hours for each night of one month at your location, with phases; the Moon rises later each day as it waxes from crescent to full and wanes.',
  params: { day: 'starting day of the cycle, 0–30 (default 7, first quarter)' },
};

const DAYS = 31;
const X0 = 70, X1 = 704, Y0 = 70, Y1 = 382;
const CW = (X1 - X0) / DAYS;
const yOf = (h: number) => Y0 + (h / 24) * (Y1 - Y0); // h = hours after noon

export default function MoonriseTimesChart({ params }: DiagramProps) {
  const o = useObserver();
  const [sel, setSel] = useState(typeof params?.day === 'number' ? (params.day as number) : 7);
  const days = useMemo(() => {
    const first = new Date(Date.UTC(2027, 3, 6, 12));
    const start = atLocal(o.tz, first, 12);
    const end = new Date(start.getTime() + DAYS * 86400000);
    const moon = upIntervals(Body.Moon, o, start, end);
    const sun = upIntervals(Body.Sun, o, start, end);
    return Array.from({ length: DAYS }, (_, i) => {
      const a = new Date(start.getTime() + i * 86400000), b = new Date(a.getTime() + 86400000);
      const clip = (iv: [Date, Date][]) => iv.filter(([p, q]) => q > a && p < b).map(([p, q]) => [Math.max(0, (p.getTime() - a.getTime()) / 3600000), Math.min(24, (q.getTime() - a.getTime()) / 3600000)] as [number, number]);
      const night = new Date(a.getTime() + 9 * 3600000);
      const el = MoonPhase(night);
      const ill = Illumination(Body.Moon, night).phase_fraction;
      const rises = moon.filter(([p]) => p > a && p < b && p.getTime() !== start.getTime()).map(([p]) => p);
      const sets = moon.filter(([, q]) => q > a && q < b && q.getTime() !== end.getTime()).map(([, q]) => q);
      return { a, moon: clip(moon), sun: clip(sun), el, ill, rises, sets };
    });
  }, [o]);
  const d = days[Math.min(DAYS - 1, Math.max(0, sel))];
  const label = (x: Date) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: o.tz });
  const name = phaseName(d.el);
  const south = o.lat < 0;

  return (
    <div>
      <Svg w={720} h={414} title={meta.title} desc={`For each day from ${label(days[0].a)} to ${label(days[DAYS - 1].a)} at ${o.name}, bars show when the Moon is above the horizon between noon and the next noon. The bars start in the afternoon at crescent, run through the night at full, and shift into the morning when waning.`}>
        {['noon', '3 pm', '6 pm', '9 pm', 'midnight', '3 am', '6 am', '9 am', 'noon'].map((t, i) => (
          <g key={i}>
            <line x1={X0} x2={X1} y1={yOf(i * 3)} y2={yOf(i * 3)} stroke={C.line} />
            <Label x={X0 - 6} y={yOf(i * 3) + 4} anchor="end" size="s" color={C.dim}>
              {t}
            </Label>
          </g>
        ))}
        {days.map((day, i) => {
          const x = X0 + i * CW;
          const k = -Math.cos((day.el * Math.PI) / 180);
          const side = (day.el < 180 ? 1 : -1) * (south ? -1 : 1);
          return (
            <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
              {/* night = gaps between Sun-up intervals */}
              <rect x={x + 1} y={Y0} width={CW - 2} height={Y1 - Y0} fill="#070b1f" />
              {day.sun.map(([p, q], j) => (
                <rect key={j} x={x + 1} y={yOf(p)} width={CW - 2} height={yOf(q) - yOf(p)} fill={C.sun} opacity={0.16} />
              ))}
              {day.moon.map(([p, q], j) => (
                <rect key={j} x={x + CW / 2 - 4} y={yOf(p)} width={8} height={Math.max(1, yOf(q) - yOf(p))} rx={3} fill={C.moon} opacity={i === sel ? 1 : 0.75} />
              ))}
              {i % 2 === 0 && (
                <g>
                  <circle cx={x + CW / 2} cy={44} r={7.5} fill="#232a4d" />
                  <path d={litPath(x + CW / 2, 44, 7.5, side, 0, k)} fill={C.moon} />
                </g>
              )}
              {i === sel && <rect x={x} y={Y0 - 4} width={CW} height={Y1 - Y0 + 8} fill="none" stroke={C.amber} strokeWidth={2} rx={3} />}
            </g>
          );
        })}
        {[0, 7, 14, 21, 28].map((i) => (
          <Label key={i} x={X0 + i * CW + CW / 2} y={Y1 + 20} anchor="middle" size="s" color={C.dim}>
            {label(days[i].a)}
          </Label>
        ))}
        <Label x={X0} y={20} size="s" color={C.dim}>
          {`Each column: one day at ${placeName(o)}, noon to noon · dark = night · bar = Moon above the horizon`}
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Day" value={sel} min={0} max={DAYS - 1} onChange={setSel} format={(v) => label(days[v].a)} />
      </Controls>
      <Readout>
        {`${label(d.a)}: ${name.toLowerCase()}, ${Math.round(d.ill * 100)}% lit. `}
        {d.rises.length ? `Moonrise ${d.rises.map((t) => fmtTime(o.tz, t)).join(' and ')}` : d.moon.some(([p]) => p === 0) ? 'The Moon is already up at noon' : 'No moonrise between this noon and the next'}
        {d.sets.length ? `, moonset ${d.sets.map((t) => fmtTime(o.tz, t)).join(' and ')}.` : '.'}
        {sel > 0 && days[sel - 1].rises.length && d.rises.length
          ? ` That is ${Math.round((d.rises[0].getTime() - days[sel - 1].rises[0].getTime()) / 60000 - 1440)} minutes later than the day before.`
          : ''}
      </Readout>
    </div>
  );
}
