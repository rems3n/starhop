/**
 * Temperature → colour. A glowing body's colour and its light spectrum (Planck curve) for a chosen temperature,
 * with real stars marked on a temperature strip. Colours are computed from Planck's law and the CIE eye response,
 * not picked by hand; the curve is scaled to the same height at every temperature (the readout gives the real
 * change in output per square metre, which grows as T⁴).
 */
import { useMemo, useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, clamp, type DiagramMeta, type DiagramProps } from '../kit';
import { fmt, planck, sig, tempColor, wavelengthColor, wienPeakNm } from './_objects-lib';

export const meta: DiagramMeta = {
  title: 'Temperature sets a star’s colour',
  summary: 'Slide the temperature of a glowing body and watch its colour and its spectrum change; jump to real stars.',
  params: { start: 'starting temperature in kelvin, 2500–40000 (default 5772, the Sun)' },
};

/** Surface temperatures (K), checked against Wikipedia infoboxes Nov 2026 and rounded. */
const STARS = [
  { id: 'betelgeuse', name: 'Betelgeuse', T: 3600, cls: 'M' },
  { id: 'arcturus', name: 'Arcturus', T: 4290, cls: 'K' },
  { id: 'sun', name: 'Sun', T: 5772, cls: 'G' },
  { id: 'procyon', name: 'Procyon', T: 6580, cls: 'F' },
  { id: 'sirius', name: 'Sirius', T: 9850, cls: 'A' },
  { id: 'rigel', name: 'Rigel', T: 12100, cls: 'B' },
  { id: 'alnitak', name: 'Alnitak', T: 29500, cls: 'O' },
] as const;
const TMIN = 2500, TMAX = 40000;
const toS = (T: number) => (1000 * Math.log(T / TMIN)) / Math.log(TMAX / TMIN);
const fromS = (s: number) => TMIN * Math.pow(TMAX / TMIN, s / 1000);

// Spectrum plot box
const PX0 = 300, PX1 = 690, PY0 = 250, PY1 = 74;
const LMAX = 2000; // nm
const px = (l: number) => PX0 + (l / LMAX) * (PX1 - PX0);
// Temperature strip
const SX0 = 40, SX1 = 680, SY = 336;
const sx = (T: number) => SX0 + (Math.log(T / TMIN) / Math.log(TMAX / TMIN)) * (SX1 - SX0);

