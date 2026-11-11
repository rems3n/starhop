/**
 * The clock time at which a star is highest (crosses the meridian) on every day of the year, for the
 * learner's location, against the hours of daylight. The line slopes by about 4 minutes a day (2 hours a
 * month) and wraps once a year. Sunrise/sunset from astronomy-engine; times in local standard time.
 */
import { useMemo, useState } from 'react';
import * as Astronomy from 'astronomy-engine';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { culmination, lstDeg, placeName, precessor, tzOffsetMin, useObserver, wrap360 } from './_motion-sky';

export const meta: DiagramMeta = {
  title: 'Two hours earlier every month',
  summary: 'Chart of the clock time a bright star is highest on each day of the year, over shaded daylight, for the learner’s location; pick a star and a date.',
  params: { star: 'Sirius | Vega | Antares (default Sirius)', day: 'starting day of the year, 0–364 (default 14)' },
};

const W = 720, H = 380;
const X0 = 78, X1 = 700, Y0 = 34, Y1 = 330;
const STARS = { Sirius: { ra: 101.287, dec: -16.716 }, Vega: { ra: 279.235, dec: 38.784 }, Antares: { ra: 247.352, dec: -26.432 } } as const;
type StarId = keyof typeof STARS;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MDAY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const x = (d: number) => X0 + (d / 365) * (X1 - X0);
const y = (hSinceNoon: number) => Y0 + (hSinceNoon / 24) * (Y1 - Y0);
const fmtDay = (d: number) => { const m = MDAY.filter((v) => v <= d).length - 1; return `${d - MDAY[m] + 1} ${MON[m]}`; };
const clock = (hSinceNoon: number) => {
  const t = (12 + hSinceNoon) % 24;
  let hh = Math.floor(t), mm = Math.round((t - hh) * 60);
  if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
};

