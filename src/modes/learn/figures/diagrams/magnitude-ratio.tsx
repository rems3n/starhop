/**
 * The magnitude scale as a brightness calculator. Two stars, A and B, each with a magnitude slider.
 * A ladder shows the whole-magnitude steps between them (each ×2.512, five steps = exactly ×100, Pogson 1856), and a
 * grid of dots shows how many stars like the fainter one it takes to match the brighter one.
 */
import { useState } from 'react';
import { C, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'How much brighter is one star than another?',
  summary: 'Set two magnitudes and see the brightness ratio as a ladder of ×2.5 steps and as a grid of matching faint stars.',
  params: { a: 'magnitude of star A (default 1)', b: 'magnitude of star B (default 6)' },
};

const PRESETS: { label: string; a: number; b: number; names: [string, string] }[] = [
  { label: '1 vs 6', a: 1, b: 6, names: ['a 1st-magnitude star', 'a 6th-magnitude star'] },
  { label: 'Sirius vs Polaris', a: -1.46, b: 1.97, names: ['Sirius', 'Polaris'] },
  { label: 'Polaris vs Megrez', a: 1.97, b: 3.32, names: ['Polaris', 'Megrez'] },
];

const fmtMag = (m: number) => {
  const t = Math.abs(m).toFixed(Math.abs(Math.round(m * 10) - m * 10) < 1e-6 ? 1 : 2);
  return m < 0 ? `−${t}` : t;
};
const fmtRatio = (r: number) => (r >= 100 ? Math.round(r).toLocaleString('en-US') : r >= 10 ? r.toFixed(0) : r.toFixed(1));

function Glow({ x, y, m }: { x: number; y: number; m: number }) {
  // dot size only suggests brightness (area grows with flux, capped so it fits)
  const r = Math.min(34, 3 + 9 * Math.pow(10, -0.2 * (m - 1)));
  return (
    <g>
      <circle cx={x} cy={y} r={r * 1.8} fill="url(#fig-glow)" opacity={0.35} />
      <circle cx={x} cy={y} r={r} fill={C.star} />
    </g>
  );
}

