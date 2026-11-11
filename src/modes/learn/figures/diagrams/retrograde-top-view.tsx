/**
 * Why retrograde motion happens: Earth overtakes Mars on the inside lane. Bottom: real heliocentric positions of
 * Earth and Mars (astronomy-engine) around the 19 February 2027 opposition, turned so that opposition points up,
 * with sight lines at seven numbered dates 20 days apart. Top: the direction of each sight line among the distant
 * stars (true geocentric ecliptic longitude and latitude), where the numbered points go east, back west, then east.
 */
import { useMemo, useState } from 'react';
import { Body, HelioVector, RotateVector, Rotation_EQJ_ECL } from 'astronomy-engine';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Step, Svg, useAnimatedValue, type DiagramMeta, type DiagramProps } from '../kit';
import { geoEcl, norm180 } from './ecliptic-common';

export const meta: DiagramMeta = {
  title: 'Overtaking on the inside lane',
  summary: 'Real positions of Earth and Mars around the 2027 opposition, with numbered sight lines; play to watch the direction to Mars swing back against the stars as Earth passes.',
};

const OPP = Date.UTC(2027, 1, 19, 15, 44);
const D0 = -80, D1 = 80, MARKS = [-60, -40, -20, 0, 20, 40, 60];
const SX = 360, SY = 392, K = 96, S = 14, STRIP_Y = 52;
const ROT = Rotation_EQJ_ECL();

