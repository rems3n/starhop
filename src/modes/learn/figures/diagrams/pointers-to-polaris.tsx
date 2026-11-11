/**
 * Facing the pole: pointer stars aim at the celestial pole whatever the time or season.
 * Northern hemisphere: the Big Dipper's Pointers (Merak → Dubhe) lead to Polaris.
 * Southern hemisphere: the long axis of the Southern Cross (Gacrux → Acrux) leads to the south celestial pole,
 * which has no bright star.
 * Star positions are real (J2000 catalog coordinates turned into altitude/azimuth with astronomy-engine for the
 * learner's location from settings). The learner changes the month and the clock and watches the pattern wheel
 * around the pole while the pole itself stays fixed above the north (or south) point of the horizon.
 */
import { useId, useMemo, useState } from 'react';
import { Body, Equator, Horizon, Observer as AeObserver } from 'astronomy-engine';
import { useSettings } from '@/store/settings';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, clamp, rad, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'From the pointer stars to the pole',
  summary: 'The polar sky from your location (Big Dipper and Polaris in the north, Southern Cross in the south); change the month and the time and see the pointers keep aiming at the pole.',
  params: { month: 'starting month, 1 | 4 | 7 | 10 (default 4)', hour: 'starting local clock hour, 18–30 where 24+ is after midnight (default 21)' },
};

type V3 = [number, number, number];
type StarSet = Record<string, [number, number, number]>;
// name: [ra°, dec°, mag] from public/data/stars.json (HYG, J2000)
const NORTH: StarSet = {
  Dubhe: [165.93233, 61.75103, 1.81], Merak: [165.46016, 56.38243, 2.34], Phecda: [178.45752, 53.69476, 2.41], Megrez: [183.85629, 57.03262, 3.32],
  Alioth: [193.50708, 55.95982, 1.76], Mizar: [200.98121, 54.92536, 2.23], Alkaid: [206.88531, 49.31327, 1.85],
  Polaris: [37.94625, 89.26411, 1.97], Yildun: [263.05377, 86.58646, 4.35], epsUMi: [251.49239, 82.03726, 4.21], zetUMi: [236.01449, 77.79449, 4.29],
  etaUMi: [244.37687, 75.75533, 4.95], Pherkad: [230.18225, 71.83402, 3.0], Kochab: [222.67658, 74.15551, 2.07],
  Caph: [2.29331, 59.14978, 2.28], Schedar: [10.12674, 56.53733, 2.24], gamCas: [14.17715, 60.71674, 2.15], Ruchbah: [21.45324, 60.23528, 2.66], Segin: [28.59876, 63.6701, 3.35],
};
const NORTH_LINES = [
  ['Alkaid', 'Mizar', 'Alioth', 'Megrez', 'Phecda', 'Merak', 'Dubhe', 'Megrez'],
  ['Polaris', 'Yildun', 'epsUMi', 'zetUMi', 'etaUMi', 'Pherkad', 'Kochab', 'zetUMi'],
  ['Caph', 'Schedar', 'gamCas', 'Ruchbah', 'Segin'],
];
const SOUTH: StarSet = {
  Acrux: [186.64967, -63.09909, 0.77], Mimosa: [191.93039, -59.68876, 1.25], Gacrux: [187.79144, -57.11321, 1.59], Imai: [183.78641, -58.74893, 2.79], Ginan: [185.34047, -60.40115, 3.59],
  Hadar: [210.95594, -60.37304, 0.61], Rigil: [219.91148, -60.83398, -0.01],
};
const SOUTH_LINES = [
  ['Gacrux', 'Acrux'],
  ['Imai', 'Mimosa'],
];

/** UTC instant of a local wall-clock time in an IANA zone. */
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

const vec = (ra: number, dec: number): V3 => [Math.cos(rad(dec)) * Math.cos(rad(ra)), Math.cos(rad(dec)) * Math.sin(rad(ra)), Math.sin(rad(dec))];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const toRaDec = (v: V3): [number, number] => [((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360, (Math.asin(clamp(v[2], -1, 1)) * 180) / Math.PI];
/** Points along the great circle from a through b, out to `deg` degrees from a. */
function greatCircle(a: V3, b: V3, deg: number, n = 40): V3[] {
  const d = dot(a, b);
  const p: V3 = [b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]];
  const l = Math.hypot(...p);
  const u: V3 = [p[0] / l, p[1] / l, p[2] / l];
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = rad((deg * i) / n);
    return [Math.cos(t) * a[0] + Math.sin(t) * u[0], Math.cos(t) * a[1] + Math.sin(t) * u[1], Math.cos(t) * a[2] + Math.sin(t) * u[2]] as V3;
  });
}