export default function BlackbodyColor({ params }: DiagramProps) {
  const start = typeof params?.start === 'number' ? clamp(params.start as number, TMIN, TMAX) : 5772;
  const [T, setT] = useState(start);
  const col = tempColor(T);
  const peak = wienPeakNm(T);
  const near = STARS.find((s) => Math.abs(Math.log(s.T / T)) < 0.03);

  const curve = useMemo(() => {
    const top = planck(clamp(peak, 10, LMAX), T);
    const pts: string[] = [];
    for (let l = 50; l <= LMAX; l += 10) pts.push(`${px(l).toFixed(1)},${(PY0 - (planck(l, T) / top) * (PY0 - PY1 - 10)).toFixed(1)}`);
    return `M ${pts.join(' L ')}`;
  }, [T, peak]);
  const strip = useMemo(() => Array.from({ length: 64 }, (_, i) => fromS((i / 63) * 1000)), []);

  const band = peak < 380 ? 'in the ultraviolet, beyond violet' : peak < 450 ? 'in the violet-blue' : peak < 495 ? 'in the blue' : peak < 570 ? 'in the green' : peak < 590 ? 'in the yellow' : peak < 750 ? 'in the red' : 'in the infrared, beyond red';
  const looks = T < 3300 ? 'deep orange-red' : T < 4500 ? 'orange' : T < 5400 ? 'yellow-orange' : T < 6300 ? 'yellowish white' : T < 8000 ? 'white' : T < 15000 ? 'blue-white' : 'blue';
  const perArea = sig(Math.pow(T / 5772, 4), 2);

  return (
    <div>
      <Svg w={720} h={386} title={meta.title} desc="Left: a disc glowing in the colour of the chosen temperature. Right: the spectrum of that glow, from ultraviolet through the visible rainbow to infrared, with its peak marked. Bottom: a temperature strip coloured from orange-red to blue with real stars marked.">
        {/* Glowing body */}
        <defs>
          <radialGradient id="bb-halo">
            <stop offset="0.55" stopColor={col} stopOpacity={0.55} />
            <stop offset="1" stopColor={col} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={140} cy={170} r={108} fill="url(#bb-halo)" />
        <circle cx={140} cy={170} r={66} fill={col} />
        <Label x={140} y={36} anchor="middle" size="s" color={C.dim}>
          a body glowing at
        </Label>
        <Label x={140} y={56} anchor="middle" size="l" weight={700}>
          {fmt(Math.round(T / 10) * 10)} K
        </Label>
        <Label x={140} y={290} anchor="middle" color={C.text} weight={600}>
          looks {looks}
        </Label>

        {/* Spectrum plot */}
        <rect x={px(380)} y={PY1} width={px(750) - px(380)} height={PY0 - PY1} fill="url(#bb-rainbow)" opacity={0.28} />
        <defs>
          <linearGradient id="bb-rainbow" x1="0" x2="1">
            {[380, 420, 460, 500, 540, 580, 620, 660, 700, 750].map((l, i) => (
              <stop key={l} offset={i / 9} stopColor={wavelengthColor(l)} />
            ))}
          </linearGradient>
        </defs>
        <line x1={PX0} x2={PX1} y1={PY0} y2={PY0} stroke={C.lineStrong} />
        <line x1={PX0} x2={PX0} y1={PY0} y2={PY1} stroke={C.lineStrong} />
        {[0, 500, 1000, 1500, 2000].map((l) => (
          <Label key={l} x={px(l)} y={PY0 + 16} anchor="middle" size="s" color={C.dim}>
            {fmt(l)}
          </Label>
        ))}
        <Label x={(PX0 + PX1) / 2} y={PY0 + 34} anchor="middle" size="s" color={C.dim}>
          wavelength of light (nanometres)
        </Label>
        <Label x={px(565)} y={PY1 - 8} anchor="middle" size="s" color={C.text}>
          visible
        </Label>
        <Label x={px(380) - 6} y={PY1 - 8} anchor="end" size="s" color={C.dim}>
          ← ultraviolet
        </Label>
        <Label x={px(750) + 6} y={PY1 - 8} size="s" color={C.dim}>
          infrared →
        </Label>
        <path d={curve} fill="none" stroke={col} strokeWidth={3} />
        {peak <= LMAX && peak >= 50 && (
          <g>
            <line x1={px(peak)} x2={px(peak)} y1={PY1 + 10} y2={PY0} stroke={C.text} strokeOpacity={0.5} strokeDasharray="3 4" />
            <Label x={px(peak) + 8} y={PY1 + 34} size="m" weight={700}>
              peak {fmt(Math.round(peak / 10) * 10)} nm
            </Label>
          </g>
        )}
        {peak < 50 && (
          <Label x={PX0 + 6} y={PY1 + 40} size="s" weight={600}>
            ← peak is off the chart in the ultraviolet
          </Label>
        )}

        {/* Temperature strip with real stars */}
        <defs>
          <linearGradient id="bb-strip" x1="0" x2="1">
            {strip.map((t, i) => <stop key={i} offset={i / (strip.length - 1)} stopColor={tempColor(t)} />)}
          </linearGradient>
        </defs>
        <rect x={SX0} y={SY - 7} width={SX1 - SX0} height={14} rx={3} fill="url(#bb-strip)" />
        {STARS.map((s, i) => {
          const up = i % 2 === 0;
          return (
            <g key={s.id}>
              <line x1={sx(s.T)} x2={sx(s.T)} y1={up ? SY - 18 : SY + 7} y2={up ? SY - 7 : SY + 18} stroke={C.lineStrong} />
              <Label x={sx(s.T)} y={up ? SY - 22 : SY + 31} anchor="middle" size="s" color={near?.id === s.id ? C.amber : C.text} weight={near?.id === s.id ? 700 : 500}>
                {s.name}
              </Label>
            </g>
          );
        })}
        <path d={`M ${sx(T)} ${SY + 9} l -7 12 h 14 z`} fill={C.amber} />
        <Label x={SX0} y={SY + 31} size="s" color={C.dim}>
          cooler
        </Label>
        <Label x={SX1} y={SY + 31} anchor="end" size="s" color={C.dim}>
          hotter
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Temperature" value={Math.round(toS(T))} min={0} max={1000} onChange={(v) => setT(fromS(v))} format={() => `${fmt(Math.round(T / 10) * 10)} K`} />
        <ChoiceControl
          label="Jump to a star"
          value={near?.id ?? ''}
          options={STARS.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(id) => setT(STARS.find((s) => s.id === id)!.T)}
        />
      </Controls>
      <Readout>
        {near ? `${near.name} (class ${near.cls}), about ${fmt(near.T)} K: ` : `At ${fmt(Math.round(T / 10) * 10)} K: `}
        the glow peaks {band}, and the mix of all the colours it gives off looks {looks}.
        {' '}
        {perArea > 0.95 && perArea < 1.05
          ? 'Each square metre of its surface gives off as much light as the Sun’s.'
          : perArea > 1
            ? `Each square metre of its surface gives off ${fmt(perArea)} times as much light as the Sun’s.`
            : `Each square metre of its surface gives off ${fmt(sig(1 / perArea, 2))} times less light than the Sun’s.`}
        {T > 20000 ? ' Most of its energy is ultraviolet light our eyes cannot see.' : T < 3800 ? ' Most of its energy is infrared, which we feel as heat but cannot see.' : ''}
      </Readout>
    </div>
  );
}
