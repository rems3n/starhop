/**
 * Altitude and azimuth change with time and place; the pattern does not.
 * An all-sky chart (zenith in the centre, horizon round the edge; looking up, so north at the top and east on the
 * left) shows the Summer Triangle on a mid-August night, computed with astronomy-engine. The learner slides the clock
 * and switches between their own location (settings) and other cities at the same instant; the table of
 * altitudes and azimuths changes while the triangle keeps its shape.
 */
import { useMemo, useState } from 'react';
import { Horizon, Observer as AeObserver } from 'astronomy-engine';
import { useSettings } from '@/store/settings';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, rad, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Moving numbers, fixed pattern',
  summary: 'The Summer Triangle on an all-sky chart; slide the clock or switch city and watch altitude and azimuth change while the triangle keeps its shape.',
  params: { month: 'month of the night shown, 1–12 (default 8)' },
};

const STARS: [string, number, number][] = [
  ['Vega', 279.2346, 38.78369],
  ['Deneb', 310.35798, 45.28034],
  ['Altair', 297.69582, 8.86832],
];
const PLACES: Record<string, { name: string; lat: number; lon: number }> = {
  london: { name: 'London', lat: 51.507, lon: -0.128 },
  chicago: { name: 'Chicago', lat: 41.878, lon: -87.63 },
  rio: { name: 'Rio de Janeiro', lat: -22.907, lon: -43.173 },
};

function zonedDate(y: number, m: number, d: number, hour: number, tz: string): Date {
  const off = (t: number) => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(t));
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(t / 60000) * 60000;
  };
  const naive = Date.UTC(y, m - 1, d) + hour * 3600000;
  let t = naive - off(naive);
  t = naive - off(t);
  return new Date(t);
}
const sep = (a: [number, number], b: [number, number]) => {
  const v = (ra: number, dec: number) => [Math.cos(rad(dec)) * Math.cos(rad(ra)), Math.cos(rad(dec)) * Math.sin(rad(ra)), Math.sin(rad(dec))];
  const p = v(...a), q = v(...b);
  return (Math.acos(p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) * 180) / Math.PI;
};

