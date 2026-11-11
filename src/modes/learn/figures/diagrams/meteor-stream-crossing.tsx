/**
 * Earth meets a comet's dust. Top view of the inner solar system: Earth's orbit and the orbit of Comet
 * 109P/Swift–Tuttle (JPL Small-Body Database elements: q 0.96 AU, e 0.963, i 113°, Ω 139°, ω 153°, period
 * about 133 years), projected onto the plane of Earth's orbit, with its dust spread along it. A date slider moves
 * Earth (astronomy-engine) through July–August 2027; the shower peaks when Earth reaches the stream, at solar
 * longitude 140° (around 12–13 August). The activity meter is schematic.
 */
import { useMemo, useState } from 'react';
import { Body } from 'astronomy-engine';
import { C, Controls, Label, RangeControl, Readout, Svg, polar, rad, type DiagramMeta, type DiagramProps } from '../kit';
import { geoEcl, norm180 } from './ecliptic-common';

export const meta: DiagramMeta = {
  title: 'Earth crosses a comet’s dust trail',
  summary: 'Top view of Earth’s orbit and Comet Swift–Tuttle’s, with its dust; slide through July and August to watch Earth plough into the stream and the Perseids peak.',
  params: { day: 'starting day after 10 July 2027, 0–52 (default 20)' },
};

const CX = 330, CY = 210, K = 150;
const Q = 0.96, ECC = 0.963, INC = rad(113), NODE = rad(139), PERI = rad(153);
const PEAK_LAMBDA = 140.0; // solar longitude of the Perseid maximum (IMO)
const START = Date.UTC(2027, 6, 10, 12);

function comet(nu: number) {
  const r = (Q * (1 + ECC)) / (1 + ECC * Math.cos(nu));
  const u = PERI + nu;
  return {
    r,
    x: r * (Math.cos(NODE) * Math.cos(u) - Math.sin(NODE) * Math.sin(u) * Math.cos(INC)),
    y: r * (Math.sin(NODE) * Math.cos(u) + Math.cos(NODE) * Math.sin(u) * Math.cos(INC)),
  };
}
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export default function MeteorStreamCrossing({ params }: DiagramProps) {
  const [day, setDay] = useState(typeof params?.day === 'number' ? (params.day as number) : 20);
  const orbit = useMemo(() => {
    const pts: [number, number][] = [];
    for (let nu = -2.6; nu <= 2.6; nu += 0.01) {
      const p = comet(nu);
      pts.push([CX + p.x * K, CY - p.y * K]);
    }
    const r = rng(11);
    const dust = Array.from({ length: 260 }, () => {
      const nu = -2.5 + 5 * r();
      const p = comet(nu);
      const j = (r() - 0.5) * 0.12 * p.r;
      const k2 = (r() - 0.5) * 0.12 * p.r;
      return [CX + (p.x + j) * K, CY - (p.y + k2) * K] as [number, number];
    });
    return { pts, dust };
  }, []);
  const date = new Date(START + day * 86400000);
  const sunLon = geoEcl(Body.Sun, date).lon;
  const d = norm180(sunLon - PEAK_LAMBDA);
  const act = Math.exp(-((d / 2.2) ** 2)) + 0.12 * Math.exp(-((d / 10) ** 2));
  const [ex, ey] = polar(CX, CY, K * 1.0, sunLon + 180);
  const fmt = (x: Date) => x.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  const arrow = [comet(0.3), comet(0.42)].map((p) => [CX + p.x * K, CY - p.y * K]);

  return (
    <div>
      <Svg w={720} h={400} title={meta.title} desc={`Earth's orbit and Comet Swift–Tuttle's dust stream from above. On ${fmt(date)} Earth is ${Math.abs(d) < 1.5 ? 'inside the densest part of the stream' : d < 0 ? 'approaching the stream' : 'leaving the stream'}.`}>
        <defs>
          <clipPath id="msc-clip">
            <rect x={8} y={8} width={704} height={384} rx={8} />
          </clipPath>
        </defs>
        <g clipPath="url(#msc-clip)">
          {orbit.dust.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.1} fill={C.dim} opacity={0.55} />
          ))}
          <polyline points={orbit.pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={C.blue} strokeWidth={1.5} strokeDasharray="5 4" />
          <line x1={arrow[0][0]} y1={arrow[0][1]} x2={arrow[1][0]} y2={arrow[1][1]} stroke={C.blue} strokeWidth={1.5} markerEnd="url(#fig-arrow)" />
        </g>
        <circle cx={CX} cy={CY} r={K} fill="none" stroke={C.earth} strokeOpacity={0.6} strokeDasharray="3 4" />
        <circle cx={CX} cy={CY} r={22} fill="url(#fig-glow)" />
        <circle cx={CX} cy={CY} r={9} fill={C.sun} />
        {/* Earth */}
        <circle cx={ex} cy={ey} r={Math.abs(d) < 3 ? 13 : 8} fill="none" stroke={C.amber} strokeOpacity={act} strokeWidth={3} />
        <circle cx={ex} cy={ey} r={7} fill={C.earth} />
        <Label x={ex + 14} y={ey + 4} weight={600}>
          Earth
        </Label>
        <Label x={14} y={26} size="s" color={C.blue}>
          Comet Swift–Tuttle's orbit (dashed) with its dust
        </Label>
        <Label x={14} y={44} size="s" color={C.dim}>
          the comet itself is far away near the outer end: it returns every 133 years
        </Label>
        <Label x={706} y={384} anchor="end" size="s" color={C.faint}>
          top view · comet orbit projected onto Earth's orbital plane
        </Label>
        {/* Activity meter */}
        <rect x={560} y={70} width={140} height={14} rx={4} fill="#121a3a" stroke={C.line} />
        <rect x={560} y={70} width={140 * Math.min(1, act)} height={14} rx={4} fill={C.amber} />
        <Label x={560} y={62} size="s" color={C.dim}>
          shower activity (schematic)
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Date" value={day} min={0} max={52} onChange={setDay} format={() => fmt(date)} />
      </Controls>
      <Readout>
        {Math.abs(d) < 1.5
          ? `${fmt(date)}: Earth is crossing the densest part of the dust stream. This is the Perseid peak, on the same dates every year because Earth is at the same point of its orbit.`
          : d < 0
            ? `${fmt(date)}: Earth is approaching the stream; a few Perseids a night join the random meteors, and the numbers are rising.`
            : `${fmt(date)}: Earth is leaving the stream behind; the shower fades over the next days.`}
      </Readout>
    </div>
  );
}
