/**
 * Mass decides a star's life. Slide the mass of a main-sequence star from 0.1 to 40 Suns: the star's colour and size
 * change, a "fuel" bar (∝ mass) and a "burn rate" bar (∝ luminosity, log scale) show why heavier stars die younger,
 * and the lifetime appears on a log timeline next to the age of the Earth and of the universe.
 * Relations are rough textbook rules (objects-lib: msLum, msLifetime); the figure says so.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, clamp, type DiagramMeta, type DiagramProps } from '../kit';
import { fmt, msLifetime, msLum, msRadius, msTemp, sig, tempColor, years } from './objects-lib';

export const meta: DiagramMeta = {
  title: 'Heavier stars live shorter lives',
  summary: 'Slide a star’s mass and watch its colour, brightness and main-sequence lifetime change, with real stars to jump to.',
  params: { mass: 'starting mass in Suns, 0.1–40 (default 1)' },
};

/** Masses in Suns, Wikipedia infoboxes (Nov 2026). */
const STARS = [
  { id: 'proxima', name: 'Proxima Cen', M: 0.12 },
  { id: 'sun', name: 'Sun', M: 1 },
  { id: 'sirius', name: 'Sirius', M: 2.06 },
  { id: 'spica', name: 'Spica', M: 10 },
  { id: 'rigel', name: 'Rigel', M: 21 },
  { id: 'alnitak', name: 'Alnitak', M: 33 },
];
const MMIN = 0.1, MMAX = 40;
const toS = (M: number) => (1000 * Math.log(M / MMIN)) / Math.log(MMAX / MMIN);
const fromS = (s: number) => MMIN * Math.pow(MMAX / MMIN, s / 1000);

// timeline: log years 1e6 … 1e13
const TX0 = 40, TX1 = 680, TY = 300;
const tx = (y: number) => TX0 + ((Math.log10(y) - 6) / 7) * (TX1 - TX0);

export default function LifetimeVsMass({ params }: DiagramProps) {
  const [M, setM] = useState(typeof params?.mass === 'number' ? clamp(params.mass as number, MMIN, MMAX) : 1);
  const L = msLum(M), R = msRadius(M), T = msTemp(M), life = msLifetime(M);
  const near = STARS.find((s) => Math.abs(Math.log(s.M / M)) < 0.04);
  const rDisc = clamp(30 * Math.pow(R, 0.5), 7, 95);
  // bars: fuel linear in mass (0–40), burn rate log (1e-3 … 1e6)
  const fuelW = (M / MMAX) * 270;
  const burnW = ((Math.log10(L) + 3) / 9) * 270;
  const universe = 13.8e9;

  return (
    <div>
      <Svg w={720} h={360} title={meta.title} desc="Left: a star drawn in the colour and relative size for the chosen mass. Right: a fuel bar and a brightness bar. Bottom: a timeline from a million to ten trillion years showing how long the star lives, compared with the age of the Earth and of the universe.">
        <circle cx={120} cy={130} r={rDisc} fill={tempColor(T)} />
        <Label x={120} y={250} anchor="middle" weight={700}>{fmt(sig(M, 2))} × the Sun’s mass</Label>
        <Label x={120} y={26} anchor="middle" size="s" color={C.dim}>size exaggerated for small stars</Label>

        {/* fuel and burn-rate bars */}
        <Label x={300} y={58} weight={600}>Fuel (hydrogen)</Label>
        <Label x={300} y={74} size="s" color={C.dim}>grows with mass</Label>
        <rect x={360 + 60} y={50} width={270} height={22} rx={4} fill={C.panel} stroke={C.line} />
        <rect x={360 + 60} y={50} width={Math.max(2, fuelW)} height={22} rx={4} fill={C.amber} />
        <Label x={360 + 60 + Math.max(2, fuelW) + 6} y={66} size="s">{fmt(sig(M, 2))} ×</Label>

        <Label x={300} y={130} weight={600}>Burn rate</Label>
        <Label x={300} y={146} size="s" color={C.dim}>(brightness)</Label>
        <rect x={420} y={122} width={270} height={22} rx={4} fill={C.panel} stroke={C.line} />
        <rect x={420} y={122} width={clamp(burnW, 2, 270)} height={22} rx={4} fill={C.red} />
        <Label x={clamp(420 + burnW + 6, 426, 650)} y={138} size="s">{L >= 1 ? `${fmt(sig(L, 2))} ×` : `1/${fmt(sig(1 / L, 2))}`}</Label>
        <Label x={420} y={162} size="s" color={C.dim}>log scale: each step is ×10</Label>
        {[0, 3, 6, 9].map((k) => (
          <line key={k} x1={420 + (k / 9) * 270} x2={420 + (k / 9) * 270} y1={120} y2={146} stroke={C.lineStrong} strokeOpacity={0.4} />
        ))}
        <Label x={300} y={208} size="s" color={C.dim}>A star twice the Sun’s mass has twice the fuel</Label>
        <Label x={300} y={224} size="s" color={C.dim}>but burns it about 16 times faster.</Label>

        {/* timeline */}
        <line x1={TX0} x2={TX1} y1={TY} y2={TY} stroke={C.lineStrong} />
        {[6, 7, 8, 9, 10, 11, 12, 13].map((k) => (
          <g key={k}>
            <line x1={tx(10 ** k)} x2={tx(10 ** k)} y1={TY - 4} y2={TY + 4} stroke={C.lineStrong} />
            <Label x={tx(10 ** k)} y={TY + 18} anchor="middle" size="s" color={C.dim}>
              {['1 Myr', '10 Myr', '100 Myr', '1 Gyr', '10 Gyr', '100 Gyr', '1 Tyr', '10 Tyr'][k - 6]}
            </Label>
          </g>
        ))}
        <rect x={TX0} y={TY - 14} width={Math.max(3, tx(life) - TX0)} height={10} rx={3} fill={tempColor(T)} />
        <line x1={tx(universe)} x2={tx(universe)} y1={TY - 40} y2={TY} stroke={C.blue} strokeDasharray="3 3" />
        <Label x={tx(universe) + 4} y={TY - 30} size="s" color={C.blue}>age of the universe</Label>
        <line x1={tx(4.5e9)} x2={tx(4.5e9)} y1={TY - 56} y2={TY} stroke={C.good} strokeDasharray="3 3" />
        <Label x={tx(4.5e9) - 4} y={TY - 46} anchor="end" size="s" color={C.good}>age of the Earth</Label>
        <Label x={TX0} y={TY + 40} size="s" color={C.dim}>
          main-sequence lifetime (Myr = million, Gyr = billion, Tyr = trillion years) · rough rule, good to about a factor of 2
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Mass" value={Math.round(toS(M))} min={0} max={1000} onChange={(v) => setM(fromS(v))} format={() => `${fmt(sig(M, 2))} Suns`} />
        <ChoiceControl label="Jump to a star" value={near?.id ?? ''} options={STARS.map((s) => ({ value: s.id, label: s.name }))} onChange={(id) => setM(STARS.find((s) => s.id === id)!.M)} />
      </Controls>
      <Readout>
        {near ? `${near.name}: ` : ''}A star of {fmt(sig(M, 2))} solar masses shines about {L >= 1 ? `${fmt(sig(L, 2))} times as bright as` : `${fmt(sig(1 / L, 2))} times dimmer than`} the Sun and lives about {years(life)} on the main sequence.
        {life > universe ? ' That is longer than the universe has existed: no star this small has ever died.' : life < 1e8 ? ' It will be gone before its birth cloud has drifted apart.' : ''}
      </Readout>
    </div>
  );
}
