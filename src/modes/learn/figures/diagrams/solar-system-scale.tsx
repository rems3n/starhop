/**
 * A scale model of the solar system. The learner picks the size of the model Sun; every other size and distance
 * is computed at the same scale (NASA planetary fact sheet: diameters and mean distances; Sun diameter
 * 1,391,400 km; Proxima Centauri 4.24 light-years). Top row: sizes to scale. Middle row: distances out to Mars.
 * Bottom row: distances out to Neptune.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'The solar system to scale',
  summary: 'Choose a model Sun (basketball or ping-pong ball) and see every planet’s size and distance at the same scale, plus the nearest star.',
  params: { model: '"basketball" | "pingpong" (default "basketball")' },
};

const SUN_KM = 1391400;
const BODIES = [
  { name: 'Mercury', d: 4879, a: 57.9e6, color: '#b9b2a6' },
  { name: 'Venus', d: 12104, a: 108.2e6, color: '#f1e3b8' },
  { name: 'Earth', d: 12756, a: 149.6e6, color: C.earth },
  { name: 'Mars', d: 6792, a: 228.0e6, color: C.red },
  { name: 'Jupiter', d: 142984, a: 778.5e6, color: '#e3c89a' },
  { name: 'Saturn', d: 120536, a: 1432.0e6, color: '#e8d590' },
  { name: 'Uranus', d: 51118, a: 2867.0e6, color: '#9fd8dc' },
  { name: 'Neptune', d: 49528, a: 4515.0e6, color: '#7c9cf0' },
];
const PROXIMA_KM = 4.24 * 9.4607e12;
const MODELS = {
  basketball: { label: 'Basketball', m: 0.24, desc: 'a 24 cm basketball' },
  pingpong: { label: 'Ping-pong ball', m: 0.04, desc: 'a 4 cm ping-pong ball' },
} as const;

function fmtLen(m: number) {
  if (m < 0.01) return `${(m * 1000).toFixed(m < 0.001 ? 2 : 1)} mm`;
  if (m < 1) return `${(m * 100).toFixed(1)} cm`;
  if (m < 1000) return `${m < 10 ? m.toFixed(1) : Math.round(m)} m`;
  return `${(m / 1000).toLocaleString('en-US', { maximumFractionDigits: m < 10000 ? 1 : 0 })} km`;
}

export default function SolarSystemScale({ params }: DiagramProps) {
  const [model, setModel] = useState<keyof typeof MODELS>(params?.model === 'pingpong' ? 'pingpong' : 'basketball');
  const M = MODELS[model];
  const s = M.m / (SUN_KM * 1000); // metres in the model per real metre
  const size = (km: number) => km * 1000 * s;
  // Row 1 (sizes): Sun radius 120 px at left edge, everything relative to it
  const pxPerKm = 120 / (SUN_KM / 2);
  const earth = BODIES[2];
  const dEarth = size(earth.a); // model distance of Earth, metres
  const dNep = size(BODIES[7].a);
  const prox = size(PROXIMA_KM);
  const L0 = 40, L1 = 690;
  const xInner = (km: number) => L0 + (km / 228.0e6) * (L1 - L0);
  const xOuter = (km: number) => L0 + (km / 4515.0e6) * (L1 - L0);

  return (
    <div>
      <Svg w={720} h={360} title={meta.title} desc={`A scale model with the Sun as ${M.desc}: Earth is ${fmtLen(size(earth.d))} across and ${fmtLen(dEarth)} away; Neptune is ${fmtLen(dNep)} away; the nearest star would be ${fmtLen(prox)} away.`}>
        {/* Row 1: sizes */}
        <Label x={60} y={22} size="s" color={C.dim}>
          Sizes to scale
        </Label>
        <circle cx={-82} cy={92} r={120} fill={C.sun} opacity={0.9} />
        <text x={8} y={97} fontSize={14} fontWeight={700} fill="#3a2a00">
          Sun
        </text>
        {BODIES.map((b, i) => {
          const r = Math.max(0.6, (b.d / 2) * pxPerKm);
          const x = 110 + i * 74;
          return (
            <g key={b.name}>
              <circle cx={x} cy={92} r={r} fill={b.color} />
              <Label x={x} y={92 + 30} anchor="middle" size="s">
                {b.name}
              </Label>
              <Label x={x} y={92 + 45} anchor="middle" size="s" color={C.dim}>
                {fmtLen(size(b.d))}
              </Label>
            </g>
          );
        })}
        {/* Row 2: inner distances */}
        <Label x={14} y={184} size="s" color={C.dim}>
          Distances from the Sun: the inner planets
        </Label>
        <line x1={L0} y1={214} x2={L1} y2={214} stroke={C.lineStrong} />
        <circle cx={L0} cy={214} r={5} fill={C.sun} />
        {BODIES.slice(0, 4).map((b, i) => (
          <g key={b.name}>
            <circle cx={xInner(b.a)} cy={214} r={4} fill={b.color} />
            <Label x={xInner(b.a)} y={i % 2 ? 238 : 202} anchor="middle" size="s">
              {`${b.name} ${fmtLen(size(b.a))}`}
            </Label>
          </g>
        ))}
        {/* Row 3: outer distances */}
        <Label x={14} y={274} size="s" color={C.dim}>
          …and all the way out to Neptune (inner planets crowd at the left)
        </Label>
        <line x1={L0} y1={304} x2={L1} y2={304} stroke={C.lineStrong} />
        <circle cx={L0} cy={304} r={5} fill={C.sun} />
        {BODIES.map((b, i) => (
          <g key={b.name}>
            <circle cx={xOuter(b.a)} cy={304} r={i < 4 ? 2.5 : 4} fill={b.color} />
            {i >= 3 && (
              <Label x={i === 7 ? L1 + 4 : i === 3 ? L0 - 6 : xOuter(b.a)} y={i === 3 ? 328 : i % 2 ? 328 : 292} anchor={i === 7 ? 'end' : i === 3 ? 'start' : 'middle'} size="s">
                {i === 3 ? 'Mercury–Mars' : `${b.name} ${fmtLen(size(b.a))}`}
              </Label>
            )}
          </g>
        ))}
        <Label x={706} y={348} anchor="end" size="s" color={C.faint}>
          sizes and distances from the NASA planetary fact sheet
        </Label>
      </Svg>
      <Controls>
        <ChoiceControl
          label="Model Sun"
          value={model}
          options={[
            { value: 'basketball', label: 'Basketball (24 cm)' },
            { value: 'pingpong', label: 'Ping-pong ball (4 cm)' },
          ]}
          onChange={setModel}
        />
      </Controls>
      <Readout>
        {`If the Sun were ${M.desc}, Earth would be a speck ${fmtLen(size(earth.d))} across, ${fmtLen(dEarth)} away${model === 'basketball' ? ' (about the length of a basketball court)' : ' (across a room)'}. Jupiter would be ${fmtLen(size(BODIES[4].d))} wide and ${fmtLen(size(BODIES[4].a))} away, Neptune ${fmtLen(dNep)} away. The nearest star, Proxima Centauri, would be another tiny ball ${fmtLen(prox)} away: ${Math.round((prox / 1000 / 12756) * 100)}% of the width of the real Earth. Almost all of the solar system is empty space.`}
      </Readout>
    </div>
  );
}
