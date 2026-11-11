/**
 * Apparent vs absolute magnitude: the same lamp looks fainter the farther away it is.
 * m = M + 5·log10(d / 10 pc), with 10 pc = 32.6 light-years. The learner picks a star (absolute magnitude and real
 * distance from the catalog; the Sun M = 4.83 at 1 AU) and slides it nearer or farther on a log distance scale,
 * reading how bright it would look and whether a city or dark sky would show it.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'How bright it looks vs how bright it is',
  summary: 'Move the Sun, Sirius, Vega, Polaris or Rigel nearer or farther and see its apparent magnitude change; 32.6 light-years gives its absolute magnitude.',
  params: { star: '"Sun" | "Sirius" | "Vega" | "Polaris" | "Rigel" (default "Sirius")' },
};

const LY_PER_PC = 3.26156;
const AU_IN_LY = 1.58125e-5;
type StarId = 'Sun' | 'Sirius' | 'Vega' | 'Polaris' | 'Rigel';
/** [absolute magnitude, real distance in ly] — catalog (HYG) values; Sun M 4.83 at 1 AU */
const STARS: Record<StarId, [number, number]> = {
  Sun: [4.83, AU_IN_LY],
  Sirius: [1.45, 8.6],
  Vega: [0.6, 25],
  Polaris: [-3.64, 433],
  Rigel: [-6.93, 863],
};
const apparent = (M: number, ly: number) => M + 5 * Math.log10(ly / LY_PER_PC / 10);
const STD = 10 * LY_PER_PC; // 32.6 ly

// distance axis: log10(ly) from −5 (an AU is 1.6e-5 ly) to 4 (10,000 ly)
const L0 = -5, L1 = 4;
const DX0 = 50, DX1 = 670, DY = 300;
const dx = (ly: number) => DX0 + ((Math.log10(ly) - L0) / (L1 - L0)) * (DX1 - DX0);
// magnitude axis (vertical): −27 at top … +12 at bottom
const MY0 = 46, MY1 = 236;
const my = (m: number) => MY0 + ((Math.max(-27, Math.min(12, m)) + 27) / 39) * (MY1 - MY0);

function fmtDist(ly: number) {
  if (ly < 0.001) return `${(ly / AU_IN_LY).toFixed(ly / AU_IN_LY < 10 ? 1 : 0)} AU (Earth–Sun distances)`;
  if (ly < 1) return `${ly.toFixed(3)} light-years`;
  return `${ly < 100 ? ly.toFixed(1) : Math.round(ly).toLocaleString('en-US')} light-years`;
}
const fmtMag = (m: number) => `${m < 0 ? '−' : ''}${Math.abs(m).toFixed(1)}`;

