/**
 * Why stars twinkle and planets mostly don't. A star is a point: its light reaches your eye along one thin path
 * through moving pockets of air, so its brightness jumps about. A planet is a tiny disc: light from many points
 * crosses many different pockets, and the jumps average out. Schematic: the traces are made from summed waves,
 * with the planet's averaging over 12 independent paths; the slider scales the amount of air crossed (1/sin h).
 */
import { useMemo, useState } from 'react';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, rad, useAnimatedValue, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Twinkling: point vs disc',
  summary: 'Starlight on one path through turbulent air flickers; a planet’s light on many paths averages out. Play the air and change the height above the horizon.',
  params: { alt: 'starting height above the horizon in degrees, 10–90 (default 50)' },
};

const N_PATHS = 12;
function wave(t: number, seed: number) {
  let v = 0;
  for (let k = 1; k <= 5; k++) v += Math.sin(t * (2.1 * k + seed * 0.37) + seed * 1.9 + k * 2.3) / k;
  return v / 1.6;
}

export default function TwinklePointVsDisc({ params }: DiagramProps) {
  const [alt, setAlt] = useState(typeof params?.alt === 'number' ? (params.alt as number) : 50);
  const [playing, setPlaying] = useState(false);
  const [t] = useAnimatedValue(3, playing, 1);
  const air = 1 / Math.sin(rad(Math.max(alt, 8)));
  const amp = 0.22 * Math.pow(air, 0.8);
  const star = (tt: number) => Math.max(0.05, 1 + amp * wave(tt, 1));
  const planet = (tt: number) => {
    let v = 0;
    for (let i = 0; i < N_PATHS; i++) v += wave(tt, 3 + i * 1.7);
    return Math.max(0.05, 1 + amp * (v / N_PATHS));
  };
  const cells = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: (i * 53) % 360, y: 100 + ((i * 37) % 60), r: 16 + ((i * 7) % 14), o: 0.06 + ((i * 13) % 10) / 100 })), []);

  const trace = (f: (tt: number) => number, x0: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 80; i++) {
      const tt = t - 8 + (i / 80) * 8;
      pts.push(`${(x0 + 20 + i * 3.6).toFixed(1)},${(292 - (f(tt) - 0.2) * 52).toFixed(1)}`);
    }
    return `M ${pts.join(' L ')}`;
  };

  const panel = (x0: number, isStar: boolean) => {
    const cx = x0 + 180;
    const b = isStar ? star(t) : planet(t);
    const beams = isStar ? [0] : [-12, -8, -4, 0, 4, 8, 12];
    return (
      <g>
        <Label x={cx} y={24} anchor="middle" weight={600}>
          {isStar ? 'A star: a point of light' : 'A planet: a tiny disc'}
        </Label>
        {isStar ? <circle cx={cx} cy={50} r={3} fill={C.star} /> : <circle cx={cx} cy={50} r={13} fill="#e3c89a" />}
        {/* Turbulent air */}
        <rect x={x0 + 12} y={84} width={336} height={92} rx={8} fill="rgba(156,176,255,0.05)" stroke={C.line} />
        {cells.map((c, i) => (
          <ellipse key={i} cx={x0 + 12 + (((c.x + t * (14 + (i % 4) * 6)) % 380) + 380) % 380 - 20} cy={c.y - 10} rx={c.r * 1.4} ry={c.r * 0.7} fill={C.blue} opacity={c.o} />
        ))}
        {beams.map((d) => (
          <line key={d} x1={cx + d} y1={56} x2={cx + d * 0.15} y2={196} stroke={C.star} strokeWidth={isStar ? 1.6 : 1} opacity={0.65} />
        ))}
        {/* Eye / ground */}
        <ellipse cx={cx} cy={204} rx={12} ry={7} fill="none" stroke={C.lineStrong} />
        <circle cx={cx} cy={204} r={3.5} fill={C.text} opacity={Math.min(1, 0.25 + 0.6 * b)} />
        {/* Brightness trace */}
        <line x1={x0 + 20} y1={240} x2={x0 + 308} y2={240} stroke={C.line} strokeDasharray="2 4" />
        <path d={trace(isStar ? star : planet, x0)} fill="none" stroke={isStar ? C.blue : C.amber} strokeWidth={1.8} />
        <Label x={x0 + 20} y={312} size="s" color={C.dim}>
          brightness reaching your eye
        </Label>
      </g>
    );
  };

  return (
    <div>
      <Svg w={720} h={320} title={meta.title} desc="Left: a star's single thin beam of light passes through moving pockets of air and its brightness trace jumps up and down. Right: a planet's light comes from a small disc along many paths, and its brightness trace stays nearly flat.">
        {panel(0, true)}
        <line x1={360} y1={14} x2={360} y2={306} stroke={C.line} />
        {panel(360, false)}
        <Label x={350} y={134} anchor="end" size="s" color={C.dim}>
          moving pockets of air
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Height above the horizon" value={alt} min={10} max={90} step={1} onChange={setAlt} format={(v) => `${v}°`} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} label="Play the air" />
      </Controls>
      <Readout>
        {`At ${alt}° up, your line of sight crosses ${air.toFixed(1)} times as much air as straight overhead. `}
        {alt < 25
          ? 'Low down, there is so much turbulent air that even planets shimmer: the planet test works best higher up.'
          : 'The star’s single beam is pushed around by each pocket of air, so it flickers. The planet’s light takes many slightly different paths and the flickers cancel: a steadier light.'}
      </Readout>
    </div>
  );
}
