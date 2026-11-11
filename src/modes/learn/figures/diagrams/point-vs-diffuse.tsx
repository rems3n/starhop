/**
 * Why light pollution hides nebulae and galaxies before stars. A star and a nebula give the same total light, but the
 * star's light lands in one point while the nebula's is spread over a patch of sky about 100 times wider each way.
 * Left: how the two look against the chosen sky. Right: a cross-section of brightness per patch of sky (log scale):
 * anything below the sky's own glow is lost. Levels are illustrative, chosen so the nebula fades around a suburban
 * sky while the star survives the city.
 */
import { useState } from 'react';
import { C, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Why spread-out objects vanish first',
  summary: 'A star and a nebula of the same total brightness against a sky you can brighten from a dark site to a city; the nebula’s spread-out light sinks below the sky glow first.',
  params: { bortle: 'starting Bortle class 1–9 (default 3)' },
};

const LABELS = ['', 'excellent dark site', 'truly dark site', 'rural sky', 'rural/suburban', 'suburban', 'bright suburban', 'suburban/urban', 'city', 'inner city'];
// log10 of surface brightness, arbitrary units: sky rises ~0.25 per Bortle class (illustrative)
const sky = (b: number) => -1 + (b - 1) * 0.25;
const NEB = 0.0; // the nebula's surface brightness (fades around Bortle 4–5)
const STAR = 3.6; // the star's peak per patch (same total light concentrated in a point)

const GX0 = 380, GX1 = 700, GY0 = 50, GY1 = 300;
const L0 = -1.5, L1 = 4;
const gy = (l: number) => GY1 - ((l - L0) / (L1 - L0)) * (GY1 - GY0);

export default function PointVsDiffuse({ params }: DiagramProps) {
  const [b, setB] = useState(typeof params?.bortle === 'number' ? (params.bortle as number) : 3);
  const s = sky(b);
  const art = /^[aeiou]/.test(LABELS[b]) ? 'an' : 'a';
  const nebContrast = Math.max(0, Math.min(1, (NEB - s) / 0.6));
  const starContrast = Math.max(0, Math.min(1, (STAR - s) / 0.6));
  const skyTint = Math.min(0.55, Math.max(0, (b - 1) * 0.07));
  // star profile: narrow spike; nebula: flat-topped bump
  const mid = (GX0 + GX1) / 2;
  const starX = GX0 + 80, nebX = GX0 + 230;
  const starPath = `M ${starX - 40} ${gy(L0)} L ${starX - 6} ${gy(L0)} L ${starX - 2} ${gy(STAR - 0.4)} L ${starX} ${gy(STAR)} L ${starX + 2} ${gy(STAR - 0.4)} L ${starX + 6} ${gy(L0)} L ${starX + 40} ${gy(L0)}`;
  const nebPath = `M ${nebX - 70} ${gy(L0)} C ${nebX - 55} ${gy(L0)} ${nebX - 55} ${gy(NEB)} ${nebX - 35} ${gy(NEB)} L ${nebX + 35} ${gy(NEB)} C ${nebX + 55} ${gy(NEB)} ${nebX + 55} ${gy(L0)} ${nebX + 70} ${gy(L0)}`;

  return (
    <div>
      <Svg w={720} h={360} title={meta.title} desc="Left: a star and a nebula of equal total light against the sky. Right: a cross-section showing the star as a tall narrow spike and the nebula as a low wide plateau, with a horizontal line for the sky's own glow. As the sky brightens the line rises and swallows the nebula long before the star.">
        {/* left: the view */}
        <rect x={20} y={50} width={320} height={250} rx={8} fill={C.bg} stroke={C.line} />
        <rect x={20} y={50} width={320} height={250} rx={8} fill="#8a7a6a" opacity={skyTint} />
        <circle cx={100} cy={175} r={3.5 + 2 * starContrast} fill={C.star} opacity={0.15 + 0.85 * starContrast} />
        <circle cx={100} cy={175} r={14} fill="url(#fig-glow)" opacity={0.4 * starContrast} />
        <ellipse cx={250} cy={175} rx={60} ry={44} fill="#c9a0b4" opacity={0.75 * nebContrast} />
        <ellipse cx={250} cy={175} rx={36} ry={26} fill="#e2c0cc" opacity={0.6 * nebContrast} />
        <Label x={100} y={250} anchor="middle" size="s" color={C.dim}>
          star
        </Label>
        <Label x={250} y={250} anchor="middle" size="s" color={C.dim}>
          nebula
        </Label>
        <Label x={180} y={36} anchor="middle" size="s" color={C.dim}>
          same total light, what you see
        </Label>
        {/* right: profile */}
        <Label x={GX0} y={36} size="s" color={C.dim}>
          brightness per patch of sky (log scale)
        </Label>
        <line x1={GX0} x2={GX0} y1={GY0} y2={GY1} stroke={C.lineStrong} />
        <line x1={GX0} x2={GX1} y1={GY1} y2={GY1} stroke={C.lineStrong} />
        <path d={starPath} fill="none" stroke={C.star} strokeWidth={2} />
        <path d={nebPath} fill="none" stroke="#c9a0b4" strokeWidth={2.5} />
        {/* sky glow level */}
        <rect x={GX0 + 1} y={gy(s)} width={GX1 - GX0 - 1} height={GY1 - gy(s)} fill={C.amber} opacity={0.12} />
        <line x1={GX0} x2={GX1} y1={gy(s)} y2={gy(s)} stroke={C.amber} strokeWidth={2} />
        <Label x={GX1 - 4} y={gy(s) - 8} anchor="end" size="s" color={C.amber} weight={600}>
          sky glow
        </Label>
        <Label x={starX + 10} y={gy(STAR) + 4} size="s">
          star: all in one point
        </Label>
        <Label x={nebX} y={gy(NEB) - 10} anchor="middle" size="s">
          nebula: spread out
        </Label>
        <Label x={mid} y={GY1 + 22} anchor="middle" size="s" color={C.dim}>
          position across the sky →
        </Label>
        <Label x={GX0} y={GY1 + 44} size="s" color={C.dim}>
          below the sky-glow line = lost; levels illustrative
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Sky" value={b} min={1} max={9} step={1} onChange={setB} format={(v) => `Bortle ${v}, ${LABELS[v]}`} />
      </Controls>
      <Readout>
        {nebContrast > 0.5
          ? `Under ${art} ${LABELS[b]} sky both show: the nebula's dim, spread-out light still stands above the sky's own glow.`
          : nebContrast > 0
            ? `Under ${art} ${LABELS[b]} sky the nebula is fading: its light per patch of sky is barely above the glow, while the star is untouched.`
            : `Under ${art} ${LABELS[b]} sky the nebula is gone, sunk below the glow, yet the star with the same total light still shines. Light pollution steals spread-out things first.`}
      </Readout>
    </div>
  );
}
