/**
 * A real retrograde loop on the sky. Daily geocentric positions (astronomy-engine, J2000 ecliptic coordinates)
 * of Mars around its 19 February 2027 opposition, or Jupiter (opposition 10 February 2027) or Saturn
 * (17 October 2027), drawn against the background stars at the same scale for all three, east to the left as
 * seen facing the planet. Stationary points and opposition are found from the data.
 */
import { useMemo, useState } from 'react';
import { Body } from 'astronomy-engine';
import { C, ChoiceControl, Controls, Label, PlayButton, RangeControl, Readout, Svg, useAnimatedValue, type DiagramMeta, type DiagramProps } from '../kit';
import { eqToEcl, geoEcl, norm180, useObserver } from './ecliptic-common';

export const meta: DiagramMeta = {
  title: 'A retrograde loop among the stars',
  summary: 'The real path of Mars (2026–27), Jupiter (2026–27) or Saturn (2027) against the stars, day by day; play it to watch the planet stop, back up and turn again.',
  params: { planet: '"mars" | "jupiter" | "saturn" (default "mars")' },
};

// Stars (J2000 RA°, Dec°, mag) from public/data/stars.json; names only where shown.
const LEO_STARS: [string, number, number, number][] = [
  ['Regulus', 152.093, 11.967, 1.36], ['Algieba', 154.993, 19.841, 2.01], ['Denebola', 177.265, 14.572, 2.14], ['Zosma', 168.527, 20.524, 2.56],
  ['', 146.463, 23.774, 2.97], ['', 133.848, 5.946, 3.11], ['Chertan', 168.56, 15.43, 3.33], ['', 131.694, 6.419, 3.38], ['', 154.173, 23.417, 3.43],
  ['', 151.833, 16.763, 3.48], ['', 145.288, 9.892, 3.52], ['', 124.129, 9.186, 3.53], ['', 158.203, 9.307, 3.84], ['', 148.191, 26.007, 3.88],
  ['', 131.171, 18.154, 3.94], ['', 170.981, 10.53, 4.0], ['', 176.465, 6.529, 4.04], ['', 170.284, 6.029, 4.05], ['', 134.622, 11.858, 4.26],
  ['', 163.903, 24.75, 4.3], ['', 142.93, 22.968, 4.32], ['', 132.108, 5.838, 4.35], ['', 151.976, 9.998, 4.39], ['', 165.582, 20.18, 4.42],
  ['', 169.165, -3.652, 4.45], ['', 141.164, 26.182, 4.47], ['', 151.984, -0.372, 4.48], ['', 130.82, 21.47, 4.66], ['', 131.674, 28.76, 4.03],
];
const LEO_LINES: [number, number][][] = [
  [[152.09, 11.97], [151.83, 16.76], [154.99, 19.84], [168.53, 20.52], [177.26, 14.57], [168.56, 15.43], [152.09, 11.97]],
  [[154.99, 19.84], [154.17, 23.42], [148.19, 26.01], [146.46, 23.77]],
  [[134.62, 11.86], [131.17, 18.15], [130.82, 21.47], [131.67, 28.76]],
  [[131.17, 18.15], [124.13, 9.19]],
];
const PSC_STARS: [string, number, number, number][] = [
  ['Hamal', 31.79, 23.46, 2.01], ['Sheratan', 28.66, 20.81, 2.64], ['', 17.15, -10.18, 3.46], ['', 40.83, 3.24, 3.47], ['', 4.86, -8.82, 3.56],
  ['', 21.01, -8.18, 3.6], ['', 22.87, 15.35, 3.62], ['', 27.87, -10.34, 3.74], ['Alrescha', 30.51, 2.76, 3.82], ['', 28.38, 19.29, 3.88],
  ['', 44.11, -8.9, 3.89], ['', 359.83, 6.86, 4.03], ['', 39.87, 0.33, 4.08], ['', 26.35, 9.16, 4.26], ['', 15.74, 7.89, 4.27], ['', 41.24, 10.11, 4.27],
  ['', 37.04, 8.46, 4.3], ['', 33.25, 8.85, 4.36], ['', 0.49, -6.01, 4.37], ['', 12.17, 7.59, 4.44], ['', 25.36, 5.49, 4.45], ['', 355.51, 1.78, 4.49],
  ['', 1.33, -5.71, 4.61], ['', 28.39, 3.19, 4.61], ['', 17.86, 21.03, 4.66], ['', 27.4, -10.69, 4.66], ['', 22.55, 6.14, 4.84], ['', 13.25, -1.14, 4.78],
];
const PSC_LINES: [number, number][][] = [
  [[17.86, 21.03], [22.87, 15.35], [26.35, 9.16], [30.51, 2.76], [28.39, 3.19], [25.36, 5.49], [22.55, 6.14], [18.43, 7.58], [15.74, 7.89], [12.17, 7.59], [359.83, 6.86], [354.99, 5.63]],
  [[42.5, 27.26], [31.79, 23.46], [28.66, 20.81], [28.38, 19.29]],
];

