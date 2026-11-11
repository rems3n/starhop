/**
 * Where the Sun rises and sets through the year, computed with astronomy-engine for the learner's location.
 * Left: a map of the horizon seen from above (north up, east right) with today's sunrise and sunset directions,
 * the range they swing through over the year, and the noon Sun (due south north of the tropics, due north south of
 * them) with the shadow pointing the other way.
 * Right: a graph of the sunrise direction through the year. The learner drags the date.
 */
import { useMemo, useState } from 'react';
import { Body, Equator, Horizon, Observer as AeObserver, SearchHourAngle, SearchRiseSet, type AstroTime } from 'astronomy-engine';
import { useSettings } from '@/store/settings';
import { C, Controls, Label, RangeControl, Readout, Svg, rad, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Where the Sun rises and sets through the year',
  summary: 'Compass map and year graph of sunrise and sunset directions for your location; drag the date and see where the noon Sun stands and where its shadow points.',
  params: { day: 'starting day of the year, 0–364 (default: today)' },
};

function zonedMidnight(y: number, doy: number, tz: string): Date {
  const naive = Date.UTC(y, 0, 1 + doy, 0);
  const off = (t: number) => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(t));
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(t / 60000) * 60000;
  };
  let t = naive - off(naive);
  t = naive - off(t);
  return new Date(t);
}

interface SunDay {
  rise: AstroTime | null;
  set: AstroTime | null;
  riseAz: number | null;
  setAz: number | null;
  noon: AstroTime;
  noonAlt: number;
  noonAz: number;
}
function sunDay(obs: AeObserver, start: Date): SunDay {
  const az = (t: AstroTime | null) => {
    if (!t) return null;
    const eq = Equator(Body.Sun, t, obs, true, true);
    return Horizon(t, obs, eq.ra, eq.dec, 'normal').azimuth;
  };
  const rise = SearchRiseSet(Body.Sun, obs, +1, start, 1);
  const set = SearchRiseSet(Body.Sun, obs, -1, start, 1);
  const tr = SearchHourAngle(Body.Sun, obs, 0, start);
  return { rise, set, riseAz: az(rise), setAz: az(set), noon: tr.time, noonAlt: tr.hor.altitude, noonAz: tr.hor.azimuth };
}

const CX = 190, CY = 200, R = 140;
const map = (az: number, r = R): [number, number] => [CX + r * Math.sin(rad(az)), CY - r * Math.cos(rad(az))];
const GX0 = 430, GX1 = 690, GY0 = 70, GY1 = 310;
const AZ_TOP = 50, AZ_BOT = 130;
const gx = (doy: number) => GX0 + (doy / 365) * (GX1 - GX0);
const gy = (az: number) => GY0 + ((az - AZ_TOP) / (AZ_BOT - AZ_TOP)) * (GY1 - GY0);

