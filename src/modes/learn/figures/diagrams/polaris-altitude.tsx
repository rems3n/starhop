/**
 * Why the altitude of Polaris equals your latitude. Left: Earth with its axis pointing at Polaris, an observer
 * at latitude φ, their horizon (tangent to the ground) and parallel rays from Polaris (so far away that its
 * light arrives in parallel lines). The angle between horizon and ray at the observer equals the latitude
 * angle at Earth's centre. Right: what the observer sees, Polaris φ above the northern horizon.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { cosd, fmtLat, placeName, placeOf, placeOptions, sind, useObserver } from './_motion-sky';

export const meta: DiagramMeta = {
  title: 'Polaris’s height = your latitude',
  summary: 'Earth with an observer, their horizon and parallel rays from Polaris, plus the observer’s own view; a latitude slider shows the two angles staying equal.',
  params: { lat: 'starting latitude (default: the learner’s location)' },
};

const W = 720, H = 400;
const EC: [number, number] = [190, 236], RE = 118;
const pt = (c: [number, number], r: number, a: number): [number, number] => [c[0] + r * cosd(a), c[1] - r * sind(a)];
const arc = (c: [number, number], r: number, a0: number, a1: number) => {
  const [x0, y0] = pt(c, r, a0), [x1, y1] = pt(c, r, a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 0 ${a1 > a0 ? 0 : 1} ${x1} ${y1}`;
};
function StarMark({ x, y, r = 7, color = C.star }: { x: number; y: number; r?: number; color?: string }) {
  const p = Array.from({ length: 10 }, (_, i) => pt([x, y], i % 2 ? r * 0.42 : r, 90 + i * 36)).map((q) => q.join(',')).join(' ');
  return <polygon points={p} fill={color} />;
}

export default function PolarisAltitude({ params }: DiagramProps) {
  const obs = useObserver();
  const [lat, setLat] = useState<number>(typeof params?.lat === 'number' ? (params.lat as number) : Math.round(obs.lat * 10) / 10);
  const opts = placeOptions(obs);
  const a = lat;
  const O = pt(EC, RE, a);
  const north: [number, number] = [-sind(a), -cosd(a)]; // screen direction along the ground toward the North Pole
  const h0: [number, number] = [O[0] - north[0] * 60, O[1] - north[1] * 60];
  const h1: [number, number] = [O[0] + north[0] * 92, O[1] + north[1] * 92];
  const pole = pt(EC, RE, 90);

  // Inset: the observer's own view, north to the right
  const IX = 420, IY = 300, eye: [number, number] = [IX + 44, IY - 22];
  const sp = pt(eye, a >= 0 ? 175 : 95, a);
  const fists = Math.abs(a) / 10;

  let text: string;
  if (a > 89.5) text = 'At the North Pole Polaris is straight overhead, 90° up: your latitude is 90° N.';
  else if (a > 0.5) text = `At latitude ${fmtLat(a)} Polaris stands ${a.toFixed(1)}° above the northern horizon, about ${fists < 1 ? 'one finger-width or two' : `${fists.toFixed(1)} fists`} at arm’s length. The angle between your horizon and Polaris’s light is the same angle as your latitude at Earth’s centre.`;
  else if (a > -0.5) text = 'On the equator Polaris sits right on the northern horizon (in practice, lost in the haze).';
  else text = `At latitude ${fmtLat(a)} Polaris is ${Math.abs(a).toFixed(1)}° below your northern horizon, so you cannot see it. Instead the south celestial pole is ${Math.abs(a).toFixed(1)}° above your southern horizon, and no bright star marks it.`;

  return (
    <div>
      <Svg w={W} h={H} title={meta.title} desc={`Earth with its axis pointing to Polaris and an observer at latitude ${fmtLat(a)}; the observer's horizon and the parallel rays from Polaris meet at an angle equal to the latitude. Beside it, the observer's view of Polaris ${a.toFixed(0)} degrees above the northern horizon.`}>
        {/* Parallel rays from Polaris */}
        {[EC[0] - 70, pole[0], O[0], EC[0] + 165].map((rx, i) => (
          <line key={i} x1={rx} y1={18} x2={rx} y2={i === 1 ? pole[1] : i === 2 ? O[1] : 300} stroke={C.star} strokeOpacity={i === 2 ? 0.95 : 0.35} strokeWidth={i === 2 ? 1.8 : 1} strokeDasharray={i === 2 ? undefined : '3 5'} markerEnd={i === 2 ? 'url(#fig-arrow)' : undefined} />
        ))}
        <Label x={18} y={26} size="s" color={C.dim}>Light from Polaris arrives in parallel lines</Label>
        <Label x={18} y={42} size="s" color={C.faint}>(it is hundreds of light-years away)</Label>
        {/* Earth */}
        <circle cx={EC[0]} cy={EC[1]} r={RE} fill={C.earth} fillOpacity={0.85} stroke={C.lineStrong} />
        <line x1={EC[0] - RE - 10} x2={EC[0] + RE + 10} y1={EC[1]} y2={EC[1]} stroke="rgba(255,255,255,0.55)" strokeDasharray="5 4" />
        <Label x={EC[0] - RE + 6} y={EC[1] - 6} size="s" color={C.text}>equator</Label>
        <line x1={EC[0]} y1={EC[1] + RE + 8} x2={EC[0]} y2={pole[1] - 4} stroke={C.text} strokeWidth={1.4} />
        <Label x={EC[0] + 6} y={pole[1] + 16} size="s" color={C.text}>North Pole</Label>
        {/* Latitude angle at the centre */}
        <line x1={EC[0]} y1={EC[1]} x2={O[0]} y2={O[1]} stroke={C.amber} strokeWidth={1.4} />
        {Math.abs(a) > 1.5 && <path d={arc(EC, 34, 0, a)} fill="none" stroke={C.amber} strokeWidth={2} />}
        {Math.abs(a) > 1.5 && (() => { const p = pt(EC, 52, a / 2); return <Label x={p[0]} y={p[1] + 5} anchor="middle" color={C.amber} weight={700}>{`${Math.abs(a).toFixed(0)}°`}</Label>; })()}
        {/* Horizon at the observer */}
        <line x1={h0[0]} y1={h0[1]} x2={h1[0]} y2={h1[1]} stroke={C.good} strokeWidth={2.4} />
        <Label x={h1[0] + (north[0] < 0 ? -4 : -10)} y={h1[1] - (north[0] < 0 ? 8 : 4)} anchor="end" size="s" color={C.good} weight={600}>horizon → north</Label>
        {/* Angle between horizon (toward north) and the ray to Polaris */}
        {Math.abs(a) > 1.5 && Math.abs(a) < 89 && <path d={arc(O, 30, 90, 90 + a)} fill="none" stroke={C.amber} strokeWidth={2} />}
        {Math.abs(a) > 1.5 && Math.abs(a) < 89 && (() => { const p = pt(O, 46, 90 + a / 2); return <Label x={p[0]} y={p[1] + 5} anchor="middle" color={C.amber} weight={700}>{`${Math.abs(a).toFixed(0)}°`}</Label>; })()}
        <circle cx={O[0]} cy={O[1]} r={5} fill={C.amber} stroke={C.bg} strokeWidth={1.5} />
        <Label x={O[0] + 10} y={O[1] + 18} size="s" color={C.amber} weight={600}>you</Label>
        <Label x={EC[0] - 70} y={EC[1] + RE + 26} size="s" color={C.faint}>Earth not to scale</Label>

        {/* Inset: what you see */}
        <rect x={IX} y={64} width={W - IX - 14} height={IY - 64 + 52} rx={10} fill={C.panel} stroke={C.line} />
        <Label x={IX + 14} y={86} size="s" color={C.dim}>What you see, facing north</Label>
        <rect x={IX + 1} y={IY} width={W - IX - 16} height={51} fill="#141a2e" />
        <line x1={IX} x2={W - 14} y1={IY} y2={IY} stroke={C.good} strokeWidth={2} />
        <Label x={W - 30} y={IY + 22} anchor="end" weight={700}>N</Label>
        {/* Observer */}
        <circle cx={eye[0] - 4} cy={eye[1] - 6} r={6} fill={C.dim} />
        <line x1={eye[0] - 4} y1={eye[1]} x2={eye[0] - 4} y2={IY} stroke={C.dim} strokeWidth={3} />
        <line x1={eye[0]} y1={eye[1]} x2={W - 30} y2={eye[1]} stroke={C.line} strokeDasharray="3 4" />
        <line x1={eye[0]} y1={eye[1]} x2={sp[0]} y2={sp[1]} stroke={a >= 0 ? C.star : C.faint} strokeOpacity={0.6} strokeDasharray="4 4" />
        {Math.abs(a) > 1.5 && <path d={arc(eye, 60, 0, a)} fill="none" stroke={C.amber} strokeWidth={2} />}
        {Math.abs(a) > 1.5 && (() => { const p = pt(eye, 78, a / 2); return <Label x={p[0]} y={p[1] + 5} color={C.amber} weight={700}>{`${Math.abs(a).toFixed(0)}°`}</Label>; })()}
        <g opacity={a >= 0 ? 1 : 0.35}>
          <StarMark x={sp[0]} y={sp[1]} r={9} color={C.amber} />
          <Label x={sp[0] + (a > 70 || a < 0 ? -14 : 14)} y={sp[1] + (a < 0 ? 22 : 5)} anchor={a > 70 ? 'end' : a < 0 ? 'middle' : 'start'} weight={700} color={a >= 0 ? C.amber : C.dim}>{a >= 0 ? 'Polaris' : 'Polaris (hidden)'}</Label>
        </g>
      </Svg>
      <Controls>
        <RangeControl label="Latitude" value={lat} min={-90} max={90} step={0.1} onChange={setLat} format={fmtLat} />
        <ChoiceControl label="Go to" value={placeOf(lat, opts)} options={opts.map((o) => ({ value: o.value, label: o.value === 'you' ? placeName(obs) : o.label }))} onChange={(v) => setLat(opts.find((o) => o.value === v)!.lat)} />
      </Controls>
      <Readout>{text}</Readout>
    </div>
  );
}
