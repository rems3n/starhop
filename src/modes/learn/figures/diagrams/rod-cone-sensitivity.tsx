/**
 * Why red light protects night vision: the colour sensitivity of rods (night vision) and cones (day vision).
 * Curves are the standard CIE luminous efficiency functions: photopic V(λ) (CIE 1924, cones, peak 555 nm) and
 * scotopic V′(λ) (CIE 1951, rods, peak 507 nm), each scaled to its own peak. The learner slides a wavelength or
 * picks a light colour and reads how strongly each kind of cell responds.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'What colours rods and cones respond to',
  summary: 'Sensitivity of rods and cones across the spectrum; slide the wavelength or pick a light colour to compare how strongly each responds.',
  params: { nm: 'starting wavelength in nanometres, 400–700 (default 650, a red flashlight)' },
};

// 10 nm steps from 380 to 700 nm.
const NM0 = 380;
const PHOTOPIC = [0.00004, 0.00012, 0.0004, 0.0012, 0.004, 0.0116, 0.023, 0.038, 0.06, 0.091, 0.139, 0.208, 0.323, 0.503, 0.71, 0.862, 0.954, 0.995, 0.952, 0.87, 0.757, 0.631, 0.503, 0.381, 0.265, 0.175, 0.107, 0.061, 0.032, 0.017, 0.0082, 0.0041, 0.0021];
const SCOTOPIC = [0.000589, 0.002209, 0.00929, 0.03484, 0.0966, 0.1998, 0.3281, 0.455, 0.567, 0.676, 0.793, 0.904, 0.982, 0.997, 0.935, 0.811, 0.65, 0.481, 0.3288, 0.2076, 0.1212, 0.0655, 0.03315, 0.01593, 0.00737, 0.003335, 0.001497, 0.000677, 0.000313, 0.000148, 0.0000715, 0.0000353, 0.0000178];
/** Table as [nm, value] pairs, with the exact peak (555 nm cones, 507 nm rods) added. */
const table = (tab: number[], peak: number): [number, number][] =>
  [...tab.map((v, i): [number, number] => [NM0 + i * 10, v]), [peak, 1] as [number, number]].sort((a, b) => a[0] - b[0]);
const PHOT = table(PHOTOPIC, 555);
const SCOT = table(SCOTOPIC, 507);
function interp(tab: [number, number][], nm: number) {
  let i = tab.findIndex(([n]) => n >= nm);
  if (i <= 0) return tab[Math.max(0, i)][1];
  const [n0, v0] = tab[i - 1], [n1, v1] = tab[i];
  const t = (nm - n0) / (n1 - n0);
  // interpolate in log space: the tails fall off exponentially
  return Math.exp(Math.log(v0) * (1 - t) + Math.log(v1) * t);
}
const cone = (nm: number) => interp(PHOT, nm);
const rod = (nm: number) => interp(SCOT, nm);

const X0 = 70, X1 = 690, Y0 = 290, Y1 = 60;
const NMIN = 400, NMAX = 700;
const x = (nm: number) => X0 + ((nm - NMIN) / (NMAX - NMIN)) * (X1 - X0);
const y = (v: number) => Y0 - v * (Y0 - Y1);
function curve(f: (nm: number) => number) {
  const p: string[] = [];
  for (let nm = NMIN; nm <= NMAX; nm += 2) p.push(`${x(nm).toFixed(1)},${y(f(nm)).toFixed(1)}`);
  return `M ${p.join(' L ')}`;
}

/** Approximate display colour of a wavelength (for the spectrum strip and the marker only). */
function hue(nm: number): string {
  const stops: [number, number][] = [[400, 270], [440, 240], [490, 180], [510, 130], [560, 70], [580, 50], [600, 25], [640, 5], [700, 0]];
  let h = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ha] = stops[i], [b, hb] = stops[i + 1];
    if (nm >= a && nm <= b) h = ha + ((nm - a) / (b - a)) * (hb - ha);
  }
  const l = nm > 650 ? 50 - (nm - 650) * 0.4 : nm < 420 ? 35 + (nm - 400) * 0.6 : 55;
  return `hsl(${h.toFixed(0)} 85% ${l.toFixed(0)}%)`;
}

type Preset = 'red' | 'deepred' | 'green' | 'blue';
const PRESETS: Record<Preset, { nm: number; label: string; name: string }> = {
  blue: { nm: 470, label: 'Blue', name: 'blue light (470 nm)' },
  green: { nm: 520, label: 'Green', name: 'green light (520 nm)' },
  red: { nm: 630, label: 'Red LED', name: 'a typical red LED (630 nm)' },
  deepred: { nm: 660, label: 'Deep red', name: 'deep red light (660 nm)' },
};

const pct = (v: number) => (v >= 0.1 ? `${Math.round(v * 100)}%` : v >= 0.01 ? `${(v * 100).toFixed(1)}%` : `${(v * 100).toFixed(2)}%`);