export default function TransitTimeChart({ params }: DiagramProps) {
  const obs = useObserver();
  const [star, setStar] = useState<StarId>(params?.star && (params.star as string) in STARS ? (params.star as StarId) : 'Sirius');
  const [day, setDay] = useState<number>(typeof params?.day === 'number' ? (params.day as number) : 14);

  // Local standard time: the smaller of the January and July offsets (daylight saving adds an hour).
  const std = useMemo(() => Math.min(tzOffsetMin(Date.UTC(2026, 0, 15), obs.tz), tzOffsetMin(Date.UTC(2026, 6, 15), obs.tz)), [obs.tz]);
  const noonUT = (d: number) => Date.UTC(2026, 0, 1, 12) + d * 86400000 - std * 60000;
  const stdLabel = `UTC${std >= 0 ? '+' : '−'}${Math.floor(Math.abs(std) / 60)}${Math.abs(std) % 60 ? `:${String(Math.abs(std) % 60).padStart(2, '0')}` : ''}`;

  const sun = useMemo(() => {
    const o = new Astronomy.Observer(obs.lat, obs.lon, obs.elevationM ?? 0);
    const out: { d: number; set: number | null; rise: number | null }[] = [];
    for (let d = 0; d <= 365; d += 3) {
      const t0 = noonUT(d);
      const set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, o, -1, new Date(t0), 1);
      const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, o, +1, new Date(t0), 1);
      out.push({ d, set: set ? (set.date.getTime() - t0) / 3600000 : null, rise: rise ? (rise.date.getTime() - t0) / 3600000 : null });
    }
    return out;
  }, [obs.lat, obs.lon, obs.elevationM, std]); // eslint-disable-line react-hooks/exhaustive-deps

  const transits = useMemo(() => {
    const q = precessor(new Date(Date.UTC(2026, 6, 1)))(STARS[star].ra, STARS[star].dec);
    return Array.from({ length: 365 }, (_, d) => {
      const t0 = noonUT(d);
      return wrap360(q.ra - lstDeg(new Date(t0), obs.lon)) / 15.041; // hours after local standard noon
    });
  }, [star, obs.lon, std]); // eslint-disable-line react-hooks/exhaustive-deps

  // Daylight polygons: from noon down to sunset, and from sunrise down to the next noon.
  const sunsetPath = () => {
    const pts = sun.map((s) => `${x(s.d).toFixed(1)},${y(s.set === null ? (s.rise === null ? 24 : 0) : s.set).toFixed(1)}`);
    return `M ${x(0)} ${Y0} L ${pts.join(' L ')} L ${x(365)} ${Y0} Z`;
  };
  const sunrisePath = () => {
    const pts = sun.map((s) => `${x(s.d).toFixed(1)},${y(s.rise === null ? (s.set === null ? 24 : 24) : s.rise).toFixed(1)}`);
    return `M ${x(0)} ${Y1} L ${pts.join(' L ')} L ${x(365)} ${Y1} Z`;
  };
  const dark = (d: number, h: number) => {
    const s = sun[Math.min(sun.length - 1, Math.round(d / 3))];
    if (s.set === null || s.rise === null) return s.set === null && s.rise === null ? false : s.set === null ? false : true;
    return h > s.set && h < s.rise;
  };
  // Line in pieces: break at the yearly wrap and switch style between darkness and daylight.
  const segs: { d: string; darkSeg: boolean }[] = [];
  let cur: string[] = [], curDark = dark(0, transits[0]);
  for (let d = 0; d < 365; d++) {
    const h = transits[d];
    const dk = dark(d, h);
    const wrapped = d > 0 && Math.abs(h - transits[d - 1]) > 12;
    if (wrapped || dk !== curDark) {
      if (!wrapped) cur.push(`${x(d).toFixed(1)},${y(h).toFixed(1)}`);
      if (cur.length > 1) segs.push({ d: `M ${cur.join(' L ')}`, darkSeg: curDark });
      cur = [];
      curDark = dk;
    }
    cur.push(`${x(d).toFixed(1)},${y(h).toFixed(1)}`);
  }
  if (cur.length > 1) segs.push({ d: `M ${cur.join(' L ')}`, darkSeg: curDark });

  const dd = Math.round(day) % 365;
  const h = transits[dd];
  const later = (dd + 30) % 365;
  const diffMin = Math.round(((transits[dd] - transits[later] + 24) % 24) * 60);
  const top = culmination(STARS[star].dec, obs.lat);
  const isDark = dark(dd, h);

  const text =
    top.alt <= 0
      ? `${star} never rises at ${placeName(obs)}, so it is never seen there, though the clock time of its meridian crossing still moves the same way.`
      : `On ${fmtDay(dd)} ${star} is highest at ${clock(h)} standard time, ${top.alt.toFixed(0)}° up in the ${top.side === 'overhead' ? 'zenith' : top.side}, ${isDark ? 'in darkness' : 'in daylight, so it cannot be seen then'}. A month later, on ${fmtDay(later)}, it is highest at ${clock(transits[later])}: ${Math.floor(diffMin / 60)} h ${String(diffMin % 60).padStart(2, '0')} min earlier.`;

  return (
    <div>
      <Svg w={W} h={H} title={meta.title} desc={`Chart for ${placeName(obs)}: days of the year across, clock time down from noon to the next noon. Daylight is shaded at the top and bottom; a sloping line shows when ${star} is highest each day, about 4 minutes earlier every day.`}>
        <path d={sunsetPath()} fill={C.sun} fillOpacity={0.2} />
        <path d={sunrisePath()} fill={C.sun} fillOpacity={0.2} />
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((hh) => (
          <g key={hh}>
            <line x1={X0} x2={X1} y1={y(hh)} y2={y(hh)} stroke={hh === 9 ? C.lineStrong : C.line} strokeDasharray={hh === 9 ? '6 4' : undefined} />
            <Label x={X0 - 8} y={y(hh) + 4} anchor="end" size="s" color={hh === 9 || hh === 12 ? C.text : C.dim}>{['noon', '3 pm', '6 pm', '9 pm', 'midnight', '3 am', '6 am', '9 am', 'noon'][hh / 3]}</Label>
          </g>
        ))}
        {MDAY.map((m, i) => <Label key={i} x={x(m + 15)} y={Y1 + 18} anchor="middle" size="s" color={C.dim}>{MON[i]}</Label>)}
        {MDAY.map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={Y0} y2={Y1} stroke={C.line} strokeOpacity={0.5} />)}
        <Label x={x(182)} y={y(1.6)} anchor="middle" size="s" color={C.dim}>daylight</Label>
        <Label x={x(182)} y={y(23.0)} anchor="middle" size="s" color={C.dim}>daylight</Label>
        {segs.map((s, i) => <path key={i} d={s.d} fill="none" stroke={C.amber} strokeWidth={s.darkSeg ? 3 : 1.6} strokeOpacity={s.darkSeg ? 1 : 0.45} strokeDasharray={s.darkSeg ? undefined : '4 4'} />)}
        <line x1={x(dd)} x2={x(dd)} y1={Y0} y2={Y1} stroke={C.text} strokeOpacity={0.35} />
        <circle cx={x(dd)} cy={y(h)} r={6.5} fill={C.amber} stroke={C.bg} strokeWidth={2} />
        <circle cx={x(later)} cy={y(transits[later])} r={4.5} fill="none" stroke={C.amber} strokeWidth={1.6} />
        <Label x={X1} y={Y0 - 12} anchor="end" size="s" color={C.dim}>{`${placeName(obs)}, standard time (${stdLabel}), no daylight saving`}</Label>
        <Label x={X0} y={Y0 - 12} size="s" color={C.amber} weight={600}>{`when ${star} is highest`}</Label>
      </Svg>
      <Controls>
        <ChoiceControl label="Star" value={star} options={(Object.keys(STARS) as StarId[]).map((k) => ({ value: k, label: k }))} onChange={setStar} />
        <RangeControl label="Date" value={dd} min={0} max={364} step={1} onChange={setDay} format={fmtDay} />
      </Controls>
      <Readout>{text}</Readout>
    </div>
  );
}
