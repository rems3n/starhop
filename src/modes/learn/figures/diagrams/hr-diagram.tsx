/**
 * Hertzsprung–Russell diagram plotted live from the app's star catalog (every naked-eye star with a colour index
 * and absolute magnitude). Colour index B−V across (hot/blue left, cool/red right), true brightness up the side.
 * Regions for the main sequence, giants, supergiants and white dwarfs are drawn and labelled. Hover or tap a
 * dot to name the nearest bright star. A toggle adds the Sun and the nearest stars, which the naked-eye
 * catalog lacks: they fill the empty bottom of the main sequence (red dwarfs) and the white-dwarf corner.
 */
import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { useCatalog } from '@/data/catalog';
import { C, ChoiceControl, Controls, Label, Readout, Svg, clamp, type DiagramMeta, type DiagramProps } from '../kit';
import { bvToTemp, fmt, sig, tempColor } from './_objects-lib';

export const meta: DiagramMeta = {
  title: 'Hertzsprung–Russell diagram of the naked-eye stars',
  summary: 'Every naked-eye star plotted by colour and true brightness, with the main sequence, giants, supergiants and white dwarfs labelled; tap a dot to name it, or add the nearest stars.',
  params: { nearby: 'true to start with the Sun and nearest stars shown (default false)' },
};

const X0 = 64, X1 = 650, Y0 = 46, Y1 = 384;
const BV0 = -0.4, BV1 = 2.1, M0 = -8, M1 = 17;
const x = (bv: number) => X0 + ((bv - BV0) / (BV1 - BV0)) * (X1 - X0);
const y = (m: number) => Y0 + ((m - M0) / (M1 - M0)) * (Y1 - Y0);
const lum = (m: number) => Math.pow(10, (4.83 - m) / 2.5);

/** The Sun and nearby stars missing from the naked-eye catalog. Values: Wikipedia infoboxes, checked Nov 2026. */
const NEAR = [
  { name: 'Sun', sp: 'G2V', bv: 0.65, M: 4.83, note: 'our own star' },
  { name: 'Proxima Centauri', sp: 'M5.5V', bv: 1.82, M: 15.6, note: 'red dwarf, the nearest star (4.2 light-years)' },
  { name: 'Barnard’s Star', sp: 'M4V', bv: 1.71, M: 13.21, note: 'red dwarf, 6 light-years away' },
  { name: 'Wolf 359', sp: 'M6V', bv: 2.03, M: 16.61, note: 'red dwarf, 8 light-years away' },
  { name: '61 Cygni B', sp: 'K7V', bv: 1.32, M: 8.23, note: 'orange dwarf, 11 light-years away' },
  { name: 'Sirius B', sp: 'DA2', bv: -0.03, M: 11.18, note: 'white dwarf, companion of Sirius' },
];
/** Main-sequence ridge (B−V, M_V), drawn as a soft band. Approximate, from standard dwarf calibrations. */
const MS: [number, number][] = [[-0.33, -4.5], [-0.2, -1.5], [0, 1.2], [0.3, 2.9], [0.65, 4.8], [0.9, 6.0], [1.2, 7.6], [1.45, 9.2], [1.65, 11.6], [1.85, 14.4], [2.05, 16.6]];

interface Pt { name: string; sp: string; bv: number; M: number; note?: string; px: number; py: number; near?: boolean }