const CX = 205, CY = 205, R = 170;
const sky = (alt: number, az: number): [number, number] => {
  const r = (R * (90 - alt)) / 90;
  return [CX - r * Math.sin(rad(az)), CY - r * Math.cos(rad(az))]; // looking up: east on the left
};
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function clock(h: number) {
  const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60);
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'p.m.' : 'a.m.'}`;
}

export default function AltazTimePlace({ params }: DiagramProps) {
  const observer = useSettings((s) => s.observer);
  const month = typeof params?.month === 'number' ? (params.month as number) : 8;
  const [hour, setHour] = useState(21);
  const [place, setPlace] = useState('here');
  const where = place === 'here' ? { name: observer.name, lat: observer.lat, lon: observer.lon } : PLACES[place];

  const data = useMemo(() => {
    const date = zonedDate(new Date().getFullYear(), month, 15, hour, observer.tz);
    const obs = new AeObserver(where.lat, where.lon, 0);
    const stars = STARS.map(([n, ra, dec]) => {
      const h = Horizon(date, obs, ra / 15, dec, 'normal');
      return { n, alt: h.altitude, az: h.azimuth };
    });
    const trail = Array.from({ length: 41 }, (_, i) => {
      const d = zonedDate(new Date().getFullYear(), month, 15, 19 + i * 0.25, observer.tz);
      const h = Horizon(d, obs, STARS[0][1] / 15, STARS[0][2], 'normal');
      return { alt: h.altitude, az: h.azimuth };
    });
    return { stars, trail };
  }, [hour, where.lat, where.lon, observer.tz, month]);

  const sides = [
    ['Vega', 'Altair'],
    ['Altair', 'Deneb'],
    ['Deneb', 'Vega'],
  ].map(([a, b]) => {
    const A = STARS.find((s) => s[0] === a)!, B = STARS.find((s) => s[0] === b)!;
    return { a, b, d: sep([A[1], A[2]], [B[1], B[2]]) };
  });
  const pos = Object.fromEntries(data.stars.map((s) => [s.n, s]));
  const allUp = data.stars.every((s) => s.alt > 0);
  const vega = pos.Vega;

  return (
    <div>
      <Svg w={720} h={410} title={meta.title} desc="An all-sky chart: the zenith is in the centre, the horizon is the circle's edge, north at the top and east on the left. The three stars of the Summer Triangle are plotted for the chosen time and place, with a table of their altitudes and azimuths beside it.">
        <circle cx={CX} cy={CY} r={R} fill={C.panel} stroke={C.lineStrong} strokeWidth={1.5} />
        {[30, 60].map((a) => (
          <circle key={a} cx={CX} cy={CY} r={(R * (90 - a)) / 90} fill="none" stroke={C.line} strokeDasharray="3 4" />
        ))}
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke={C.blue} opacity={0.5} />
        {[
          [0, 'N'],
          [90, 'E'],
          [180, 'S'],
          [270, 'W'],
        ].map(([a, t]) => {
          const [x, y] = sky(-12, a as number);
          return (
            <Label key={t as string} x={x} y={y + 5} anchor="middle" weight={700} color={t === 'N' ? C.amber : C.text}>
              {t as string}
            </Label>
          );
        })}
        <Label x={CX + 6} y={CY + 16} size="s" color={C.dim}>
          zenith
        </Label>
        <Label x={sky(30, 210)[0]} y={sky(30, 210)[1]} anchor="middle" size="s" color={C.faint}>
          30°
        </Label>
        <Label x={sky(60, 210)[0]} y={sky(60, 210)[1]} anchor="middle" size="s" color={C.faint}>
          60°
        </Label>
        {/* Vega's path through the night */}
        <path
          d={`M ${data.trail
            .filter((q) => q.alt > 0)
            .map((q) => sky(q.alt, q.az).map((v) => v.toFixed(1)).join(' '))
            .join(' L ')}`}
          fill="none"
          stroke={C.amber}
          strokeDasharray="2 4"
          opacity={0.6}
        />
        {/* triangle */}
        {allUp && <polygon points={data.stars.map((s) => sky(s.alt, s.az).join(',')).join(' ')} fill={C.amber} fillOpacity={0.08} stroke={C.amber} strokeWidth={1.5} />}
        {data.stars.map((s) =>
          s.alt > 0 ? (
            <g key={s.n}>
              <circle cx={sky(s.alt, s.az)[0]} cy={sky(s.alt, s.az)[1]} r={5} fill={C.star} />
              <Label x={sky(s.alt, s.az)[0] + 8} y={sky(s.alt, s.az)[1] - 7} size="s" weight={600}>
                {s.n}
              </Label>
            </g>
          ) : null,
        )}
        {/* table */}
        <Label x={420} y={40} weight={700}>
          {`${where.name}, ${MONTHS[month]} 15`}
        </Label>
        <Label x={420} y={60} size="s" color={C.dim}>
          {`${clock(hour)} (your time zone)`}
        </Label>
        <Label x={500} y={96} anchor="end" size="s" color={C.dim}>
          star
        </Label>
        <Label x={590} y={96} anchor="end" size="s" color={C.good}>
          altitude
        </Label>
        <Label x={690} y={96} anchor="end" size="s" color={C.amber}>
          azimuth
        </Label>
        {data.stars.map((s, i) => (
          <g key={s.n}>
            <Label x={500} y={124 + i * 26} anchor="end" weight={600}>
              {s.n}
            </Label>
            <Label x={590} y={124 + i * 26} anchor="end" color={s.alt > 0 ? C.text : C.faint}>
              {s.alt > 0 ? `${Math.round(s.alt)}°` : 'below'}
            </Label>
            <Label x={690} y={124 + i * 26} anchor="end" color={s.alt > 0 ? C.text : C.faint}>
              {`${Math.round(s.az)}° ${POINTS[Math.round(s.az / 22.5) % 16]}`}
            </Label>
          </g>
        ))}
        <line x1={420} x2={700} y1={214} y2={214} stroke={C.line} />
        <Label x={420} y={240} size="s" color={C.dim}>
          the triangle's sides (never change):
        </Label>
        {sides.map((s, i) => (
          <Label key={i} x={420} y={264 + i * 22}>
            {`${s.a}–${s.b}: ${s.d.toFixed(0)}°`}
          </Label>
        ))}
        <Label x={420} y={350} size="s" color={C.dim}>
          chart: looking up, so east is on the left
        </Label>
        <Label x={420} y={370} size="s" color={C.dim}>
          dotted: Vega's path, 7 p.m. to 5 a.m.
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Time" value={hour} min={19} max={29} step={0.25} onChange={setHour} format={clock} />
        <ChoiceControl
          label="Seen from"
          value={place}
          options={[
            { value: 'here', label: 'Your location' },
            { value: 'london', label: 'London' },
            { value: 'chicago', label: 'Chicago' },
            { value: 'rio', label: 'Rio' },
          ]}
          onChange={setPlace}
        />
      </Controls>
      <Readout>
        {vega.alt > 0
          ? `At ${clock(hour)} your time, Vega is ${Math.round(vega.alt)}° up at azimuth ${Math.round(vega.az)}° as seen from ${where.name}. Change the time or the place and those numbers change; the triangle's sides stay ${sides.map((s) => s.d.toFixed(0)).join('°, ')}°.`
          : `At ${clock(hour)} your time, Vega is below the horizon as seen from ${where.name}. The stars are still there, and still the same distance apart: altitude and azimuth only say where they are from one place at one moment.`}
      </Readout>
    </div>
  );
}
