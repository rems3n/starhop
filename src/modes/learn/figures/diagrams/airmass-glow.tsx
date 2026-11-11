/**
 * Why the sky is brightest near the horizon: the lower you look, the more air (and the more lit-up city air) lies
 * along your line of sight. Left: a side view of the curved Earth and its air (thickness exaggerated) with your line
 * of sight at the chosen altitude. Right: how many times more air than straight up, for a simple model of the
 * atmosphere as a uniform shell 8.4 km thick (one scale height) on an Earth of radius 6,371 km:
 * path = √((R+H)² − R²cos²h) − R·sin h, divided by H.
 */
import { useState } from 'react';
import { C, Controls, Label, RangeControl, Readout, Svg, rad, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Look high: less air, less glow',
  summary: 'Tilt your line of sight from the horizon to overhead and see how much air, and how much city glow, it passes through.',
  params: { alt: 'starting altitude in degrees (default 20)' },
};

const RE = 6371, HA = 8.4;
const airRatio = (h: number) => (Math.sqrt((RE + HA) ** 2 - (RE * Math.cos(rad(h))) ** 2) - RE * Math.sin(rad(h))) / HA;

// drawing geometry (atmosphere exaggerated)
const EX = 210, EY = 1000, ER = 700, AH = 90; // Earth centre, radius, drawn air thickness
const OX = EX, OY = EY - ER; // observer on top
function exitPoint(h: number): [number, number] {
  const dx = Math.cos(rad(h)), dy = -Math.sin(rad(h));
  // |O + t d − E|² = (ER + AH)²
  const ox = OX - EX, oy = OY - EY;
  const b = 2 * (ox * dx + oy * dy);
  const c = ox * ox + oy * oy - (ER + AH) ** 2;
  const t = (-b + Math.sqrt(b * b - 4 * c)) / 2;
  return [OX + t * dx, OY + t * dy];
}

const GX0 = 470, GX1 = 700, GY0 = 60, GY1 = 300;
const gx = (h: number) => GX0 + (h / 90) * (GX1 - GX0);
const gy = (r: number) => GY1 - (Math.log10(r) / Math.log10(50)) * (GY1 - GY0);

export default function AirmassGlow({ params }: DiagramProps) {
  const [h, setH] = useState(typeof params?.alt === 'number' ? (params.alt as number) : 20);
  const ratio = airRatio(h);
  const [x2, y2] = exitPoint(h);
  const curve = Array.from({ length: 91 }, (_, i) => `${gx(i).toFixed(1)},${gy(airRatio(i)).toFixed(1)}`).join(' L ');

  return (
    <div>
      <Svg w={720} h={370} title={meta.title} desc="Left: a side view of the curved ground with a layer of air above it and a town glowing near the horizon. A line of sight from an observer passes through much more air when it is aimed low than when it is aimed high. Right: a graph of how many times more air you look through, from about 39 times at the horizon to 1 straight up.">
        <defs>
          <radialGradient id="am-city" cx="0.5" cy="1" r="0.8">
            <stop offset="0" stopColor="#e8a85a" stopOpacity={0.55} />
            <stop offset="1" stopColor="#e8a85a" stopOpacity={0} />
          </radialGradient>
          <clipPath id="am-left">
            <rect x={1} y={1} width={440} height={368} />
          </clipPath>
        </defs>
        <g clipPath="url(#am-left)">
          <circle cx={EX} cy={EY} r={ER + AH} fill={C.blue} opacity={0.12} />
          {/* city glow on the right-hand horizon */}
          <ellipse cx={400} cy={OY + 48} rx={110} ry={90} fill="url(#am-city)" />
          <circle cx={EX} cy={EY} r={ER} fill="#141a33" stroke={C.lineStrong} strokeWidth={1.5} />
          {[360, 380, 400, 420].map((x, i) => (
            <rect key={x} x={x} y={OY + 28 + i * 3 - [16, 26, 12, 20][i]} width={14} height={[16, 26, 12, 20][i] + 6} fill="#262d4f" transform={`rotate(${(x - EX) / 12} ${x} ${OY + 30})`} />
          ))}
          {/* line of sight */}
          <line x1={OX} y1={OY} x2={x2} y2={y2} stroke={C.amber} strokeWidth={4} opacity={0.85} />
          <line x1={OX} y1={OY} x2={OX} y2={OY - AH} stroke={C.text} strokeWidth={2} strokeDasharray="4 4" opacity={0.6} />
          <circle cx={OX} cy={OY - 8} r={6} fill={C.moon} />
        </g>
        <Label x={OX - 10} y={OY - AH - 10} anchor="end" size="s" color={C.dim}>
          straight up
        </Label>
        <Label x={OX + 10} y={OY + 22} size="s" color={C.dim}>
          you
        </Label>
        <Label x={20} y={30} size="s" color={C.dim}>
          air layer drawn about 100 times too thick
        </Label>
        <Label x={20} y={348} size="s" color={C.blue}>
          the air
        </Label>
        <Label x={400} y={OY + 76} anchor="middle" size="s" color={C.amber}>
          town
        </Label>
        {/* graph */}
        <Label x={GX0} y={GY0 - 26} size="s" color={C.dim}>
          times more air than straight up
        </Label>
        {[1, 2, 5, 10, 40].map((r) => (
          <g key={r}>
            <line x1={GX0} x2={GX1} y1={gy(r)} y2={gy(r)} stroke={C.line} />
            <Label x={GX0 - 6} y={gy(r) + 4} anchor="end" size="s" color={C.dim}>
              {`${r}×`}
            </Label>
          </g>
        ))}
        {[0, 30, 60, 90].map((a) => (
          <Label key={a} x={gx(a)} y={GY1 + 20} anchor="middle" size="s" color={C.dim}>
            {`${a}°`}
          </Label>
        ))}
        <Label x={(GX0 + GX1) / 2} y={GY1 + 42} anchor="middle" size="s" color={C.dim}>
          altitude you look at
        </Label>
        <path d={`M ${curve}`} fill="none" stroke={C.amber} strokeWidth={2.5} />
        <circle cx={gx(h)} cy={gy(ratio)} r={6} fill={C.amber} stroke={C.bg} strokeWidth={2} />
      </Svg>
      <Controls>
        <RangeControl label="Look at altitude" value={h} min={0} max={90} step={1} onChange={setH} format={(v) => `${v}°`} />
      </Controls>
      <Readout>
        {h >= 89
          ? 'Straight up you look through the least possible air: this is the darkest, clearest part of your sky.'
          : `At ${h}° up you look through about ${ratio < 10 ? ratio.toFixed(1) : Math.round(ratio)} times as much air as straight up${h < 15 ? ', much of it over lit-up towns: this is where the glow is worst and stars fade or vanish' : h < 40 ? ', so faint stars are dimmed and the glow is stronger' : ', not much worse than overhead'}.`}
      </Readout>
    </div>
  );
}