export default function SunriseDirections({ params }: DiagramProps) {
  const observer = useSettings((s) => s.observer);
  const year = new Date().getFullYear();
  const today = Math.floor((Date.now() - Date.UTC(year, 0, 1)) / 86400000);
  const [day, setDay] = useState(typeof params?.day === 'number' ? (params.day as number) : Math.min(364, Math.max(0, today)));
  const obs = useMemo(() => new AeObserver(observer.lat, observer.lon, observer.elevationM ?? 0), [observer.lat, observer.lon, observer.elevationM]);

  const yearCurve = useMemo(() => {
    const pts: { doy: number; rise: number | null; set: number | null }[] = [];
    for (let d = 0; d <= 365; d += 5) {
      const s = sunDay(obs, zonedMidnight(year, d, observer.tz));
      pts.push({ doy: d, rise: s.riseAz, set: s.setAz });
    }
    return pts;
  }, [obs, year, observer.tz]);
  const now = useMemo(() => sunDay(obs, zonedMidnight(year, day, observer.tz)), [obs, year, day, observer.tz]);

  const rises = yearCurve.map((p) => p.rise).filter((v): v is number => v !== null);
  const sets = yearCurve.map((p) => p.set).filter((v): v is number => v !== null);
  const riseMin = Math.min(...rises), riseMax = Math.max(...rises);
  const setMin = Math.min(...sets), setMax = Math.max(...sets);

  const fmtTime = (t: AstroTime | null) => (t ? new Intl.DateTimeFormat('en-US', { timeZone: observer.tz, hour: 'numeric', minute: '2-digit' }).format(t.date).replace('AM', 'a.m.').replace('PM', 'p.m.') : '—');
  const date = new Date(Date.UTC(year, 0, 1 + day));
  const dateLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  const short = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const side = (az: number, base: number, a: string, b: string) => {
    const d = Math.round(az - base);
    return Math.abs(d) <= 1 ? `due ${base === 90 ? 'east' : 'west'}` : `${Math.abs(d)}° ${d < 0 ? a : b} of ${base === 90 ? 'east' : 'west'}`;
  };
  const wedge = (a0: number, a1: number) => {
    const [x0, y0] = map(a0), [x1, y1] = map(a1);
    return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`;
  };
  const shadowLen = now.noonAlt > 0 ? Math.min(R - 20, 34 / Math.tan(rad(now.noonAlt))) : 0;
  const noonDir = now.noonAlt > 88 ? 'overhead' : Math.cos(rad(now.noonAz)) < 0 ? 'south' : 'north';
  const shadowAz = noonDir === 'south' ? 0 : 180;
  const sunMark = map(noonDir === 'north' ? 0 : 180, R - 34);
  const [sx, sy] = map(shadowAz, shadowLen);
  const curvePath = (k: 'rise') => `M ${yearCurve.filter((p) => p[k] !== null).map((p) => `${gx(p.doy).toFixed(1)},${gy(p[k] as number).toFixed(1)}`).join(' L ')}`;

  return (
    <div>
      <Svg w={720} h={400} title={meta.title} desc="Left: a compass map of the horizon seen from above with north at the top. Sunrise directions swing through a wedge on the eastern side during the year and sunset directions through a matching wedge on the western side; the noon Sun stands due south (or due north in the southern hemisphere) and the shadow points the other way. Right: a graph of the sunrise direction through the year, north of east in summer and south of east in winter.">
        {/* compass */}
        <circle cx={CX} cy={CY} r={R} fill={C.panel} stroke={C.lineStrong} strokeWidth={1.5} />
        <path d={wedge(riseMin, riseMax)} fill={C.sun} opacity={0.2} />
        <path d={wedge(setMin, setMax)} fill={C.sun} opacity={0.2} />
        {Array.from({ length: 24 }, (_, i) => {
          const [x0, y0] = map(i * 15, R - (i % 6 === 0 ? 12 : 6));
          const [x1, y1] = map(i * 15);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={C.lineStrong} />;
        })}
        {[
          [0, 'N'],
          [90, 'E'],
          [180, 'S'],
          [270, 'W'],
        ].map(([az, t]) => {
          const [x, y] = map(az as number, R + 16);
          return (
            <Label key={t as string} x={x} y={y + 5} anchor="middle" weight={700} color={t === 'N' ? C.amber : C.text}>
              {t as string}
            </Label>
          );
        })}
        {/* rise / set rays */}
        {now.riseAz !== null && (
          <g>
            <line x1={CX} y1={CY} x2={map(now.riseAz, R - 14)[0]} y2={map(now.riseAz, R - 14)[1]} stroke={C.sun} strokeWidth={2.5} />
            <circle cx={map(now.riseAz)[0]} cy={map(now.riseAz)[1]} r={10} fill={C.sun} />
            <Label x={map(now.riseAz, R + 14)[0] + 4} y={map(now.riseAz, R + 14)[1] + (now.riseAz < 90 ? -4 : 16)} color={C.sun} weight={600}>
              sunrise
            </Label>
          </g>
        )}
        {now.setAz !== null && (
          <g>
            <line x1={CX} y1={CY} x2={map(now.setAz, R - 14)[0]} y2={map(now.setAz, R - 14)[1]} stroke={C.sun} strokeWidth={2.5} strokeDasharray="6 4" />
            <circle cx={map(now.setAz)[0]} cy={map(now.setAz)[1]} r={10} fill={C.sun} opacity={0.7} />
            <Label x={map(now.setAz, R + 14)[0] - 4} y={map(now.setAz, R + 14)[1] + (now.setAz > 270 ? -4 : 16)} anchor="end" color={C.sun} weight={600}>
              sunset
            </Label>
          </g>
        )}
        {/* noon sun and shadow */}
        <circle cx={sunMark[0]} cy={sunMark[1]} r={7} fill={C.sun} />
        <Label x={sunMark[0] + 12} y={sunMark[1] + 4} size="s" color={C.sun}>
          {`noon, ${Math.round(now.noonAlt)}° up`}
        </Label>
        {shadowLen > 4 && <line x1={CX} y1={CY} x2={sx} y2={sy} stroke={C.dim} strokeWidth={5} strokeLinecap="round" opacity={0.8} />}
        {shadowLen > 26 && (
          <Label x={CX + 8} y={(CY + sy) / 2 + (shadowAz === 0 ? 0 : 10)} size="s" color={C.dim}>
            noon shadow
          </Label>
        )}
        <circle cx={CX} cy={CY} r={5} fill={C.text} />
        <Label x={CX} y={CY + 20} anchor="middle" size="s" color={C.dim}>
          you
        </Label>
        <Label x={CX} y={30} anchor="middle" size="s" color={C.dim}>
          {`Horizon seen from above, ${observer.name}`}
        </Label>

        {/* year graph of sunrise direction */}
        <Label x={GX0} y={GY0 - 22} size="s" color={C.dim}>
          sunrise direction through the year
        </Label>
        {[60, 90, 120].map((az) => (
          <g key={az}>
            <line x1={GX0} x2={GX1} y1={gy(az)} y2={gy(az)} stroke={az === 90 ? C.lineStrong : C.line} strokeDasharray={az === 90 ? undefined : '3 4'} />
            <Label x={GX1 + 4} y={gy(az) + 4} size="s" color={C.dim}>
              {az === 90 ? 'E' : `${Math.abs(az - 90)}°`}
            </Label>
          </g>
        ))}
        <Label x={GX0 + 4} y={gy(60) - 8} size="s" color={C.dim}>
          north of east
        </Label>
        <Label x={GX0 + 4} y={gy(120) + 18} size="s" color={C.dim}>
          south of east
        </Label>
        <path d={curvePath('rise')} fill="none" stroke={C.sun} strokeWidth={2.5} />
        {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => (
          <Label key={i} x={gx(Date.UTC(year, i, 15) / 86400000 - Date.UTC(year, 0, 1) / 86400000)} y={GY1 + 20} anchor="middle" size="s" color={C.dim}>
            {m}
          </Label>
        ))}
        {now.riseAz !== null && (
          <g>
            <line x1={gx(day)} x2={gx(day)} y1={GY0} y2={GY1} stroke={C.text} strokeOpacity={0.35} />
            <circle cx={gx(day)} cy={gy(now.riseAz)} r={6} fill={C.sun} stroke={C.bg} strokeWidth={2} />
          </g>
        )}
        <Label x={(GX0 + GX1) / 2} y={GY1 + 44} anchor="middle" size="s" color={C.dim}>
          {short}
        </Label>
        <rect x={GX0} y={GY1 + 58} width={14} height={10} fill={C.sun} opacity={0.25} />
        <Label x={GX0 + 20} y={GY1 + 68} size="s" color={C.dim}>
          shaded on the map: the whole year's range
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Date" value={day} min={0} max={364} step={1} onChange={setDay} format={() => short} />
      </Controls>
      <Readout>
        {now.rise && now.set && now.riseAz !== null && now.setAz !== null
          ? `On ${dateLabel} the Sun rises at ${fmtTime(now.rise)}, ${side(now.riseAz, 90, 'north', 'south')}; it is highest at ${fmtTime(now.noon)}, ${noonDir === 'overhead' ? 'almost straight overhead' : `due ${noonDir} and ${Math.round(now.noonAlt)}° up, when shadows point due ${noonDir === 'south' ? 'north' : 'south'}`}; it sets at ${fmtTime(now.set)}, ${side(now.setAz, 270, 'south', 'north')}.`
          : `On ${dateLabel} the Sun does not rise or set here.`}
      </Readout>
    </div>
  );
}
