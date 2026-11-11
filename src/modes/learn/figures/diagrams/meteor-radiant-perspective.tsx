/**
 * The radiant is a perspective effect. Left: parallel railway rails appear to meet at a vanishing point.
 * Right: the whole sky as seen lying on your back (zenith in the middle, horizon round the edge, north up,
 * east left). Shower meteors travel on parallel paths, so their trails lie on great circles through the radiant:
 * short near it (coming almost head-on), longer far from it. Two sporadic meteors are drawn for contrast.
 * The learner raises or lowers the radiant and can trace the trails back.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, rad, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'The radiant: a trick of perspective',
  summary: 'Railway tracks beside a whole-sky view of shower meteors; change the radiant’s height and trace the trails back to the point they seem to come from.',
  params: { alt: 'starting radiant altitude, 0–90 (default 55)' },
};

const SKY = { x: 524, y: 182, r: 152 };
const RAD_AZ = 40; // north-east, as for the Perseids before dawn
type V = [number, number, number];
const fromAltAz = (alt: number, az: number): V => [Math.cos(rad(alt)) * Math.sin(rad(az)), Math.cos(rad(alt)) * Math.cos(rad(az)), Math.sin(rad(alt))];
const norm = (v: V): V => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function toPage(v: V): [number, number] | null {
  const alt = (Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI;
  if (alt < 0) return null;
  const az = Math.atan2(v[0], v[1]);
  const r = ((90 - alt) / 90) * SKY.r;
  return [SKY.x - r * Math.sin(az), SKY.y - r * Math.cos(az)];
}
// Fixed set of shower meteors: [angular distance from radiant (deg), position angle (deg)]
const SHOWER: [number, number][] = [[14, 20], [22, 130], [30, 250], [38, 75], [45, 190], [52, 310], [60, 15], [66, 150], [74, 225], [82, 100], [26, 340], [48, 40]];

export default function MeteorRadiantPerspective({ params }: DiagramProps) {
  const [alt, setAlt] = useState(typeof params?.alt === 'number' ? (params.alt as number) : 55);
  const [trace, setTrace] = useState<'off' | 'on'>('off');
  const R = fromAltAz(Math.min(alt, 89.5), RAD_AZ);
  const u = norm(cross(R, [0, 0, 1]));
  const w = cross(R, u);
  const at = (theta: number, psi: number): V => {
    const s = Math.sin(rad(theta)), c = Math.cos(rad(theta));
    return [R[0] * c + (u[0] * Math.cos(rad(psi)) + w[0] * Math.sin(rad(psi))) * s, R[1] * c + (u[1] * Math.cos(rad(psi)) + w[1] * Math.sin(rad(psi))) * s, R[2] * c + (u[2] * Math.cos(rad(psi)) + w[2] * Math.sin(rad(psi))) * s];
  };
  const arc = (t0: number, t1: number, psi: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 12; i++) {
      const p = toPage(at(t0 + ((t1 - t0) * i) / 12, psi));
      if (p) pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    }
    return pts;
  };
  const rp = toPage(R);
  const visible = SHOWER.filter(([th, ps]) => toPage(at(th, ps)) !== null).length;

  return (
    <div>
      <Svg w={720} h={360} title={meta.title} desc={`Left: railway rails converging on a vanishing point. Right: a whole-sky view with the radiant ${alt} degrees above the north-east horizon and shower meteor trails pointing away from it; ${visible} of 12 shower meteors are above the horizon.`}>
        {/* Rails */}
        <rect x={10} y={10} width={280} height={340} rx={8} fill={C.panel} />
        <line x1={20} y1={120} x2={280} y2={120} stroke={C.lineStrong} />
        <path d="M 40 350 L 150 120 M 260 350 L 150 120" stroke={C.dim} strokeWidth={3} />
        {Array.from({ length: 9 }, (_, i) => {
          const t = Math.pow(0.78, i);
          const y = 120 + 230 * t;
          return <line key={i} x1={150 - 110 * t} y1={y} x2={150 + 110 * t} y2={y} stroke={C.line} strokeWidth={2 + 4 * t} />;
        })}
        <circle cx={150} cy={120} r={4} fill={C.amber} />
        <Label x={150} y={100} anchor="middle" size="s" color={C.amber}>
          vanishing point
        </Label>
        <Label x={150} y={36} anchor="middle" size="s" color={C.dim}>
          Parallel rails seem to meet
        </Label>
        <Label x={150} y={52} anchor="middle" size="s" color={C.dim}>
          in the distance
        </Label>
        {/* Sky */}
        <circle cx={SKY.x} cy={SKY.y} r={SKY.r} fill="#070b22" stroke={C.lineStrong} />
        <circle cx={SKY.x} cy={SKY.y} r={SKY.r * (2 / 3)} fill="none" stroke={C.line} strokeDasharray="2 5" />
        <circle cx={SKY.x} cy={SKY.y} r={SKY.r / 3} fill="none" stroke={C.line} strokeDasharray="2 5" />
        {[['N', 0, -1], ['E', -1, 0], ['S', 0, 1], ['W', 1, 0]].map(([l, dx, dy]) => (
          <Label key={l as string} x={SKY.x + (dx as number) * (SKY.r + 12)} y={SKY.y + (dy as number) * (SKY.r + 12) + 5} anchor="middle" size="s" color={C.dim}>
            {l}
          </Label>
        ))}
        <Label x={SKY.x + 6} y={SKY.y - 4} size="s" color={C.faint}>
          overhead
        </Label>
        {trace === 'on' &&
          SHOWER.map(([th, ps], i) => <polyline key={`t${i}`} points={arc(0, th, ps).join(' ')} fill="none" stroke={C.amber} strokeOpacity={0.45} strokeDasharray="3 4" />)}
        {SHOWER.map(([th, ps], i) => {
          const len = 4 + 14 * Math.sin(rad(th));
          const pts = arc(th, th + len, ps);
          if (pts.length < 2) return null;
          const end = pts[pts.length - 1].split(',').map(Number);
          return (
            <g key={i}>
              <polyline points={pts.join(' ')} fill="none" stroke={C.star} strokeWidth={2} strokeLinecap="round" />
              <circle cx={end[0]} cy={end[1]} r={1.8} fill={C.star} />
            </g>
          );
        })}
        {/* Two sporadic meteors, unrelated to the radiant */}
        {[[fromAltAz(30, 200), fromAltAz(22, 230)], [fromAltAz(38, 300), fromAltAz(30, 282)]].map(([a, b], i) => {
          const p = toPage(a), q = toPage(b);
          return p && q ? <line key={`s${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={C.blue} strokeWidth={2} strokeLinecap="round" /> : null;
        })}
        {rp && (
          <g>
            <circle cx={rp[0]} cy={rp[1]} r={6} fill="none" stroke={C.amber} strokeWidth={2} />
            <Label x={rp[0] + 10} y={rp[1] - 8} size="s" color={C.amber} weight={600}>
              radiant
            </Label>
          </g>
        )}
        {!rp && (
          <Label x={SKY.x} y={SKY.y + SKY.r - 14} anchor="middle" size="s" color={C.amber}>
            radiant below the horizon
          </Label>
        )}
        <Label x={706} y={348} anchor="end" size="s" color={C.faint}>
          whole sky, lying on your back · white: shower · blue: random
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Radiant height" value={alt} min={-10} max={90} onChange={setAlt} format={(v) => (v < 0 ? 'below the horizon' : `${v}°`)} />
        <ChoiceControl
          label="Trace the trails back"
          value={trace}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
          onChange={setTrace}
        />
      </Controls>
      <Readout>
        {alt <= 0
          ? 'With the radiant below the horizon, the meteors are coming up from under your feet: Earth blocks them and you see almost none of the shower.'
          : `The meteors appear all over the sky, not at the radiant: only their paths traced back meet there. Near the radiant they come almost straight at you and look short; 90° away they cross the sky side-on and look long. With the radiant ${alt}° up, about ${Math.round(Math.sin(rad(alt)) * 100)}% as many reach your sky as with it overhead.`}
      </Readout>
    </div>
  );
}