export default function ApparentAbsolute({ params }: DiagramProps) {
  const [star, setStar] = useState<StarId>(typeof params?.star === 'string' && params.star in STARS ? (params.star as StarId) : 'Sirius');
  const [M, real] = STARS[star];
  const [logd, setLogd] = useState(Math.log10(real));
  const ly = Math.pow(10, logd);
  const m = apparent(M, ly);
  const isReal = Math.abs(logd - Math.log10(real)) < 0.02;
  const isStd = Math.abs(logd - Math.log10(STD)) < 0.02;
  const glow = Math.max(3, Math.min(42, 8 * Math.pow(10, -0.12 * m)));
  const pick = (s: StarId) => {
    setStar(s);
    setLogd(Math.log10(STARS[s][1]));
  };
  const seen = m <= 4 ? 'easy to see even from a city' : m <= 6.5 ? 'visible from a dark site, lost in a city sky' : 'too faint for the naked eye anywhere';

  return (
    <div>
      <Svg w={720} h={370} title={meta.title} desc="A star placed along a distance scale from one Earth–Sun distance to 10,000 light-years, with a magnitude scale showing how bright it looks. Moving it farther away makes it fainter by five magnitudes for every tenfold increase in distance; at 32.6 light-years its apparent magnitude equals its absolute magnitude.">
        {/* magnitude scale on the left */}
        <line x1={DX0} x2={DX0} y1={MY0} y2={MY1} stroke={C.lineStrong} />
        {[-25, -20, -15, -10, -5, 0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={DX0 - 4} x2={DX0} y1={my(v)} y2={my(v)} stroke={C.lineStrong} />
            <Label x={DX0 - 8} y={my(v) + 4} anchor="end" size="s" color={C.dim}>
              {fmtMag(v).replace('.0', '')}
            </Label>
          </g>
        ))}
        <Label x={DX0 + 6} y={MY0 - 16} size="s" color={C.dim}>
          how bright it looks (apparent magnitude)
        </Label>
        {/* limit bands */}
        <line x1={DX0} x2={DX1} y1={my(4)} y2={my(4)} stroke={C.line} strokeDasharray="4 4" />
        <Label x={DX1} y={my(4) - 5} anchor="end" size="s" color={C.dim}>
          city limit ≈ 4
        </Label>
        <line x1={DX0} x2={DX1} y1={my(6.5)} y2={my(6.5)} stroke={C.line} strokeDasharray="4 4" />
        <Label x={DX1} y={my(6.5) + 15} anchor="end" size="s" color={C.dim}>
          dark-sky limit ≈ 6.5
        </Label>
        {/* apparent magnitude curve for this star */}
        <path
          d={`M ${Array.from({ length: 91 }, (_, i) => {
            const L = L0 + (i / 90) * (L1 - L0);
            return `${dx(Math.pow(10, L)).toFixed(1)},${my(apparent(M, Math.pow(10, L))).toFixed(1)}`;
          }).join(' L ')}`}
          fill="none"
          stroke={C.amber}
          strokeWidth={1.5}
          opacity={0.6}
        />
        {/* distance axis */}
        <line x1={DX0} x2={DX1} y1={DY} y2={DY} stroke={C.lineStrong} strokeWidth={1.5} />
        {[
          [AU_IN_LY, '1 AU'],
          [0.01, '0.01'],
          [1, '1 ly'],
          [100, '100'],
          [10000, '10,000 ly'],
        ].map(([v, t]) => (
          <g key={t as string}>
            <line x1={dx(v as number)} x2={dx(v as number)} y1={DY - 5} y2={DY + 5} stroke={C.lineStrong} />
            <Label x={dx(v as number)} y={DY + 22} anchor="middle" size="s" color={C.dim}>
              {t as string}
            </Label>
          </g>
        ))}
        <line x1={dx(STD)} x2={dx(STD)} y1={MY0} y2={DY} stroke={C.blue} strokeDasharray="5 4" />
        <Label x={dx(STD) + 6} y={DY - 10} size="s" color={C.blue}>
          32.6 ly: absolute magnitude
        </Label>
        <line x1={dx(real)} x2={dx(real)} y1={DY - 12} y2={DY + 12} stroke={C.text} strokeWidth={2} />
        <Label x={dx(real)} y={DY + 40} anchor="middle" size="s" color={C.text}>
          {`real distance`}
        </Label>
        <Label x={(DX0 + DX1) / 2} y={DY + 62} anchor="middle" size="s" color={C.dim}>
          distance from you (each tick ×100)
        </Label>
        {/* the star */}
        <line x1={dx(ly)} x2={dx(ly)} y1={my(m)} y2={DY} stroke={C.text} strokeOpacity={0.3} />
        <circle cx={dx(ly)} cy={my(m)} r={glow * 1.6} fill="url(#fig-glow)" opacity={0.5} />
        <circle cx={dx(ly)} cy={my(m)} r={Math.max(3, glow / 3)} fill={star === 'Sun' ? C.sun : C.star} />
        <Label x={dx(ly) + (dx(ly) > 560 ? -14 : 14)} y={my(m) - 10} anchor={dx(ly) > 560 ? 'end' : 'start'} weight={700}>
          {`${star}: ${fmtMag(m)}`}
        </Label>
      </Svg>
      <Controls>
        <ChoiceControl label="Star" value={star} options={(Object.keys(STARS) as StarId[]).map((s) => ({ value: s, label: s }))} onChange={pick} />
        <RangeControl label="Distance" value={Math.round(logd * 100) / 100} min={L0} max={L1} step={0.01} onChange={setLogd} format={() => fmtDist(ly)} />
        <button type="button" className="btn btn--sm" onClick={() => setLogd(Math.log10(STD))}>
          Move to 32.6 light-years
        </button>
      </Controls>
      <Readout>
        {`${star} ${isReal ? 'at its real distance' : 'at'} ${fmtDist(ly)}: apparent magnitude ${fmtMag(m)}, ${seen}. `}
        {isStd
          ? `This is the standard distance, so ${fmtMag(m)} is ${star === 'Sun' ? 'the Sun' : star}'s absolute magnitude.`
          : `Its absolute magnitude, how bright it would look from 32.6 light-years, is ${fmtMag(M)}.`}
      </Readout>
    </div>
  );
}
