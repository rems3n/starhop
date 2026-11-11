/**
 * How skyglow forms: a side view of a town and an observer some distance away. (1) Lamps send light up, directly
 * from unshielded fixtures and by reflection from the ground. (2) Air molecules, dust and water droplets scatter some
 * of it. (3) Part of the scattered light comes back down from every direction, so the whole sky glows and faint
 * stars are lost against it. The learner switches the town's lamps between unshielded and fully shielded and changes
 * how hazy the air is. The glow levels are illustrative (no physical units); not to scale.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Step, Svg, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'How a city lights up the sky',
  summary: 'Side view of a town lighting up the air above it; switch lamps between unshielded and shielded and change the haze to see the glow dome grow or shrink.',
  params: { shielded: 'true to start with shielded lamps (default false)' },
};

const GROUND = 330;
// deterministic scatter points in the air above the town
const SCATTER: [number, number][] = Array.from({ length: 26 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  return [70 + (a - Math.floor(a)) * 380, 70 + (b - Math.floor(b)) * 190];
});

export default function Skyglow({ params }: DiagramProps) {
  const [shielded, setShielded] = useState(params?.shielded === true);
  const [haze, setHaze] = useState(1);
  // share of lamp light sent upward: direct (unshielded only) plus a ground-reflected part (always)
  const up = (shielded ? 0 : 1) + 0.45;
  const glow = Math.min(1, (up / 1.45) * (0.45 + 0.35 * haze));
  const stars: [number, number, number][] = [
    [520, 60, 2.6], [600, 90, 1.6], [660, 50, 2.2], [560, 130, 1.3], [690, 120, 1.8], [480, 100, 1.2], [630, 160, 1.1], [540, 30, 1.4], [700, 200, 1.0], [590, 210, 1.5],
  ];
  const limit = 2.6 - glow * 1.6; // radius threshold: stars smaller than this are drowned (illustrative)

  return (
    <div>
      <Svg w={720} h={390} title={meta.title} desc="Side view: a town on the left with street lamps; light goes up from the lamps and from the ground, is scattered by particles in the air, and some of it comes back down toward an observer standing in the countryside on the right, making a glowing dome over the town that hides faint stars.">
        <defs>
          <radialGradient id="sg-dome" cx="0.38" cy="1" r="0.9">
            <stop offset="0" stopColor="#e8a85a" stopOpacity={0.55 * glow + 0.05} />
            <stop offset="0.45" stopColor="#c88a5a" stopOpacity={0.3 * glow} />
            <stop offset="1" stopColor="#c88a5a" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect x={1} y={1} width={718} height={GROUND - 1} fill="url(#sg-dome)" />
        {/* stars over the observer, faint ones lost in the glow */}
        {stars.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={C.star} opacity={r >= limit ? 1 : 0.08} />
        ))}
        {/* ground */}
        <rect x={1} y={GROUND} width={718} height={58} fill="#141a33" />
        <line x1={1} x2={719} y1={GROUND} y2={GROUND} stroke={C.lineStrong} />
        {/* town */}
        {[[40, 70], [80, 110], [125, 60], [160, 140], [205, 90], [245, 120], [290, 70], [330, 100], [370, 55]].map(([x, h], i) => (
          <rect key={i} x={x} y={GROUND - h} width={36} height={h} fill="#262d4f" stroke={C.line} />
        ))}
        {[60, 140, 220, 300, 380, 430].map((x) => (
          <g key={x}>
            <line x1={x} x2={x} y1={GROUND} y2={GROUND - 34} stroke={C.lineStrong} strokeWidth={2} />
            {shielded ? <path d={`M ${x - 9} ${GROUND - 36} h 18 l -4 6 h -10 z`} fill={C.lineStrong} /> : null}
            <circle cx={x} cy={GROUND - 32} r={4} fill={C.sun} />
            {/* light going down to the street */}
            <path d={`M ${x} ${GROUND - 30} L ${x - 22} ${GROUND} L ${x + 22} ${GROUND} Z`} fill={C.sun} opacity={0.15} />
            {/* direct upward light from unshielded lamps */}
            {!shielded && (
              <>
                <line x1={x} y1={GROUND - 36} x2={x - 26} y2={GROUND - 110} stroke={C.sun} strokeWidth={1.3} opacity={0.75} markerEnd="url(#fig-arrow)" />
                <line x1={x} y1={GROUND - 36} x2={x + 18} y2={GROUND - 120} stroke={C.sun} strokeWidth={1.3} opacity={0.75} markerEnd="url(#fig-arrow)" />
              </>
            )}
            {/* light reflected from the pavement */}
            <line x1={x + 12} y1={GROUND - 2} x2={x + 30} y2={GROUND - 64} stroke={C.sun} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} markerEnd="url(#fig-arrow)" />
          </g>
        ))}
        {/* scattering particles */}
        {SCATTER.slice(0, Math.round(10 + haze * 8)).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2} fill={C.text} opacity={0.6} />
        ))}
        {/* scattered light heading to the observer */}
        {[[300, 120], [380, 90], [430, 170]].map(([x, y], i) => (
          <line key={i} x1={x} y1={y} x2={600 - i * 6} y2={GROUND - 48} stroke={C.amber} strokeWidth={1.4} opacity={0.35 + 0.5 * glow} strokeDasharray="5 4" markerEnd="url(#fig-arrow)" />
        ))}
        {/* observer */}
        <circle cx={612} cy={GROUND - 42} r={7} fill={C.moon} />
        <line x1={612} y1={GROUND - 35} x2={612} y2={GROUND - 8} stroke={C.moon} strokeWidth={3} />
        <line x1={612} y1={GROUND - 8} x2={604} y2={GROUND} stroke={C.moon} strokeWidth={3} />
        <line x1={612} y1={GROUND - 8} x2={620} y2={GROUND} stroke={C.moon} strokeWidth={3} />
        <Label x={612} y={GROUND + 24} anchor="middle" size="s" color={C.dim}>
          you, outside town
        </Label>
        <Label x={220} y={GROUND + 24} anchor="middle" size="s" color={C.dim}>
          {shielded ? 'town with shielded lamps' : 'town with unshielded lamps'}
        </Label>
        {/* steps */}
        <Step x={36} y={GROUND - 150} n={1} />
        <Label x={52} y={GROUND - 146} size="s">
          light escapes upward
        </Label>
        <Step x={180} y={44} n={2} />
        <Label x={196} y={48} size="s">
          air, dust and droplets scatter it
        </Label>
        <Step x={470} y={226} n={3} />
        <Label x={486} y={230} size="s">
          some comes back down to you
        </Label>
        <Label x={706} y={30} anchor="end" size="s" color={C.dim}>
          not to scale
        </Label>
      </Svg>
      <Controls>
        <ChoiceControl
          label="Street lamps"
          value={shielded ? 'yes' : 'no'}
          options={[
            { value: 'no', label: 'Unshielded' },
            { value: 'yes', label: 'Shielded' },
          ]}
          onChange={(v) => setShielded(v === 'yes')}
        />
        <RangeControl label="Haze in the air" value={haze} min={0} max={2} step={1} onChange={setHaze} format={(v) => ['clear, dry air', 'typical', 'humid or hazy'][v]} />
      </Controls>
      <Readout>
        {shielded
          ? 'Shielded lamps put all their light on the street, so none goes straight up. Light still bounces up off the pavement, so a smaller glow remains, but more stars come back.'
          : 'Unshielded lamps send part of their light straight into the sky, on top of what bounces off the ground. Particles in the air scatter it back down from every direction, so the sky behind the stars glows and the faint ones vanish.'}
        {haze === 2 ? ' Humid, hazy air scatters more of it: the glow grows.' : haze === 0 ? ' Clear, dry air scatters less: the best nights follow a cold front.' : ''}
      </Readout>
    </div>
  );
}
