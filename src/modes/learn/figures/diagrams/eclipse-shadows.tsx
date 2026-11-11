/**
 * Umbra and penumbra, for both kinds of eclipse. Lunar: Earth's two-part shadow (side view, not to scale) and,
 * on the right, the shadow's cross-section where the Moon crosses it, with the Moon moving through on a chosen
 * path. Shadow sizes at the Moon's mean distance are computed from the radii of Sun, Earth and Moon (with the
 * usual 2% enlargement by Earth's atmosphere): umbra ≈ 2.7 and penumbra ≈ 4.8 Moon radii.
 * Solar: the Moon's small shadow on Earth, and the Sun as seen from a place inside or outside it.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Umbra and penumbra',
  summary: 'Side view of the shadows in a lunar or a solar eclipse; move the Moon through Earth’s shadow (or yourself through the Moon’s) and see what the eclipse looks like.',
  params: { kind: '"lunar" | "solar" (default "lunar")', path: 'lunar path: "total" | "partial" | "penumbral" (default "total")' },
};

const RS = 696000, RE = 6371, RM = 1737.4, DS = 149.6e6, DM = 384400;
const U = ((RE - (DM * (RS - RE)) / DS) * 1.02) / RM; // umbra radius in Moon radii
const P = ((RE + (DM * (RS + RE)) / DS) * 1.02) / RM; // penumbra radius in Moon radii
const PATHS = { total: 0.4, partial: 2.3, penumbral: 3.9 } as const;
const IX = 596, IY = 168; // inset centre

export default function EclipseShadows({ params }: DiagramProps) {
  const [kind, setKind] = useState<'lunar' | 'solar'>(params?.kind === 'solar' ? 'solar' : 'lunar');
  const [path, setPath] = useState<keyof typeof PATHS>(typeof params?.path === 'string' && params.path in PATHS ? (params.path as keyof typeof PATHS) : 'total');
  const [t, setT] = useState(0);
  const m = 13; // Moon radius in the inset, px
  // Lunar inset geometry
  const off = PATHS[path];
  const mxR = t * 6.2; // along-path position in Moon radii
  const dist = Math.hypot(mxR, off);
  const lunarState = dist + 1 <= U ? 'total' : dist - 1 < U ? 'partial' : dist - 1 < P ? 'penumbral' : 'none';
  // Solar: observer offset from the centre line, in Sun radii on the sky
  const d = t * 2.4;
  const solarState = Math.abs(d) < 0.03 ? 'total' : Math.abs(d) < 2.03 ? 'partial' : 'none';
  const cover = solarState === 'none' ? 0 : solarState === 'total' ? 100 : Math.round(Math.max(0, Math.min(1, (2.03 - Math.abs(d)) / 2)) * 100);

  return (
    <div>
      <Svg w={720} h={340} title={meta.title} desc={kind === 'lunar' ? `Earth's shadow, with a dark umbra inside a paler penumbra; the Moon passes through on a ${path} path and is now ${lunarState === 'none' ? 'outside the shadow' : `in a ${lunarState} eclipse`}.` : `The Moon's small umbra touches Earth, inside a wider penumbra. From the selected place the Sun appears ${solarState === 'total' ? 'totally covered' : solarState === 'partial' ? 'partly covered' : 'uncovered'}.`}>
        <defs>
          <clipPath id="es-moon">
            <circle cx={IX + mxR * m} cy={IY - off * m} r={m} />
          </clipPath>
          <radialGradient id="es-corona">
            <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="0.6" stopColor="#dfe7ff" stopOpacity="0.45" />
            <stop offset="1" stopColor="#dfe7ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {kind === 'lunar' ? (
          <g>
            {/* Side view */}
            <circle cx={-30} cy={168} r={80} fill={C.sun} />
            <Label x={14} y={268} size="s" color={C.amber}>
              Sun
            </Label>
            <path d={`M 50 168 L 210 ${168 - 24} L 450 ${168 - 4.8 * 9} L 450 ${168 + 4.8 * 9} L 210 ${168 + 24} Z`} fill="#3b3f63" opacity={0.55} />
            <path d={`M 210 ${168 - 24} L 450 ${168 - 2.7 * 9} L 450 ${168 + 2.7 * 9} L 210 ${168 + 24} Z`} fill="#05081a" />
            <line x1={-20} y1={90} x2={450} y2={168 + 4.8 * 9 + 6} stroke={C.sun} strokeOpacity={0.35} />
            <line x1={-20} y1={246} x2={450} y2={168 - 4.8 * 9 - 6} stroke={C.sun} strokeOpacity={0.35} />
            <circle cx={210} cy={168} r={24} fill={C.earth} />
            <Label x={210} y={210} anchor="middle" size="s" weight={600}>
              Earth
            </Label>
            <line x1={400} y1={60} x2={400} y2={280} stroke={C.lineStrong} strokeDasharray="3 4" />
            <circle cx={400} cy={168 + t * 100} r={9} fill={lunarState === 'total' ? '#a2482c' : C.moon} />
            <Label x={414} y={176 + t * 100} size="s" weight={600}>
              Moon
            </Label>
            <Label x={330} y={168 + 5} anchor="middle" size="s" color={C.text}>
              umbra
            </Label>
            <Label x={330} y={128} anchor="middle" size="s" color={C.dim}>
              penumbra
            </Label>
            <Label x={14} y={30} size="s" color={C.dim}>
              Lunar eclipse: the Moon passes through Earth's shadow (side view, not to scale)
            </Label>
            {/* Inset: shadow cross-section at the Moon */}
            <circle cx={IX} cy={IY} r={P * m} fill="#3b3f63" opacity={0.45} />
            <circle cx={IX} cy={IY} r={U * m} fill="#05081a" opacity={0.9} />
            <line x1={IX - 6.4 * m} y1={IY - off * m} x2={IX + 6.4 * m} y2={IY - off * m} stroke={C.lineStrong} strokeDasharray="3 4" />
            <circle cx={IX + mxR * m} cy={IY - off * m} r={m} fill={C.moon} />
            <g clipPath="url(#es-moon)">
              <circle cx={IX} cy={IY} r={P * m} fill="#000" opacity={0.18} />
              <circle cx={IX} cy={IY} r={U * m} fill={lunarState === 'total' ? '#a2482c' : '#3a1a12'} opacity={0.92} />
            </g>
            <Label x={IX} y={44} anchor="middle" size="s" color={C.dim}>
              Earth's shadow where the Moon crosses it
            </Label>
            <Label x={IX} y={IY + 4} anchor="middle" size="s" color={C.dim}>
              {lunarState === 'none' && Math.abs(mxR) > 1.2 ? 'umbra' : ''}
            </Label>
            <Label x={IX} y={IY + P * m + 18} anchor="middle" size="s" color={C.dim}>
              penumbra · to scale with the Moon
            </Label>
          </g>
        ) : (
          <g>
            <circle cx={-30} cy={168} r={80} fill={C.sun} />
            <Label x={14} y={268} size="s" color={C.amber}>
              Sun
            </Label>
            <path d={`M 250 ${168 - 9} L 470 ${168 - 58} L 470 ${168 + 58} L 250 ${168 + 9} Z`} fill="#3b3f63" opacity={0.55} />
            <path d={`M 250 ${168 - 9} L 392 ${168 - 1} L 392 ${168 + 1} L 250 ${168 + 9} Z`} fill="#05081a" />
            <line x1={-20} y1={90} x2={470} y2={168 + 62} stroke={C.sun} strokeOpacity={0.35} />
            <line x1={-20} y1={246} x2={470} y2={168 - 62} stroke={C.sun} strokeOpacity={0.35} />
            <circle cx={250} cy={168} r={9} fill={C.moon} />
            <Label x={250} y={150} anchor="middle" size="s" weight={600}>
              Moon
            </Label>
            <circle cx={470} cy={168} r={78} fill={C.earth} />
            <circle cx={393} cy={168 + d * 22} r={4.5} fill={C.amber} stroke={C.bg} strokeWidth={1.5} />
            <Label x={384} y={168 + d * 22 + 4} anchor="end" size="s" weight={600} color={C.amber}>
              you
            </Label>
            <Label x={330} y={110} anchor="middle" size="s" color={C.dim}>
              penumbra
            </Label>
            <Label x={14} y={30} size="s" color={C.dim}>
              Solar eclipse: the Moon's shadow falls on Earth (side view, not to scale)
            </Label>
            {/* Inset: the Sun seen from your place */}
            <rect x={482} y={52} width={228} height={232} rx={10} fill="#0a1030" stroke={C.line} />
            {solarState === 'total' && <circle cx={IX} cy={IY} r={100} fill="url(#es-corona)" />}
            <circle cx={IX} cy={IY} r={48} fill={C.sun} />
            <circle cx={IX + d * 48} cy={IY - d * 10} r={49.5} fill={solarState === 'total' ? '#05060f' : '#0a1030'} />
            <Label x={IX} y={44} anchor="middle" size="s" color={C.dim}>
              The Sun as seen from where you stand
            </Label>
            <Label x={IX} y={302} anchor="middle" size="s" color={C.dim}>
              {solarState === 'total' ? 'total: the corona appears' : solarState === 'partial' ? `partial: about ${cover}% of the Sun's width covered` : 'outside the shadow: no eclipse'}
            </Label>
          </g>
        )}
      </Svg>
      <Controls>
        <ChoiceControl
          label="Eclipse"
          value={kind}
          options={[
            { value: 'lunar', label: 'Lunar' },
            { value: 'solar', label: 'Solar' },
          ]}
          onChange={(v) => { setKind(v); setT(0); }}
        />
        {kind === 'lunar' && (
          <ChoiceControl
            label="Moon's path"
            value={path}
            options={[
              { value: 'total', label: 'Through the middle' },
              { value: 'partial', label: 'Off centre' },
              { value: 'penumbral', label: 'Misses the umbra' },
            ]}
            onChange={setPath}
          />
        )}
        <RangeControl label={kind === 'lunar' ? 'Moon moves through the shadow' : 'Where you stand'} value={t} min={-1} max={1} step={0.01} onChange={setT} format={(v) => (kind === 'lunar' ? `${Math.round((v + 1) * 50)}%` : Math.abs(v) < 0.02 ? 'centre of the shadow' : `${Math.round(Math.abs(v) * 100)}% of the way out`)} />
      </Controls>
      <Readout>
        {kind === 'lunar'
          ? lunarState === 'total'
            ? "Total: the whole Moon is in the umbra. It doesn't vanish: sunlight bent through Earth's atmosphere turns it a dim copper red."
            : lunarState === 'partial'
              ? 'Partial: part of the Moon is in the umbra, and a dark curved bite shows the edge of Earth’s round shadow.'
              : lunarState === 'penumbral'
                ? 'In the penumbra only part of the Sun is hidden from the Moon, so it dims slightly: most people notice nothing.'
                : 'Outside the shadow: an ordinary full Moon.'
          : solarState === 'total'
            ? 'You are inside the Moon’s tiny umbra: the Sun is completely covered for a few minutes and its pearly corona appears. Only now is it safe to look without a filter.'
            : solarState === 'partial'
              ? 'You are in the penumbra: part of the Sun is covered. Never look without certified eclipse glasses: the uncovered part can still burn your retina.'
              : 'Too far from the shadow path: no eclipse here.'}
      </Readout>
    </div>
  );
}