export default function HrDiagram({ params }: DiagramProps) {
  const cat = useCatalog();
  const [nearby, setNearby] = useState(params?.nearby === true);
  const [pick, setPick] = useState<Pt | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const stars = useMemo(() => (cat ? cat.stars.filter((s) => s.bv != null && s.absMag != null && s.absMag > M0 && s.absMag < M1 && s.bv > BV0 && s.bv < BV1) : []), [cat]);
  const dots = useMemo(
    () => stars.map((s) => <circle key={s.id} cx={x(s.bv!).toFixed(1)} cy={y(s.absMag!).toFixed(1)} r={s.mag < 1.5 ? 2.6 : 1.4} fill={tempColor(clamp(bvToTemp(Math.max(0, s.bv!)) + (s.bv! < 0 ? -s.bv! * 60000 : 0), 2500, 40000))} opacity={0.8} />),
    [stars],
  );
  const named: Pt[] = useMemo(() => {
    const a: Pt[] = stars.filter((s) => s.name && s.mag < 3).map((s) => ({ name: s.name!, sp: s.sp ?? '', bv: s.bv!, M: s.absMag!, px: x(s.bv!), py: y(s.absMag!) }));
    if (nearby) a.push(...NEAR.map((n) => ({ ...n, px: x(n.bv), py: y(n.M), near: true })));
    return a;
  }, [stars, nearby]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const svg = wrap.current?.querySelector('svg');
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * 720, sy = ((e.clientY - r.top) / r.height) * 420;
    let best: Pt | null = null, bd = 18 * 18;
    for (const p of named) {
      const d = (p.px - sx) ** 2 + (p.py - sy) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    if (best) setPick(best);
  };

  const ms = `M ${MS.map(([b, m]) => `${x(b).toFixed(1)},${y(m).toFixed(1)}`).join(' L ')}`;
  const L = pick ? lum(pick.M) : 0;

  return (
    <div ref={wrap} onPointerMove={onMove} onPointerDown={onMove}>
      <Svg w={720} h={420} title={meta.title} desc="Scatter plot of about 8,700 naked-eye stars. Most fall on a diagonal band, the main sequence, from bright blue stars at upper left toward dimmer orange ones; a clump of orange giants sits above it to the right, rare supergiants run across the top, and the bottom of the diagram is empty unless the nearest stars are added: red dwarfs at lower right and white dwarfs at lower left.">
        {/* axes */}
        {[-5, 0, 5, 10, 15].map((m) => (
          <g key={m}>
            <line x1={X0} x2={X1} y1={y(m)} y2={y(m)} stroke={C.line} strokeDasharray="2 5" />
            <Label x={X1 + 6} y={y(m) + 4} size="s" color={C.dim}>
              {(() => { const l = lum(m); return l > 0.5 && l < 2 ? '1' : l >= 1 ? `${fmt(sig(l, 1))}` : `1/${fmt(sig(1 / l, 1))}`; })()}
            </Label>
          </g>
        ))}
        <Label x={X1 + 6} y={Y0 - 14} size="s" color={C.dim}>× Sun</Label>
        <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="none" stroke={C.lineStrong} />
        {[[-0.3, '30,000 K'], [0, `${fmt(sig(bvToTemp(0), 2))} K`], [0.65, `${fmt(sig(bvToTemp(0.65), 2))} K`], [1.4, `${fmt(sig(bvToTemp(1.4), 2))} K`], [1.9, `${fmt(sig(bvToTemp(1.9), 2))} K`]].map(([b, t]) => (
          <Label key={String(b)} x={x(b as number)} y={Y0 - 8} anchor="middle" size="s" color={C.dim}>{t as string}</Label>
        ))}
        <Label x={X0} y={Y1 + 18} size="s" color={C.dim}>← hotter, bluer</Label>
        <Label x={X1} y={Y1 + 18} anchor="end" size="s" color={C.dim}>cooler, redder →</Label>
        <Label x={(X0 + X1) / 2} y={Y1 + 18} anchor="middle" size="s" color={C.dim}>surface temperature (from colour)</Label>
        <Label x={20} y={y(-6)} size="s" color={C.dim}>brighter</Label>
        <Label x={20} y={y(16)} size="s" color={C.dim}>dimmer</Label>
        <line x1={40} x2={40} y1={y(-4.5)} y2={y(14.5)} stroke={C.line} markerStart="url(#fig-arrow)" markerEnd="url(#fig-arrow)" />

        {/* regions */}
        <clipPath id="hr-clip"><rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} /></clipPath>
        <path d={ms} clipPath="url(#hr-clip)" fill="none" stroke={C.amber} strokeOpacity={0.12} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" />
        <ellipse cx={x(1.25)} cy={y(0.3)} rx={62} ry={30} fill="none" stroke={C.blue} strokeOpacity={0.5} strokeDasharray="4 4" />
        <rect x={x(-0.2)} y={y(-7.5)} width={x(1.9) - x(-0.2)} height={y(-4.6) - y(-7.5)} rx={14} fill="none" stroke={C.red} strokeOpacity={0.55} strokeDasharray="4 4" />
        <ellipse cx={x(0.1)} cy={y(12)} rx={36} ry={30} fill="none" stroke={C.text} strokeOpacity={0.35} strokeDasharray="4 4" />

        {dots}
        {nearby && NEAR.map((n) => (
          <g key={n.name}>
            <circle cx={x(n.bv)} cy={y(n.M)} r={5} fill={n.name === 'Sirius B' ? '#eef2ff' : tempColor(bvToTemp(n.bv))} stroke={C.amber} strokeWidth={1.6} />
          </g>
        ))}

        <Label x={x(-0.05)} y={y(1.6) + 24} color={C.amber} weight={700}>Main sequence</Label>
        <Label x={x(-0.05)} y={y(1.6) + 38} size="s" color={C.dim}>(dwarfs, like the Sun)</Label>
        <Label x={x(1.25)} y={y(0.3) + 48} anchor="middle" color={C.blue} weight={700}>Giants</Label>
        <Label x={x(1.9) - 4} y={y(-4.6) + 16} anchor="end" color={C.red} weight={700}>Supergiants</Label>
        <Label x={x(0.1) + 40} y={y(12) + 4} color={C.text} weight={700}>White dwarfs</Label>
        {!nearby && (
          <Label x={x(1.75)} y={y(13.5)} anchor="middle" size="s" color={C.dim}>empty: too dim to see</Label>
        )}
        {nearby && <Label x={x(1.95)} y={y(9.6)} anchor="end" size="s" color={C.amber} weight={600}>red dwarfs</Label>}

        {pick && (
          <g pointerEvents="none">
            <circle cx={pick.px} cy={pick.py} r={8} fill="none" stroke={C.text} strokeWidth={1.5} />
            <Label x={pick.px + (pick.px > 500 ? -12 : 12)} y={pick.py - 10} anchor={pick.px > 500 ? 'end' : 'start'} weight={700}>{pick.name}</Label>
          </g>
        )}
        {!cat && <Label x={360} y={210} anchor="middle" color={C.dim}>Loading the star catalog…</Label>}
      </Svg>
      <Controls>
        <ChoiceControl
          label="Stars plotted"
          value={nearby ? 'near' : 'eye'}
          options={[
            { value: 'eye', label: 'Naked-eye stars' },
            { value: 'near', label: 'Add the Sun and nearest stars' },
          ]}
          onChange={(v) => { setNearby(v === 'near'); setPick(null); }}
        />
      </Controls>
      <Readout>
        {pick
          ? `${pick.name}${pick.sp ? ` (${pick.sp})` : ''}: about ${L >= 1 ? `${fmt(sig(L, 2))} times as bright as` : `${fmt(sig(1 / L, 2))} times dimmer than`} the Sun in visible light${pick.note ? `; ${pick.note}` : ''}.`
          : nearby
            ? 'The Sun and the nearest stars fill in the bottom of the diagram: the faint red dwarfs at lower right, and Sirius B among the white dwarfs at lower left. Hover over or tap a dot.'
            : `${fmt(stars.length)} naked-eye stars. Most lie on the main sequence; the orange giants and rare supergiants sit above it. Hover over or tap a dot to name a bright star.`}
      </Readout>
    </div>
  );
}
