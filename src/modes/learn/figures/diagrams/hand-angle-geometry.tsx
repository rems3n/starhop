/**
 * Why your hand works as a protractor: an object of width w at distance d covers an angle 2·atan(w / 2d).
 * Side view of an eye, an outstretched arm and the hand held up against the sky, with the angle drawn to scale.
 * The learner picks a hand measure and switches between an adult and a child: the child's hand is smaller but
 * closer to the eye, so the angle stays the same. Body sizes are typical round numbers, for illustration.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: "Your hand at arm's length",
  summary: 'Side view of an outstretched arm with the angle each hand measure covers, drawn to scale; switch between finger, three fingers, fist and spread hand, and between an adult and a child.',
  params: { measure: '"finger" | "three" | "fist" | "span" (default "fist")' },
};

type Measure = 'finger' | 'three' | 'fist' | 'span';
/** Typical adult widths in cm (illustrative); a child's are taken as 3/4 of these, with a 3/4-length arm. */
const WIDTH: Record<Measure, number> = { finger: 1.0, three: 5.2, fist: 10.5, span: 22 };
const NAME: Record<Measure, string> = { finger: 'little finger', three: 'three middle fingers', fist: 'closed fist', span: 'spread hand' };
const ARM = 60; // eye-to-hand distance for an adult, cm

const EYE: [number, number] = [70, 250];
const PX_PER_CM = 8.4;

function FrontView({ m, x, y, s }: { m: Measure; x: number; y: number; s: number }) {
  // Small front-view sketch of the hand shape, s = px per cm, centred at (x, y) on the measured width.
  const w = WIDTH[m] * s;
  const fill = 'rgba(232, 196, 160, 0.9)';
  if (m === 'finger') return <rect x={x - w / 2} y={y - 3.4 * s} width={w} height={6.8 * s} rx={w / 2} fill={fill} />;
  if (m === 'three')
    return (
      <g>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={x - w / 2 + (i * w) / 3 + 0.5} y={y - (i === 1 ? 4.2 : 3.6) * s} width={w / 3 - 1} height={(i === 1 ? 8.4 : 7.6) * s} rx={w / 6} fill={fill} />
        ))}
      </g>
    );
  if (m === 'fist')
    return (
      <g>
        <rect x={x - w / 2} y={y - 0.45 * w} width={w} height={0.9 * w} rx={0.18 * w} fill={fill} />
        {[0, 1, 2].map((i) => (
          <line key={i} x1={x - w / 2 + ((i + 1) * w) / 4} x2={x - w / 2 + ((i + 1) * w) / 4} y1={y - 0.45 * w + 2} y2={y - 0.12 * w} stroke="rgba(120,80,60,0.7)" strokeWidth={1} />
        ))}
      </g>
    );
  // spread hand: thumb tip to little-finger tip
  const p = (u: number, v: number) => `${(x + u * w).toFixed(1)},${(y + v * w).toFixed(1)}`;
  return (
    <path
      d={`M ${p(-0.5, -0.08)} L ${p(-0.36, -0.2)} L ${p(-0.16, 0.0)} L ${p(-0.14, -0.42)} L ${p(-0.06, -0.44)} L ${p(-0.02, -0.06)} L ${p(0.02, -0.48)} L ${p(0.1, -0.48)} L ${p(0.11, -0.06)} L ${p(0.2, -0.42)} L ${p(0.27, -0.4)} L ${p(0.22, 0.0)} L ${p(0.45, -0.24)} L ${p(0.5, -0.18)} L ${p(0.24, 0.2)} L ${p(0.16, 0.36)} L ${p(-0.14, 0.36)} L ${p(-0.2, 0.14)} Z`}
      fill={fill}
    />
  );
}

