/**
 * Why more meteors after midnight. Top view of Earth (from above the North Pole, Sun to the left) moving along its
 * orbit toward the top of the page at about 30 km/s. The side of Earth facing forward is where it is about 6 am;
 * it sweeps up debris like a windshield in rain. The learner moves their local time through the night; the
 * meter shows the relative rate (schematic: proportional to how directly the sky overhead faces forward).
 */
import { useMemo, useState } from 'react';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, polar, rad, useAnimatedValue, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'The morning side faces forward',
  summary: 'Earth ploughs through space with its dawn side in front; move your clock through the night to see when your sky faces into the oncoming dust.',
  params: { hour: 'starting local time, 18–30 (30 = 6 am; default 21)' },
};

const EX = 330, EY = 196, R = 92;
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const clock = (h: number) => {
  const x = ((Math.round(h) % 24) + 24) % 24;
  return x === 0 ? 'midnight' : x === 12 ? 'noon' : `${x % 12} ${x < 12 ? 'am' : 'pm'}`;
};

export default function MeteorMorningSide({ params }: DiagramProps) {
  const [hour, setHour] = useState(typeof params?.hour === 'number' ? (params.hour as number) : 21);
  const [playing, setPlaying] = useState(false);
  const [t] = useAnimatedValue(0, playing, 60);
  const dust = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 70 }, () => [r() * 700 + 10, r() * 400] as [number, number]);
  }, []);
  const ang = (15 * hour) % 360; // 0 = midnight (right), 90 = 6 am (top), 180 = noon (left)
  const [ox, oy] = polar(EX, EY, R, ang);
  const [zx, zy] = polar(EX, EY, R + 48, ang);
  const facing = Math.cos(rad(ang - 90)); // 1 = straight forward
  const rate = (1 + facing) / 2;
  const sunUp = Math.cos(rad(ang)) < -0.05;

  return (
    <div>
      <Svg w={720} h={392} title={meta.title} desc={`Earth from above with its direction of motion toward the top. At ${clock(hour)} your sky faces ${facing > 0.5 ? 'forward, into the oncoming debris' : facing < -0.5 ? 'backward' : 'sideways'}.`}>
        {/* Dust drifting past (relative to Earth it streams downward) */}
        {dust.map(([x, y], i) => {
          const yy = ((y + t) % 400 + 400) % 400;
          const inside = Math.hypot(x - EX, yy - EY) < R + 4;
          return inside ? null : <line key={i} x1={x} y1={yy} x2={x} y2={yy - 7} stroke={C.dim} strokeOpacity={0.5} />;
        })}
        {/* Sunlight */}
        {[110, 160, 210, 260].map((y) => (
          <line key={y} x1={14} y1={y} x2={70} y2={y} stroke={C.sun} strokeOpacity={0.5} markerEnd="url(#fig-arrow)" />
        ))}
        <Label x={14} y={92} size="s" color={C.amber}>
          sunlight
        </Label>
        {/* Earth: day half left */}
        <circle cx={EX} cy={EY} r={R} fill="#16204a" />
        <path d={`M ${EX} ${EY - R} A ${R} ${R} 0 0 0 ${EX} ${EY + R} Z`} fill={C.earth} />
        <Label x={EX - R - 8} y={EY + 4} anchor="end" size="s">
          noon
        </Label>
        <Label x={EX + R + 8} y={EY + 4} size="s">
          midnight
        </Label>
        <Label x={EX} y={EY - R - 10} anchor="middle" size="s">
          6 am
        </Label>
        <Label x={EX} y={EY + R + 20} anchor="middle" size="s">
          6 pm
        </Label>
        {/* Direction of motion */}
        <line x1={EX + R + 120} y1={EY + 60} x2={EX + R + 120} y2={EY - 80} stroke={C.text} strokeWidth={2} markerEnd="url(#fig-arrow)" />
        <Label x={EX + R + 130} y={EY - 60} size="s" weight={600}>
          Earth's motion
        </Label>
        <Label x={EX + R + 130} y={EY - 44} size="s" color={C.dim}>
          about 30 km/s
        </Label>
        {/* You */}
        <line x1={ox} y1={oy} x2={zx} y2={zy} stroke={C.amber} strokeWidth={2} markerEnd="url(#fig-arrow)" />
        <circle cx={ox} cy={oy} r={6} fill={C.amber} stroke={C.bg} strokeWidth={2} />
        <Label x={zx + (Math.cos(rad(ang)) >= 0 ? 8 : -8)} y={zy + (Math.sin(rad(ang)) > 0.3 ? -6 : 14)} anchor={Math.cos(rad(ang)) >= 0 ? 'start' : 'end'} size="s" color={C.amber} weight={600}>
          your sky
        </Label>
        {/* Meter */}
        <rect x={548} y={300} width={150} height={14} rx={4} fill="#121a3a" stroke={C.line} />
        <rect x={548} y={300} width={150 * rate} height={14} rx={4} fill={C.amber} />
        <Label x={548} y={292} size="s" color={C.dim}>
          debris swept up (schematic)
        </Label>
        <Label x={14} y={378} size="s" color={C.faint}>
          seen from above the North Pole · not to scale
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Your local time" value={hour} min={18} max={30} step={0.5} onChange={setHour} format={(v) => clock(v)} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} label="Play the dust" />
      </Controls>
      <Readout>
        {sunUp
          ? 'The Sun is up: no meteors to see.'
          : facing > 0.6
            ? `${clock(hour)}: your side of Earth faces forward along its orbit, like the windshield of a car in rain. You meet debris head-on, so more meteors, and faster ones.`
            : facing > -0.2
              ? `${clock(hour)}: your sky faces sideways to Earth's motion: a middling rate, rising toward dawn.`
              : `${clock(hour)}: your sky faces backward, like a rear window: only debris that catches up with Earth reaches you.`}
      </Readout>
    </div>
  );
}