const W = 720, H = 400;
const CX = 360;

/** Stereographic projection centred on azimuth `faceAz` at altitude `cAlt`; the viewer's right is to the right. */
function makeProjection(faceAz: number, cAlt: number, S: number, CY: number) {
  const hv = (alt: number, az: number): V3 => [Math.cos(rad(alt)) * Math.cos(rad(az)), Math.cos(rad(alt)) * Math.sin(rad(az)), Math.sin(rad(alt))];
  const f = hv(cAlt, faceAz);
  const r: V3 = [-Math.sin(rad(faceAz)), Math.cos(rad(faceAz)), 0]; // up × forward: east when facing north
  const u: V3 = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  return (alt: number, az: number): [number, number] => {
    const p = hv(alt, az);
    const k = 2 / (1 + dot(p, f));
    return [CX + S * k * dot(p, r), CY - S * k * dot(p, u)];
  };
}

const MONTHS = [
  { value: '1', label: 'Jan' },
  { value: '4', label: 'Apr' },
  { value: '7', label: 'Jul' },
  { value: '10', label: 'Oct' },
];
const MONTH_NAME = ['', 'January', '', '', 'April', '', '', 'July', '', '', 'October'];

function clock(h: number) {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  const ap = hh >= 12 ? 'p.m.' : 'a.m.';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return hh === 0 && mm === 0 ? 'midnight' : `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
}

export default function PointersToPolaris({ params }: DiagramProps) {
  const observer = useSettings((s) => s.observer);
  const clipId = useId().replace(/:/g, '');
  const [month, setMonth] = useState(String(typeof params?.month === 'number' ? params.month : 4));
  const [hour, setHour] = useState(typeof params?.hour === 'number' ? (params.hour as number) : 21);
  const south = observer.lat < 0;
  const STARS = south ? SOUTH : NORTH;
  const LINES = south ? SOUTH_LINES : NORTH_LINES;
  const faceAz = south ? 180 : 0;
  const poleAlt = Math.abs(observer.lat);
  const cAlt = clamp(poleAlt * 0.55, 4, 40);
  const project = useMemo(() => makeProjection(faceAz, cAlt, 232, 250 + Math.max(0, cAlt - 22) * 2), [faceAz, cAlt]);

  const sky = useMemo(() => {
    const year = new Date().getFullYear();
    const date = zonedDate(year, Number(month), 15, hour, observer.tz);
    const obs = new AeObserver(observer.lat, observer.lon, observer.elevationM ?? 0);
    const hz = (ra: number, dec: number) => {
      const h = Horizon(date, obs, ra / 15, dec, 'normal');
      return { alt: h.altitude, az: h.azimuth };
    };
    const stars: Record<string, { alt: number; az: number; x: number; y: number; mag: number }> = {};
    for (const [n, [ra, dec, mag]] of Object.entries(STARS)) {
      const h = hz(ra, dec);
      const [x, y] = project(h.alt, h.az);
      stars[n] = { ...h, x, y, mag };
    }
    // Pointer line: north, Merak → Dubhe; south, Gacrux → Acrux (the Cross's long axis).
    const [n1, n2] = south ? ['Gacrux', 'Acrux'] : ['Merak', 'Dubhe'];
    const a = vec(STARS[n1][0], STARS[n1][1]);
    const b = vec(STARS[n2][0], STARS[n2][1]);
    const gap = (Math.acos(dot(a, b)) * 180) / Math.PI;
    const poleVec = vec(0, south ? -90 : 90);
    const reach = (Math.acos(dot(a, poleVec)) * 180) / Math.PI + 3;
    const ptr = greatCircle(a, b, reach).map((v) => {
      const [ra, dec] = toRaDec(v);
      const h = hz(ra, dec);
      return project(h.alt, h.az);
    });
    const ph = hz(0, south ? -90 : 90);
    const [px, py] = project(ph.alt, ph.az);
    const sunEq = Equator(Body.Sun, date, obs, true, true);
    const sun = Horizon(date, obs, sunEq.ra, sunEq.dec, 'normal').altitude;
    const horizon = Array.from({ length: 73 }, (_, i) => project(0, faceAz - 100 + (200 * i) / 72));
    return { stars, ptr, sun, horizon, gap, pole: { alt: ph.alt, az: ph.az, x: px, y: py }, poleDist: (Math.acos(dot(b, poleVec)) * 180) / Math.PI };
  }, [month, hour, observer.lat, observer.lon, observer.tz, observer.elevationM, STARS, project, south, faceAz]);

  const P = south ? sky.pole : sky.stars.Polaris;
  const night = sky.sun < -12;
  const daylight = sky.sun > -0.8;
  const starOpacity = night ? 1 : daylight ? 0.25 : 0.65;
  const size = (m: number) => Math.max(2, 6.4 - m * 1.05);

  // Where is the pattern relative to the pole, as seen on screen?
  const body = (south ? ['Acrux', 'Mimosa', 'Gacrux', 'Imai'] : ['Dubhe', 'Merak', 'Phecda', 'Megrez']).map((n) => sky.stars[n]);
  const bx = body.reduce((s, v) => s + v.x, 0) / 4 - P.x;
  const by = P.y - body.reduce((s, v) => s + v.y, 0) / 4;
  const ang = (Math.atan2(by, bx) * 180) / Math.PI; // 90 = above the pole
  const above = ang > 50 && ang < 130, below = ang < -50 && ang > -130, right = Math.abs(ang) <= 50;
  const where = south
    ? above ? 'high above the pole, standing upright' : below ? 'low, below the pole, upside down' : right ? 'to the right of the pole (southwest), lying on its side' : 'to the left of the pole (southeast), lying on its side'
    : above ? 'high above Polaris, upside down' : below ? 'low, below Polaris, the right way up' : right ? 'to the right of Polaris (northeast), standing on its handle' : 'to the left of Polaris (northwest), hanging from its handle';
  const minAlt = Math.min(...body.map((s) => s.alt));

  const ground = `M ${sky.horizon.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')} L ${W + 50},${H + 50} L -50,${H + 50} Z`;
  const poleLabelLeft = P.x > 470;
  const dir = south ? 'south' : 'north';

  /** Name a corner star, pushed radially away from the centre of its pattern so neighbours never collide. */
  const nameStar = (n: string, group: string[]) => {
    const s = sky.stars[n];
    const gx = group.reduce((a, k) => a + sky.stars[k].x, 0) / group.length;
    const gy = group.reduce((a, k) => a + sky.stars[k].y, 0) / group.length;
    const dx = s.x - gx, dy = s.y - gy;
    const l = Math.hypot(dx, dy) || 1;
    const lx = s.x + (dx / l) * 14, ly = s.y + (dy / l) * 14 + (dy > 0 ? 8 : 0);
    return (
      <Label key={n} x={lx} y={ly + 4} anchor={lx < s.x - 3 ? 'end' : lx > s.x + 3 ? 'start' : 'middle'} weight={600}>
        {n}
      </Label>
    );
  };
  const groupLabel = (star: string, text: string, dyAbove = -14, dyBelow = 24) => {
    const s = sky.stars[star];
    return (
      <Label x={s.x} y={s.y + (s.y > P.y ? dyBelow : dyAbove)} anchor="middle" size="s" color={C.dim}>
        {text}
      </Label>
    );
  };

  return (
    <div>
      <Svg
        w={W}
        h={H}
        title={meta.title}
        desc={
          south
            ? 'The southern sky seen from your location. The Southern Cross and its two pointer stars circle the south celestial pole, an empty-looking spot above the south point of the horizon; a dashed line along the long axis of the Cross runs to it.'
            : 'The northern sky seen from your location. Polaris sits above the north point of the horizon. The Big Dipper, the Little Dipper and Cassiopeia surround it, and a dashed line from the two Pointer stars at the end of the Dipper’s bowl runs straight to Polaris.'
        }
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={1} y={1} width={W - 2} height={H - 2} rx={10} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {daylight && <rect x={0} y={0} width={W} height={H} fill={C.blue} opacity={0.18} />}
          {!night && !daylight && <rect x={0} y={0} width={W} height={H} fill={C.blue} opacity={0.08} />}
          <path d={`M ${sky.ptr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')}`} fill="none" stroke={C.amber} strokeWidth={1.6} strokeDasharray="6 5" opacity={0.9} />
          {LINES.map((l, i) => (
            <polyline key={i} points={l.map((n) => `${sky.stars[n].x.toFixed(1)},${sky.stars[n].y.toFixed(1)}`).join(' ')} fill="none" stroke={C.lineStrong} strokeWidth={1.2} opacity={starOpacity} />
          ))}
          {Object.entries(sky.stars).map(([n, s]) => (
            <circle key={n} cx={s.x} cy={s.y} r={size(s.mag)} fill={n === 'Polaris' ? C.amber : C.star} opacity={starOpacity} />
          ))}
          <circle cx={P.x} cy={P.y} r={11} fill="none" stroke={C.amber} strokeWidth={1.5} strokeDasharray={south ? '3 3' : undefined} />
          <path d={ground} fill="#141a33" stroke={C.lineStrong} strokeWidth={1.5} />
          {(south
            ? [[180, 'S'], [135, 'SE'], [225, 'SW'], [90, 'E'], [270, 'W']]
            : [[0, 'N'], [45, 'NE'], [-45, 'NW'], [90, 'E'], [-90, 'W']]
          ).map(([az, t]) => {
            const [x, y] = project(0, az as number);
            const main = t === (south ? 'S' : 'N');
            return x > 20 && x < W - 20 ? (
              <g key={t as string}>
                <line x1={x} x2={x} y1={y} y2={y + 8} stroke={C.lineStrong} />
                <Label x={x} y={y + 24} anchor="middle" weight={main ? 700 : 500} color={main ? C.amber : C.dim}>
                  {t as string}
                </Label>
              </g>
            ) : null;
          })}
          {P.alt > 3 &&
            (() => {
              const [hx, hy] = project(0, P.az);
              return (
                <g>
                  <line x1={hx} x2={P.x} y1={hy} y2={P.y + 13} stroke={C.text} strokeOpacity={0.5} strokeDasharray="2 4" />
                  <Label x={hx + 8} y={(hy + P.y) / 2 + 4} size="s" color={C.dim}>
                    {`${Math.round(P.alt)}° up`}
                  </Label>
                </g>
              );
            })()}
          <Label x={poleLabelLeft ? P.x - 16 : P.x + 16} y={P.y - 6} anchor={poleLabelLeft ? 'end' : 'start'} color={C.amber} weight={700}>
            {south ? 'South celestial pole' : 'Polaris'}
          </Label>
          <Label x={poleLabelLeft ? P.x - 16 : P.x + 16} y={P.y + 10} anchor={poleLabelLeft ? 'end' : 'start'} size="s" color={C.dim}>
            {south ? 'no bright star marks it' : 'stays put'}
          </Label>
          {south ? (
            <>
              {nameStar('Acrux', ['Acrux', 'Mimosa', 'Gacrux', 'Imai'])}
              {nameStar('Gacrux', ['Acrux', 'Mimosa', 'Gacrux', 'Imai'])}
              {groupLabel('Imai', 'Southern Cross')}
              {groupLabel('Hadar', 'Pointers')}
            </>
          ) : (
            <>
              {nameStar('Dubhe', ['Dubhe', 'Merak', 'Phecda', 'Megrez'])}
              {nameStar('Merak', ['Dubhe', 'Merak', 'Phecda', 'Megrez'])}
              {groupLabel('Mizar', 'Big Dipper', -14, 26)}
              {groupLabel('Kochab', 'Little Dipper', -12, 22)}
              {groupLabel('Ruchbah', 'Cassiopeia')}
            </>
          )}
          {!night && (
            <Label x={20} y={30} size="s" color={C.dim}>
              {daylight ? 'The Sun is up: stars drawn faintly for reference' : 'Twilight: only the brightest stars are out yet'}
            </Label>
          )}
          <Label x={W - 20} y={30} anchor="end" size="s" color={C.dim}>
            {`facing ${dir} from ${observer.name}`}
          </Label>
        </g>
      </Svg>
      <Controls>
        <ChoiceControl label="Month (15th)" value={month} options={MONTHS} onChange={setMonth} />
        <RangeControl label="Local time" value={hour} min={18} max={30} step={0.5} onChange={setHour} format={clock} />
      </Controls>
      <Readout>
        {`${MONTH_NAME[Number(month)]} 15, ${clock(hour)}: the ${south ? 'Southern Cross' : 'Big Dipper'} is ${where}. `}
        {south
          ? `Carry the Cross's long axis from Gacrux through Acrux about four and a half times its length, ${sky.poleDist.toFixed(0)}° beyond Acrux, to reach the pole, ${Math.round(P.alt)}° up over the south point. `
          : `Follow the Pointers from Merak through Dubhe about five times their ${sky.gap.toFixed(1)}° gap and you reach Polaris, ${Math.round(P.alt)}° up over the north point. `}
        {minAlt < 0 ? 'Right now part of the pattern is below your horizon.' : minAlt < 12 ? 'It is low tonight, so buildings may hide it.' : south ? 'The pole itself stays in the same place all night.' : 'Polaris is in the same place as always.'}
      </Readout>
    </div>
  );
}