export default function HandAngleGeometry({ params }: DiagramProps) {
  const [m, setM] = useState<Measure>((['finger', 'three', 'fist', 'span'] as const).includes(params?.measure as Measure) ? (params?.measure as Measure) : 'fist');
  const [who, setWho] = useState<'adult' | 'child'>('adult');
  const f = who === 'adult' ? 1 : 0.75;
  const arm = ARM * f, width = WIDTH[m] * f;
  const angle = (2 * Math.atan(width / 2 / arm) * 180) / Math.PI;
  const hx = EYE[0] + arm * PX_PER_CM;
  const half = (width / 2) * PX_PER_CM;
  // rays from the eye past the top and bottom of the hand, out to the right edge
  const far = 700;
  const ry = (dy: number) => EYE[1] + (dy * (far - EYE[0])) / (hx - EYE[0]);
  const headR = 26 * f;

  return (
    <div>
      <Svg w={720} h={390} title={meta.title} desc="Side view of a person holding a hand out at arm's length against the sky. Two lines from the eye pass the top and bottom of the hand and spread out into the sky, showing the angle the hand covers. A child's smaller hand on a shorter arm covers the same angle.">
        {/* sky side */}
        <Label x={700} y={34} anchor="end" size="s" color={C.dim}>
          angles drawn to scale; body sizes typical, for illustration
        </Label>
        {/* rays */}
        <path d={`M ${EYE[0]} ${EYE[1]} L ${far} ${ry(-half)} L ${far} ${ry(half)} Z`} fill={C.amber} opacity={0.12} />
        <line x1={EYE[0]} y1={EYE[1]} x2={far} y2={ry(-half)} stroke={C.amber} strokeWidth={1.3} />
        <line x1={EYE[0]} y1={EYE[1]} x2={far} y2={ry(half)} stroke={C.amber} strokeWidth={1.3} />
        {/* head and arm */}
        <circle cx={EYE[0] - headR * 0.55} cy={EYE[1] + headR * 0.1} r={headR} fill="#3a4672" stroke={C.lineStrong} />
        <circle cx={EYE[0]} cy={EYE[1]} r={3} fill={C.text} />
        <path d={`M ${EYE[0] - headR * 0.6} ${EYE[1] + headR * 1.1} L ${EYE[0] - headR * 0.4} ${EYE[1] + headR * 1.9} L ${hx - 6} ${EYE[1] + 12} `} fill="none" stroke="#3a4672" strokeWidth={13 * f} strokeLinecap="round" strokeLinejoin="round" />
        {/* hand, edge-on */}
        <rect x={hx - 7} y={EYE[1] - half} width={14} height={Math.max(2, half * 2)} rx={5} fill="rgba(232, 196, 160, 0.95)" />
        {/* distance bracket */}
        <line x1={EYE[0]} x2={hx} y1={EYE[1] + 78} y2={EYE[1] + 78} stroke={C.lineStrong} markerStart="url(#fig-arrow)" markerEnd="url(#fig-arrow)" />
        <Label x={(EYE[0] + hx) / 2} y={EYE[1] + 100} anchor="middle" size="s" color={C.dim}>
          {`eye to hand: ${arm.toFixed(0)} cm`}
        </Label>
        <Label x={hx + 12} y={EYE[1] - half - 8} size="s" color={C.dim}>
          {`${width.toFixed(width < 2 ? 2 : 1)} cm across`}
        </Label>
        {/* angle label out in the sky */}
        <Label x={far - 8} y={ry(-half) - 10} anchor="end" weight={700} color={C.amber} size="l">
          {`${angle.toFixed(angle < 2 ? 1 : 0)}°`}
        </Label>
        <Label x={far - 8} y={ry(half) + 22} anchor="end" size="s" color={C.dim}>
          of sky covered
        </Label>
        <Label x={EYE[0] - 10} y={EYE[1] - headR - 14} size="s" color={C.dim}>
          {who === 'adult' ? 'adult' : 'child'}
        </Label>
        {/* front view inset */}
        <rect x={520} y={250} width={180} height={124} rx={8} fill={C.panel} stroke={C.line} />
        <Label x={610} y={268} anchor="middle" size="s" color={C.dim}>
          {`seen from the front: ${NAME[m]}`}
        </Label>
        <FrontView m={m} x={610} y={m === 'span' ? 326 : 322} s={m === 'span' ? 6.2 * f : 6.2 * f} />
      </Svg>
      <Controls>
        <ChoiceControl
          label="Measure with"
          value={m}
          options={[
            { value: 'finger', label: 'Little finger' },
            { value: 'three', label: '3 fingers' },
            { value: 'fist', label: 'Fist' },
            { value: 'span', label: 'Spread hand' },
          ]}
          onChange={setM}
        />
        <ChoiceControl
          label="Whose hand"
          value={who}
          options={[
            { value: 'adult', label: 'Adult' },
            { value: 'child', label: 'Child' },
          ]}
          onChange={setWho}
        />
      </Controls>
      <Readout>
        {`A ${NAME[m]} ${width.toFixed(1)} cm across, held ${arm.toFixed(0)} cm from the eye, covers about ${angle.toFixed(angle < 2 ? 1 : 0)}° of sky. `}
        {who === 'adult'
          ? 'Switch to a child: the hand is smaller, but so is the arm.'
          : 'The child’s hand is a quarter smaller, but it is also a quarter closer to the eye, so it covers exactly the same angle.'}
      </Readout>
    </div>
  );
}
