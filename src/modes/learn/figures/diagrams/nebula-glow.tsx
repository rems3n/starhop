/**
 * Why nebulae glow red or blue. A star sits in a cloud of hydrogen gas and dust. Slide the star's temperature:
 * above ~20,000 K its ultraviolet light strips electrons from hydrogen out to a large bubble, which glows red as
 * the atoms recombine (an emission nebula). The dust always scatters some starlight, mostly blue (a reflection
 * nebula). The bubble size follows the number of hydrogen-ionising photons (Planck photon count beyond 91.2 nm ×
 * a main-sequence size/temperature trend), cube-rooted; drawn to a qualitative scale, which the figure states.
 */
import { useMemo, useState } from 'react';
import { C, Callout, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, clamp, type DiagramMeta, type DiagramProps } from '../kit';
import { fmt, gauss, rng, tempColor } from './_objects-lib';

export const meta: DiagramMeta = {
  title: 'Why nebulae glow red or blue',
  summary: 'A star inside a cloud of hydrogen and dust: slide its temperature to see ultraviolet light make the gas glow red, while dust scatters blue starlight.',
  params: { temp: 'starting star temperature in K, 6000–40000 (default 39000)' },
};

/** Fraction of a blackbody's photons energetic enough to ionise hydrogen (λ < 91.2 nm), by numerical integration. */
function ionFraction(T: number) {
  const x0 = 1.5789e5 / T; // 13.6 eV / kT
  let s = 0;
  for (let x = x0; x < x0 + 60; x += 0.05) s += (x * x) / (Math.exp(x) - 1);
  return (s * 0.05) / 2.404;
}
/** Relative ionising photon rate for a main-sequence star of temperature T (R ∝ T^1.6 along the main sequence). */
const qRel = (T: number) => Math.pow(T, 3) * Math.pow(T / 5772, 3.2) * ionFraction(T);
const Q40 = qRel(40000);
const glowR = (T: number) => 165 * Math.cbrt(qRel(T) / Q40);

const EX = [
  { id: 'trap', name: 'θ¹ Ori C', T: 39000, where: 'the brightest star of the Trapezium, which lights the Orion Nebula' },
  { id: 'merope', name: 'Merope', T: 14550, where: 'a Pleiades star wrapped in blue reflection nebulosity' },
  { id: 'sun', name: 'Sun-like', T: 5772, where: 'a Sun-like star' },
];

const STAR: [number, number] = [250, 196];
const CLOUD = 'M 70 120 C 60 50, 210 30, 300 52 C 400 22, 520 60, 520 140 C 560 220, 500 330, 380 340 C 280 372, 150 350, 96 290 C 40 240, 40 170, 70 120 Z';