export default function MagnitudeRatio({ params }: DiagramProps) {
  const [a, setA] = useState(typeof params?.a === 'number' ? (params.a as number) : 1);
  const [b, setB] = useState(typeof params?.b === 'number' ? (params.b as number) : 6);
  const preset = PRESETS.find((p) => p.a === a && p.b === b);
  const bright = Math.min(a, b), faint = Math.max(a, b);
  const diff = faint - bright;
  const ratio = Math.pow(10, 0.4 * diff);
  const whole = Math.floor(diff + 1e-9);
  const nDots = Math.min(100, Math.round(ratio));
  const names = preset ? preset.names : [`a magnitude ${fmtMag(a)} star`, `a magnitude ${fmtMag(b)} star`];
  const brightName = a <= b ? names[0] : names[1];
  const faintName = a <= b ? names[1] : names[0];

  // ladder of steps
  const LX0 = 270, LX1 = 690, LY = 70;
  const stepW = diff > 0 ? (LX1 - LX0) / Math.max(diff, 1) : 0;

  return (
    <div>
      <Svg w={720} h={360} title={meta.title} desc="Two stars labelled A and B with their magnitudes. A ladder of steps between them shows a factor of about 2.5 per magnitude, and a grid of small dots shows how many of the fainter star it takes to equal the brighter one.">
        {/* the two stars */}
        <Glow x={70} y={110} m={a} />
        <Glow x={190} y={110} m={b} />
        <Label x={70} y={180} anchor="middle" weight={700}>
          A
        </Label>
        <Label x={70} y={198} anchor="middle" size="s" color={C.dim}>
          {`mag ${fmtMag(a)}`}
        </Label>
        <Label x={190} y={180} anchor="middle" weight={700}>
          B
        </Label>
        <Label x={190} y={198} anchor="middle" size="s" color={C.dim}>
          {`mag ${fmtMag(b)}`}
        </Label>
        <Label x={130} y={36} anchor="middle" size="s" color={C.dim}>
          dot size only suggests brightness
        </Label>

        {/* ladder */}
        <Label x={LX0} y={LY - 30} size="s" color={C.dim}>
          {diff < 0.05 ? 'same magnitude: same brightness' : `${diff.toFixed(2).replace(/\.?0+$/, '')} magnitudes apart`}
        </Label>
        {diff >= 0.05 && (
          <g>
            <line x1={LX0} x2={LX0 + stepW * diff} y1={LY} y2={LY} stroke={C.lineStrong} strokeWidth={2} />
            {Array.from({ length: whole + 1 }, (_, i) => (
              <g key={i}>
                <line x1={LX0 + i * stepW} x2={LX0 + i * stepW} y1={LY - 7} y2={LY + 7} stroke={C.lineStrong} strokeWidth={2} />
                {i < whole && stepW > 34 && (
                  <Label x={LX0 + (i + 0.5) * stepW} y={LY + 24} anchor="middle" size="s" color={C.amber}>
                    ×2.5
                  </Label>
                )}
              </g>
            ))}
            <line x1={LX0 + stepW * diff} x2={LX0 + stepW * diff} y1={LY - 7} y2={LY + 7} stroke={C.lineStrong} strokeWidth={2} />
            {diff >= 5 && (
              <path d={`M ${LX0} ${LY + 36} q ${(5 * stepW) / 2} 18 ${5 * stepW} 0`} fill="none" stroke={C.amber} strokeDasharray="3 3" />
            )}
            {diff >= 5 && (
              <Label x={LX0 + 2.5 * stepW} y={LY + 62} anchor="middle" size="s" color={C.amber}>
                5 steps = exactly ×100
              </Label>
            )}
          </g>
        )}

        {/* dot grid */}
        <Label x={LX0} y={146} size="s" color={C.dim}>
          {nDots >= 100 && ratio > 100.5 ? 'the first 100 of them:' : `${brightName.replace(/^a /, 'A ')} shines like this many of ${faintName.replace(/^a /, 'the ')}:`}
        </Label>
        {Array.from({ length: 100 }, (_, i) => {
          const cx = LX0 + 10 + (i % 20) * 21;
          const cy = 170 + Math.floor(i / 20) * 21;
          return <circle key={i} cx={cx} cy={cy} r={5} fill={i < nDots ? C.star : 'none'} stroke={i < nDots ? 'none' : C.line} />;
        })}
        <Label x={LX0} y={300} weight={700} size="l" color={C.amber}>
          {`× ${fmtRatio(ratio)}`}
        </Label>
        <Label x={LX0 + 90} y={300} size="s" color={C.dim}>
          {ratio > 100.5 ? `(${fmtRatio(ratio)} in all; only 100 dots drawn)` : 'brighter'}
        </Label>
        <Label x={20} y={340} size="s" color={C.dim}>
          each whole magnitude is a factor of 2.512; 2.512 × 2.512 × 2.512 × 2.512 × 2.512 = 100
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Star A" value={a} min={-1.5} max={7} step={0.5} onChange={setA} format={(v) => `mag ${fmtMag(v)}`} />
        <RangeControl label="Star B" value={b} min={-1.5} max={7} step={0.5} onChange={setB} format={(v) => `mag ${fmtMag(v)}`} />
        <div className="fig-choice" role="group" aria-label="Examples">
          <span className="fig-range-label">Examples</span>
          <div className="segmented">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" aria-pressed={preset === p} onClick={() => { setA(p.a); setB(p.b); }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Controls>
      <Readout>
        {diff < 0.05
          ? 'Equal magnitudes mean equal brightness.'
          : `${brightName[0].toUpperCase()}${brightName.slice(1)} (magnitude ${fmtMag(bright)}) is about ${fmtRatio(ratio)} times brighter than ${faintName} (magnitude ${fmtMag(faint)}). Remember: the smaller number is the brighter star.`}
      </Readout>
    </div>
  );
}