export default function RetrogradeTopView(_: DiagramProps) {
  const data = useMemo(() => {
    const m0 = RotateVector(ROT, HelioVector(Body.Mars, new Date(OPP)));
    const th = Math.atan2(m0.y, m0.x);
    const c = Math.cos(Math.PI / 2 - th), s = Math.sin(Math.PI / 2 - th);
    const toPage = (v: { x: number; y: number }): [number, number] => [SX + (v.x * c - v.y * s) * K, SY - (v.x * s + v.y * c) * K];
    const lon0 = geoEcl(Body.Mars, new Date(OPP)).lon;
    const days = [];
    for (let d = D0; d <= D1; d++) {
      const t = new Date(OPP + d * 86400000);
      const g = geoEcl(Body.Mars, t);
      days.push({
        d,
        date: t,
        E: toPage(RotateVector(ROT, HelioVector(Body.Earth, t))),
        M: toPage(RotateVector(ROT, HelioVector(Body.Mars, t))),
        sx: SX - norm180(g.lon - lon0) * S,
        sy: STRIP_Y - (g.lat - 3) * S,
      });
    }
    return days;
  }, []);
  const [playing, setPlaying] = useState(false);
  const [v, setV] = useAnimatedValue(D1, playing, 18, [D0, D1]);
  const now = data[Math.round(v) - D0];
  const ext = (E: [number, number], M: [number, number], yTo: number): [number, number] => {
    const t = (yTo - E[1]) / (M[1] - E[1]);
    return [E[0] + t * (M[0] - E[0]), yTo];
  };
  const shown = MARKS.filter((m) => m <= v);
  const ix = Math.round(v) - D0;
  const a = data[Math.max(0, ix - 3)], b = data[Math.min(data.length - 1, ix + 3)];
  const moving = b.sx < a.sx - 0.25 ? 'east' : b.sx > a.sx + 0.25 ? 'west' : 'still';
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  return (
    <div>
      <Svg w={720} h={400} title={meta.title} desc="Top: Mars's path among the distant stars, with numbered points that move east, then back west, then east again. Bottom: Earth on the inner orbit overtaking Mars on the outer orbit, with a sight line from each numbered Earth position through Mars.">
        {/* Star strip */}
        <rect x={10} y={10} width={700} height={84} rx={8} fill={C.panel} stroke={C.line} />
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={20 + ((i * 137) % 680)} cy={18 + ((i * 53) % 70)} r={i % 7 === 0 ? 1.6 : 0.9} fill={C.star} opacity={0.6} />
        ))}
        <Label x={20} y={112} size="s" color={C.dim}>
          ← east · Mars among the distant stars, as seen from Earth · west →
        </Label>
        <polyline points={data.slice(0, Math.round(v) - D0 + 1).map((p) => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ')} fill="none" stroke={C.red} strokeWidth={2} />
        {shown.map((m, n) => {
          const p = data[m - D0];
          const loop = n >= 1 && n <= 5;
          return <Step key={m} x={p.sx} y={p.sy + (loop ? -17 : 19)} n={n + 1} />;
        })}
        <circle cx={now.sx} cy={now.sy} r={5} fill={C.red} stroke={C.bg} strokeWidth={1.5} />
        {/* Orbits (true heliocentric paths over the window) */}
        <polyline points={data.map((p) => p.E.join(',')).join(' ')} fill="none" stroke={C.earth} strokeOpacity={0.5} strokeDasharray="3 4" />
        <polyline points={data.map((p) => p.M.join(',')).join(' ')} fill="none" stroke={C.red} strokeOpacity={0.5} strokeDasharray="3 4" />
        {/* Sight lines at the numbered dates */}
        {shown.map((m, n) => {
          const p = data[m - D0];
          const top = ext(p.E, p.M, 124);
          return (
            <g key={m}>
              <line x1={p.E[0]} y1={p.E[1]} x2={top[0]} y2={top[1]} stroke={C.lineStrong} strokeOpacity={0.6} />
              <circle cx={p.E[0]} cy={p.E[1]} r={3} fill={C.earth} />
              <circle cx={p.M[0]} cy={p.M[1]} r={3} fill={C.red} />
              <text x={p.E[0]} y={p.E[1] + 16} textAnchor="middle" fontSize={12} fontWeight={700} fill={C.amber} className="fig-label">
                {n + 1}
              </text>
            </g>
          );
        })}
        {/* Now */}
        {(() => {
          const top = ext(now.E, now.M, 124);
          return <line x1={now.E[0]} y1={now.E[1]} x2={top[0]} y2={top[1]} stroke={C.text} strokeWidth={1.6} />;
        })()}
        <circle cx={now.E[0]} cy={now.E[1]} r={7} fill={C.earth} />
        <circle cx={now.M[0]} cy={now.M[1]} r={6} fill={C.red} />
        <Label x={now.E[0] + 10} y={now.E[1] + 4} size="s" weight={600}>
          Earth
        </Label>
        <Label x={now.M[0] + 10} y={now.M[1] + 4} size="s" weight={600}>
          Mars
        </Label>
        <circle cx={SX} cy={SY} r={22} fill="url(#fig-glow)" />
        <Label x={SX + 26} y={SY - 4} size="s" color={C.dim}>
          Sun
        </Label>
        <Label x={706} y={130} anchor="end" size="s" color={C.dim}>
          Earth: 30 km/s on the inside
        </Label>
        <Label x={706} y={146} anchor="end" size="s" color={C.dim}>
          Mars: 24 km/s on the outside
        </Label>
        <Label x={706} y={162} anchor="end" size="s" color={C.dim}>
          numbered dates 20 days apart
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Date" value={Math.round(v)} min={D0} max={D1} onChange={(x) => { setPlaying(false); setV(x); }} format={() => fmt(now.date)} />
        <PlayButton playing={playing} onToggle={() => { if (v >= D1 - 1) setV(D0); setPlaying((p) => !p); }} />
        <button type="button" className="btn btn--sm" onClick={() => { setPlaying(false); setV(D0); }}>
          Reset
        </button>
      </Controls>
      <Readout>
        {moving === 'still'
          ? `${fmt(now.date)}: the sight line has stopped turning: Mars is at a stationary point.`
          : moving === 'east'
            ? `${fmt(now.date)}: the sight line turns east, so Mars drifts east among the stars as usual.`
            : `${fmt(now.date)}: Earth is drawing level and passing Mars, so the sight line swings back and Mars slides west: retrograde. Mars itself never reverses.`}
      </Readout>
    </div>
  );
}