export default function NebulaGlow({ params }: DiagramProps) {
  const [T, setT] = useState(typeof params?.temp === 'number' ? clamp(params.temp as number, 6000, 40000) : 39000);
  const r = glowR(T);
  const near = EX.find((e) => Math.abs(e.T - T) / e.T < 0.04);
  const uv = clamp(Math.round(ionFraction(T) * 60), 0, 12);
  const dust = useMemo(() => {
    const g = rng(11);
    return Array.from({ length: 70 }, () => [STAR[0] + gauss(g) * 120, STAR[1] + gauss(g) * 75] as [number, number]).filter(([x, y]) => x > 80 && x < 510 && y > 60 && y < 335);
  }, []);
  const blue = clamp((T - 4000) / 12000, 0.15, 1);

  return (
    <div>
      <Svg w={720} h={380} title={meta.title} desc="A cloud of gas and dust with a star inside. Around a hot star a red glowing bubble of ionised hydrogen fills much of the cloud; around a cooler star there is no red bubble, only a bluish haze of starlight scattered by dust. On the right an observer receives red light from the gas and blue light from the dust.">
        <defs>
          <clipPath id="ng-cloud"><path d={CLOUD} /></clipPath>
          <radialGradient id="ng-red">
            <stop offset="0" stopColor="#ff5a6e" stopOpacity="0.85" />
            <stop offset="0.75" stopColor="#e0304f" stopOpacity="0.55" />
            <stop offset="1" stopColor="#c02040" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ng-blue">
            <stop offset="0" stopColor="#9bb8ff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#6f8fe6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={CLOUD} fill="#1b2140" stroke={C.line} />
        <g clipPath="url(#ng-cloud)">
          <circle cx={STAR[0]} cy={STAR[1]} r={150} fill="url(#ng-blue)" opacity={blue} />
          {r > 3 && <circle cx={STAR[0]} cy={STAR[1]} r={r} fill="url(#ng-red)" />}
          {dust.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.6} fill="#8a8fa8" />)}
        </g>
        {/* UV photons */}
        {Array.from({ length: uv }, (_, i) => {
          const a = (i / Math.max(1, uv)) * Math.PI * 2 + 0.3;
          const l = Math.min(r * 0.8, 120);
          return <line key={i} x1={STAR[0] + Math.cos(a) * 18} y1={STAR[1] + Math.sin(a) * 18} x2={STAR[0] + Math.cos(a) * Math.max(34, l)} y2={STAR[1] + Math.sin(a) * Math.max(34, l)} stroke="#c9a7ff" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#fig-arrow)" />;
        })}
        <circle cx={STAR[0]} cy={STAR[1]} r={11 + (T / 40000) * 6} fill={tempColor(T)} />

        {/* light to the observer */}
        <circle cx={668} cy={196} r={14} fill="none" stroke={C.text} strokeWidth={1.5} />
        <circle cx={662} cy={196} r={5} fill={C.text} />
        <Label x={668} y={232} anchor="middle" size="s">you</Label>
        {r > 20 && <line x1={STAR[0] + r * 0.7} y1={STAR[1] - 18} x2={648} y2={188} stroke={C.red} strokeWidth={2.2} markerEnd="url(#fig-arrow)" />}
        <circle cx={402} cy={248} r={2.2} fill="#b9c4e8" />
        <line x1={406} y1={246} x2={648} y2={206} stroke={C.blue} strokeWidth={2.2} strokeOpacity={0.4 + 0.6 * blue} markerEnd="url(#fig-arrow)" />

        <Callout from={[470, 300]} to={[540, 330]} label="Hydrogen gas" note="dark unless energised" />
        <Callout from={[dust[8]?.[0] ?? 200, dust[8]?.[1] ?? 120]} to={[96, 30]} label="Dust grains" note="scatter blue light best" />
        {r > 20 && <Callout from={[STAR[0] - r * 0.55, STAR[1] + r * 0.45]} to={[30, 358]} label="Glowing red hydrogen" note="" color={C.red} />}
        <Callout from={[STAR[0] + 10, STAR[1] - 10]} to={[350, 30]} label={`Star, ${fmt(Math.round(T / 50) * 50)} K`} note={uv > 0 ? 'ultraviolet light (dashed)' : 'little ultraviolet light'} />
        <Label x={704} y={372} anchor="end" size="s" color={C.dim}>sizes not to scale</Label>
      </Svg>
      <Controls>
        <RangeControl label="Star’s temperature" value={T} min={6000} max={40000} step={250} onChange={setT} format={(v) => `${fmt(v)} K`} />
        <ChoiceControl label="Examples" value={near?.id ?? ''} options={EX.map((e) => ({ value: e.id, label: e.name }))} onChange={(id) => setT(EX.find((e) => e.id === id)!.T)} />
      </Controls>
      <Readout>
        {near ? `${near.name}, ${near.where}. ` : ''}
        {r > 60
          ? 'This star pours out ultraviolet light that strips the electrons off hydrogen atoms for a long way around it. When the electrons are recaptured the gas gives off light, mostly a deep red: an emission nebula. Dust adds some blue where it scatters the starlight.'
          : r > 8
            ? 'Some ultraviolet escapes, enough to make only a small patch of hydrogen glow. Most of what you see is starlight scattered by dust: bluish.'
            : 'Too cool to make hydrogen glow: almost no ultraviolet. The cloud shows only starlight scattered by its dust, mostly blue: a reflection nebula. With no star nearby at all, the cloud would be a dark nebula.'}
      </Readout>
    </div>
  );
}