const PL = {
  mars: { name: 'Mars', body: Body.Mars, from: '2026-10-15', to: '2027-06-10', lon: 144.5, lat: 5, stars: LEO_STARS, lines: LEO_LINES, con: 'Leo and Cancer', color: C.red },
  jupiter: { name: 'Jupiter', body: Body.Jupiter, from: '2026-10-15', to: '2027-06-10', lon: 142, lat: 5, stars: LEO_STARS, lines: LEO_LINES, con: 'Leo and Cancer', color: '#e3c89a' },
  saturn: { name: 'Saturn', body: Body.Saturn, from: '2027-06-15', to: '2028-02-10', lon: 24, lat: 0, stars: PSC_STARS, lines: PSC_LINES, con: 'Pisces', color: '#e8d590' },
} as const;
const W = 720, H = 360, S = 15, PX = 360, PY = 170;

export default function MarsLoopSky({ params }: DiagramProps) {
  const init = (typeof params?.planet === 'string' && params.planet in PL ? params.planet : 'mars') as keyof typeof PL;
  const [pk, setPk] = useState<keyof typeof PL>(init);
  const tz = useObserver().tz;
  const P = PL[pk];
  const data = useMemo(() => {
    const t0 = Date.parse(`${P.from}T05:00:00Z`), t1 = Date.parse(`${P.to}T05:00:00Z`);
    const days = Math.round((t1 - t0) / 86400000);
    const pts = Array.from({ length: days + 1 }, (_, i) => {
      const d = new Date(t0 + i * 86400000);
      const e = geoEcl(P.body, d);
      const sun = geoEcl(Body.Sun, d);
      return { d, lon: e.lon, lat: e.lat, dist: e.dist, opp: Math.abs(norm180(e.lon - sun.lon - 180)) };
    });
    const stations: number[] = [];
    for (let i = 2; i < pts.length; i++) {
      const a = norm180(pts[i - 1].lon - pts[i - 2].lon), b = norm180(pts[i].lon - pts[i - 1].lon);
      if (Math.sign(a) !== Math.sign(b)) stations.push(i - 1);
    }
    let opp = 0;
    pts.forEach((p, i) => { if (p.opp < pts[opp].opp) opp = i; });
    // Refine to the hour: the longitude extreme at each station, and the moment of opposition.
    const hourly = (i: number, f: (d: Date) => number, pick: 'max' | 'min') => {
      let best = pts[Math.max(0, i - 1)].d, bv = pick === 'max' ? -Infinity : Infinity;
      const ref = pts[i].lon;
      for (let h = -30; h <= 30; h++) {
        const d = new Date(pts[i].d.getTime() + h * 3600000);
        const v = f(d) - ref;
        const vv = norm180(v);
        if (pick === 'max' ? vv > bv : vv < bv) { bv = vv; best = d; }
      }
      return best;
    };
    const stationDates = stations.map((j, n) => {
      const rising = norm180(pts[j].lon - pts[j - 1].lon) > 0;
      void n;
      return hourly(j, (d) => geoEcl(P.body, d).lon, rising ? 'max' : 'min');
    });
    let oppDate = pts[opp].d, ob = Infinity;
    for (let h = -30; h <= 30; h++) {
      const d = new Date(pts[opp].d.getTime() + h * 3600000);
      const v = Math.abs(norm180(geoEcl(P.body, d).lon - geoEcl(Body.Sun, d).lon - 180));
      if (v < ob) { ob = v; oppDate = d; }
    }
    const stars = P.stars.map(([n, ra, dec, mag]) => ({ n, mag, ...eqToEcl(ra, dec) }));
    const lines = P.lines.map((l) => l.map(([ra, dec]) => eqToEcl(ra, dec)));
    return { pts, stations, stationDates, opp, oppDate, stars, lines };
  }, [P]);
  const [playing, setPlaying] = useState(false);
  const [i, setI] = useAnimatedValue(0, playing, 22, [0, data.pts.length - 1]);
  const k = Math.min(data.pts.length - 1, Math.max(0, Math.round(i)));
  const x = (lon: number) => PX - norm180(lon - P.lon) * S;
  const y = (lat: number) => PY - (lat - P.lat) * S;
  const path = (a: number, b: number) => data.pts.slice(a, b + 1).map((p, j) => `${j ? 'L' : 'M'} ${x(p.lon).toFixed(1)} ${y(p.lat).toFixed(1)}`).join(' ');
  const cur = data.pts[k];
  const wk = Math.min(data.pts.length - 1, k + 7);
  const rate = norm180(data.pts[wk].lon - data.pts[Math.max(0, wk - 7)].lon);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz });
  const [s1, s2] = data.stations;
  const retro = s1 !== undefined && s2 !== undefined && k > s1 && k < s2;
  const span = s1 !== undefined && s2 !== undefined ? Math.abs(norm180(data.pts[s2].lon - data.pts[s1].lon)) : 0;
  const monthTicks = data.pts.map((p, j) => ({ p, j })).filter(({ p }) => p.d.getUTCDate() === 1);

  return (
    <div>
      <Svg w={W} h={H} title={meta.title} desc={`${P.name}'s path through ${P.con} from ${fmt(data.pts[0].d)} to ${fmt(data.pts[data.pts.length - 1].d)}: it moves east, stops, moves west for about ${span.toFixed(0)} degrees around opposition, stops again and resumes moving east.`}>
        <defs>
          <clipPath id="mls-clip">
            <rect x={8} y={8} width={W - 16} height={H - 16} rx={8} />
          </clipPath>
        </defs>
        <g clipPath="url(#mls-clip)">
          <line x1={0} y1={y(0)} x2={W} y2={y(0)} stroke={C.amber} strokeDasharray="6 6" opacity={0.45} />
          <Label x={16} y={y(0) - 6} size="s" color={C.amber}>
            ecliptic
          </Label>
          {data.lines.map((l, j) => (
            <polyline key={j} points={l.map((p) => `${x(p.lon)},${y(p.lat)}`).join(' ')} fill="none" stroke={C.blue} strokeOpacity={0.35} />
          ))}
          {data.stars.map((s, j) => (
            <g key={j}>
              <circle cx={x(s.lon)} cy={y(s.lat)} r={Math.max(1, 4.2 - s.mag * 0.8)} fill={C.star} />
              {s.n && (
                <Label x={x(s.lon) + (pk === 'jupiter' && s.n === 'Regulus' ? -7 : 7)} y={y(s.lat) - 6} anchor={pk === 'jupiter' && s.n === 'Regulus' ? 'end' : 'start'} size="s" color={C.dim}>
                  {s.n}
                </Label>
              )}
            </g>
          ))}
          {/* Whole path faint, travelled part bright */}
          <path d={path(0, data.pts.length - 1)} fill="none" stroke={P.color} strokeOpacity={0.3} strokeDasharray="3 4" strokeWidth={1.5} />
          <path d={path(0, k)} fill="none" stroke={P.color} strokeWidth={2.4} />
          {monthTicks.map(({ p, j }) => {
            const near = [...data.stations, data.opp].some((q) => Math.abs(q - j) < 12);
            const inLoop = s1 !== undefined && s2 !== undefined && j > s1 && j < s2;
            return (
              <g key={j}>
                <circle cx={x(p.lon)} cy={y(p.lat)} r={2.5} fill={P.color} />
                {!near && pk === 'mars' && (
                  <Label x={x(p.lon)} y={y(p.lat) + (inLoop ? -10 : 20)} anchor="middle" size="s" color={j <= k ? C.text : C.faint}>
                    {p.d.toLocaleDateString('en-US', { month: 'short', timeZone: tz })}
                  </Label>
                )}
              </g>
            );
          })}
          {data.stations.map((j, n) => (
            <g key={j}>
              <circle cx={x(data.pts[j].lon)} cy={y(data.pts[j].lat)} r={6} fill="none" stroke={C.good} strokeWidth={1.5} />
              <Label x={x(data.pts[j].lon) + (pk === 'mars' ? 0 : n === 0 ? -8 : 8)} y={y(data.pts[j].lat) + 24} anchor={pk === 'mars' ? 'middle' : n === 0 ? 'end' : 'start'} size="s" color={C.good}>
                {`stops ${data.stationDates[n].toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })}`}
              </Label>
            </g>
          ))}
          <circle cx={x(data.pts[data.opp].lon)} cy={y(data.pts[data.opp].lat)} r={3} fill={C.amber} />
          <Label x={x(data.pts[data.opp].lon)} y={y(data.pts[data.opp].lat) - (pk === 'mars' ? 14 : 22)} anchor="middle" size="s" color={C.amber}>
            {`opposition ${data.oppDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })}`}
          </Label>
          {/* The planet now: bigger when closer */}
          <circle cx={x(cur.lon)} cy={y(cur.lat)} r={Math.min(10, 4 + 3 / cur.dist)} fill={P.color} stroke={C.bg} strokeWidth={2} />
        </g>
        <Label x={16} y={30} size="s" color={C.dim}>
          ← east
        </Label>
        <Label x={W - 16} y={30} anchor="end" size="s" color={C.dim}>
          west →
        </Label>
        <Label x={W - 16} y={H - 16} anchor="end" size="s" color={C.faint}>
          {`real positions · same scale for all three planets · 10° = ${(10 * S).toFixed(0)} px`}
        </Label>
        <line x1={16} y1={H - 22} x2={16 + 10 * S} y2={H - 22} stroke={C.lineStrong} strokeWidth={2} />
        <Label x={16 + 5 * S} y={H - 28} anchor="middle" size="s" color={C.dim}>
          10° (one fist)
        </Label>
      </Svg>
      <Controls>
        <ChoiceControl
          label="Planet"
          value={pk}
          options={[
            { value: 'mars', label: 'Mars 2027' },
            { value: 'jupiter', label: 'Jupiter 2027' },
            { value: 'saturn', label: 'Saturn 2027' },
          ]}
          onChange={(v) => { setPk(v); setI(0); setPlaying(false); }}
        />
        <RangeControl label="Date" value={k} min={0} max={data.pts.length - 1} onChange={(v) => { setPlaying(false); setI(v); }} format={() => fmt(cur.d)} />
        <PlayButton playing={playing} onToggle={() => { if (k >= data.pts.length - 1) setI(0); setPlaying((p) => !p); }} />
      </Controls>
      <Readout>
        {`${fmt(cur.d)}: ${P.name} is moving ${Math.abs(rate) < 0.15 ? 'hardly at all: it is near a stationary point' : `${rate > 0 ? 'east' : 'west'} about ${Math.abs(rate).toFixed(1)}° a week`}${retro ? ' (retrograde)' : ''}, ${(cur.dist * 149.6).toFixed(0)} million km from Earth. `}
        {`This time its backward stretch covers ${span.toFixed(0)}° of sky and lasts ${s1 !== undefined && s2 !== undefined ? s2 - s1 : 0} days, centred on opposition.`}
      </Readout>
    </div>
  );
}