export default function RodConeSensitivity({ params }: DiagramProps) {
  const [nm, setNm] = useState(typeof params?.nm === 'number' ? Math.min(700, Math.max(400, params.nm as number)) : 650);
  const r = rod(nm), c = cone(nm);
  const preset = (Object.keys(PRESETS) as Preset[]).find((k) => PRESETS[k].nm === nm);
  const ratio = c / r;

  return (
    <div>
      <Svg w={720} h={370} title={meta.title} desc="Two bell-shaped curves across the colours of the spectrum. The rod curve peaks in blue-green at 507 nanometres and falls almost to zero in the red; the cone curve peaks in yellow-green at 555 nanometres and still responds to red. A marker shows how strongly each responds at the chosen colour.">
        <defs>
          <linearGradient id="rcs-spectrum" x1="0" x2="1" y1="0" y2="0">
            {Array.from({ length: 16 }, (_, i) => {
              const n = NMIN + (i / 15) * (NMAX - NMIN);
              return <stop key={i} offset={i / 15} stopColor={hue(n)} />;
            })}
          </linearGradient>
        </defs>
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke={C.line} />
            <Label x={X0 - 8} y={y(v) + 4} anchor="end" size="s" color={C.dim}>
              {`${v * 100}%`}
            </Label>
          </g>
        ))}
        <Label x={X0} y={Y1 - 22} size="s" color={C.dim}>
          response, as a share of each cell type's best colour
        </Label>
        {/* spectrum strip */}
        <rect x={X0} y={Y0 + 8} width={X1 - X0} height={14} rx={3} fill="url(#rcs-spectrum)" />
        {[400, 450, 500, 550, 600, 650, 700].map((n) => (
          <Label key={n} x={x(n)} y={Y0 + 40} anchor="middle" size="s" color={C.dim}>
            {n}
          </Label>
        ))}
        <Label x={(X0 + X1) / 2} y={Y0 + 62} anchor="middle" size="s" color={C.dim}>
          wavelength of the light (nanometres)
        </Label>
        {/* curves */}
        <path d={curve(rod)} fill="none" stroke={C.blue} strokeWidth={3} />
        <path d={curve(cone)} fill="none" stroke={C.amber} strokeWidth={3} />
        <Label x={x(472)} y={y(rod(472)) - 10} anchor="end" color={C.blue} weight={600}>
          Rods (night vision)
        </Label>
        <Label x={x(588)} y={y(cone(588)) - 8} color={C.amber} weight={600}>
          Cones (day vision)
        </Label>
        <Label x={x(507)} y={y(1) - 8} anchor="middle" size="s" color={C.blue}>
          507 nm
        </Label>
        <Label x={x(555)} y={y(1) - 8} anchor="middle" size="s" color={C.amber}>
          555 nm
        </Label>
        {/* shaded "rods nearly blind" zone */}
        <rect x={x(620)} y={Y1} width={X1 - x(620)} height={Y0 - Y1} fill={C.red} opacity={0.08} />
        <Label x={x(660)} y={Y1 + 16} anchor="middle" size="s" color={C.dim}>
          rods almost blind
        </Label>
        {/* marker */}
        <line x1={x(nm)} x2={x(nm)} y1={Y1} y2={Y0 + 22} stroke={C.text} strokeOpacity={0.5} strokeDasharray="4 3" />
        <circle cx={x(nm)} cy={y(r)} r={6} fill={C.blue} stroke={C.bg} strokeWidth={2} />
        <circle cx={x(nm)} cy={y(c)} r={6} fill={C.amber} stroke={C.bg} strokeWidth={2} />
        <circle cx={x(nm)} cy={Y0 + 15} r={8} fill={hue(nm)} stroke={C.text} strokeWidth={1.5} />
      </Svg>
      <Controls>
        <RangeControl label="Colour of the light" value={nm} min={400} max={700} step={5} onChange={setNm} format={(v) => `${v} nm`} />
        <ChoiceControl
          label="Flashlight"
          value={preset ?? ('' as Preset)}
          options={(Object.keys(PRESETS) as Preset[]).map((k) => ({ value: k, label: PRESETS[k].label }))}
          onChange={(k) => setNm(PRESETS[k].nm)}
        />
      </Controls>
      <Readout>
        {`${preset ? `With ${PRESETS[preset].name}` : `At ${nm} nm`}, your cones respond at ${pct(c)} of their best and your rods at ${pct(r)} of theirs. `}
        {nm >= 620
          ? `Measured against their best colour, the rods are stirred about ${Math.round(ratio).toLocaleString('en-US')} times less than the cones, so you can read a chart while the rods' pigment is barely bleached.`
          : nm <= 530
            ? 'Rods are very sensitive to this colour, so even a dim light like this undoes your dark adaptation.'
            : 'Both kinds of cell still respond; only deep red leaves the rods almost untouched.'}
      </Readout>
    </div>
  );
}
