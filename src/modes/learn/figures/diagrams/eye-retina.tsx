/**
 * The eye and its two kinds of light detector. Left: a cross-section of the eye with the retina,
 * fovea and optic nerve called out. Right: a magnified strip of retina at the chosen spot, with rods and
 * cones drawn to shape. The learner switches between daylight and starlight (which cells respond) and
 * moves the spot from the fovea out to the periphery (how the mix of cells changes: averted vision).
 */
import { useMemo, useState } from 'react';
import { C, Callout, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Rods and cones in the retina',
  summary: 'Eye cross-section plus a magnified strip of retina; toggle daylight/starlight and slide from the fovea outward to see which cells respond.',
  params: { light: '"day" | "night" — starting lighting (default "night")', offset: 'starting distance from the fovea in degrees, 0–30 (default 0)' },
};

/** Share of rods among photoreceptors at an angle from the fovea (simplified from Curcio et al. 1990 density curves). */
function rodShare(deg: number): number {
  if (deg < 0.6) return 0; // the central fovea has no rods at all
  if (deg < 3) return 0.55 * ((deg - 0.6) / 2.4);
  if (deg < 20) return 0.55 + 0.4 * ((deg - 3) / 17);
  return 0.95;
}

/** Deterministic pseudo-random so the strip doesn't reshuffle on every render. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export default function EyeRetina({ params }: DiagramProps) {
  const [light, setLight] = useState<'day' | 'night'>(params?.light === 'day' ? 'day' : 'night');
  const [offset, setOffset] = useState(typeof params?.offset === 'number' ? (params.offset as number) : 0);
  const share = rodShare(offset);
  const night = light === 'night';

  // Build the receptor strip: 26 cells, rods vs cones by the share at this spot.
  const cells = useMemo(() => {
    const r = rng(7);
    const n = 26;
    const rods = Math.round(n * share);
    const kinds: ('rod' | 'cone')[] = Array.from({ length: n }, (_, i) => (i < rods ? 'rod' : 'cone'));
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    return kinds.map((k, i) => ({ k: k as 'rod' | 'cone', x: 412 + i * 11.2, hue: ['#e2685c', '#79c27b', '#6f8fe6'][Math.floor(r() * 3)] }));
  }, [share]);

  // Where on the drawn retina the chosen spot sits (fovea at the back of the eye, moving up the wall).
  const eye = { cx: 175, cy: 205, r: 120 };
  const a = (offset / 30) * (55 * Math.PI) / 180; // up the back wall: fovea at 0, 30° off centre ≈ 55° round the eyeball
  const spot: [number, number] = [eye.cx + (eye.r - 4) * Math.cos(a), eye.cy - (eye.r - 4) * Math.sin(a)];
  const fovea: [number, number] = [eye.cx + eye.r, eye.cy];

  const lit = (k: 'rod' | 'cone') => (night ? k === 'rod' : k === 'cone');

  return (
    <div>
      <Svg w={720} h={400} title={meta.title} desc="Cross-section of an eye with light entering through the lens and landing on the retina; beside it a magnified row of rod and cone cells at the selected spot, highlighting which kind responds in the selected lighting.">
        {/* Light rays from a star */}
        {[-22, 0, 22].map((dy) => (
          <line key={dy} x1={0} y1={eye.cy + dy * 1.6} x2={eye.cx - eye.r + 18} y2={eye.cy + dy * 0.55} stroke={night ? C.blue : C.sun} strokeWidth={1.4} opacity={0.75} />
        ))}
        {/* Eyeball */}
        <circle cx={eye.cx} cy={eye.cy} r={eye.r} fill="#121a3a" stroke={C.lineStrong} strokeWidth={1.5} />
        {[-22, 0, 22].map((dy) => (
          <line key={`i${dy}`} x1={eye.cx - eye.r + 18} y1={eye.cy + dy * 0.55} x2={spot[0]} y2={spot[1]} stroke={night ? C.blue : C.sun} strokeWidth={1.1} opacity={0.55} />
        ))}
        {/* Retina: inner lining of the back of the eye */}
        <path d={`M ${eye.cx + 20} ${eye.cy - eye.r + 3} A ${eye.r - 4} ${eye.r - 4} 0 0 1 ${eye.cx + 20} ${eye.cy + eye.r - 3}`} fill="none" stroke={C.red} strokeWidth={5} opacity={0.75} />
        {/* Cornea bulge, iris and lens */}
        <path d={`M ${eye.cx - eye.r + 8} ${eye.cy - 45} Q ${eye.cx - eye.r - 22} ${eye.cy} ${eye.cx - eye.r + 8} ${eye.cy + 45}`} fill="none" stroke={C.lineStrong} strokeWidth={1.5} />
        <line x1={eye.cx - eye.r + 14} y1={eye.cy - 46} x2={eye.cx - eye.r + 14} y2={eye.cy - (night ? 24 : 10)} stroke="#6b4f3a" strokeWidth={6} />
        <line x1={eye.cx - eye.r + 14} y1={eye.cy + 46} x2={eye.cx - eye.r + 14} y2={eye.cy + (night ? 24 : 10)} stroke="#6b4f3a" strokeWidth={6} />
        <ellipse cx={eye.cx - eye.r + 26} cy={eye.cy} rx={11} ry={30} fill="rgba(200,220,255,0.18)" stroke={C.lineStrong} />
        {/* Optic nerve */}
        <path d={`M ${eye.cx + eye.r - 6} ${eye.cy + 30} l 50 18 l 0 26 l -56 -20 z`} fill="#2a2f4f" stroke={C.lineStrong} />
        {/* Fovea and chosen spot */}
        <circle cx={fovea[0] - 4} cy={fovea[1]} r={4} fill={C.amber} />
        <circle cx={spot[0] - 4} cy={spot[1]} r={7} fill="none" stroke={C.text} strokeWidth={1.5} />
        {/* Zoom lines to the strip */}
        <line x1={spot[0]} y1={spot[1] - 7} x2={405} y2={110} stroke={C.line} strokeDasharray="4 4" />
        <line x1={spot[0]} y1={spot[1] + 7} x2={405} y2={300} stroke={C.line} strokeDasharray="4 4" />

        <Callout from={[eye.cx - eye.r + 14, eye.cy - (night ? 30 : 18)]} to={[40, 52]} label="Pupil" note={night ? 'opens wide in the dark' : 'small in daylight'} />
        <Callout from={[eye.cx - eye.r + 26, eye.cy + 26]} to={[18, 360]} label="Lens" note="focuses light on the retina" />
        <Callout from={[fovea[0] - 2, fovea[1]]} to={[230, 120]} label="Fovea" note="sharpest vision: cones only" color={C.amber} />
        <Callout from={[eye.cx + eye.r + 20, eye.cy + 50]} to={[250, 365]} label="Optic nerve" note="carries signals to the brain" />
        <Label x={175} y={30} anchor="middle" size="s" color={C.dim}>
          The eye (cross-section)
        </Label>

        {/* Magnified retina strip */}
        <rect x={400} y={100} width={305} height={210} rx={10} fill={C.panel} stroke={C.line} />
        <Label x={552} y={92} anchor="middle" size="s" color={C.dim}>
          {offset < 0.6 ? 'Retina at the fovea (magnified)' : `Retina ${offset.toFixed(0)}° from the fovea (magnified)`}
        </Label>
        {/* Light arrives from the top of the strip (through the front layers of the retina) */}
        <Label x={410} y={122} size="s" color={night ? C.blue : C.sun}>
          light arrives ↓
        </Label>
        {cells.map((c, i) =>
          c.k === 'rod' ? (
            <g key={i}>
              <rect x={c.x} y={140} width={7} height={118} rx={3.5} fill={lit('rod') ? '#cfe0ff' : '#3b4566'} opacity={lit('rod') ? 1 : 0.7} />
              {lit('rod') && <rect x={c.x - 2} y={138} width={11} height={122} rx={5} fill="none" stroke={C.blue} strokeOpacity={0.5} />}
            </g>
          ) : (
            <g key={i}>
              <path d={`M ${c.x} 258 L ${c.x} 200 L ${c.x + 3.5} 176 L ${c.x + 7} 200 L ${c.x + 7} 258 z`} fill={lit('cone') ? c.hue : '#3b4566'} opacity={lit('cone') ? 0.95 : 0.7} />
            </g>
          ),
        )}
        <line x1={404} x2={701} y1={262} y2={262} stroke={C.lineStrong} />
        <Label x={410} y={282} size="s" color={C.dim}>
          nerve cells: signals to the brain →
        </Label>
        {/* Legend */}
        <rect x={412} y={322} width={7} height={26} rx={3.5} fill="#cfe0ff" />
        <Label x={428} y={333} weight={600}>Rods</Label>
        <Label x={470} y={333} size="s" color={C.dim}>about 120 million · very sensitive · no colour</Label>
        <path d="M 412 388 L 412 372 L 415.5 358 L 419 372 L 419 388 z" fill="#79c27b" />
        <Label x={428} y={375} weight={600}>Cones</Label>
        <Label x={478} y={375} size="s" color={C.dim}>about 6 million · colour · need bright light</Label>
      </Svg>
      <Controls>
        <ChoiceControl
          label="Lighting"
          value={light}
          options={[
            { value: 'day', label: 'Daylight' },
            { value: 'night', label: 'Starlight' },
          ]}
          onChange={setLight}
        />
        <RangeControl label="Where the light lands" value={offset} min={0} max={30} step={1} onChange={setOffset} format={(v) => (v === 0 ? 'fovea' : `${v}° off centre`)} />
      </Controls>
      <Readout>
        {night
          ? offset < 1
            ? 'Starlight on the fovea: only cones here, and they need far more light, so a faint star looking straight at it can vanish.'
            : offset < 8
              ? `Starlight ${offset}° off centre: rods begin to appear and pick up faint light, but the fovea's cones still miss it.`
              : `Starlight ${offset}° off centre: mostly rods, which respond to faint light. This is why a faint object shows up best when you look slightly to one side of it.`
          : offset < 1
            ? 'Daylight on the fovea: densely packed cones give sharp, full-colour vision. That is why you look straight at things in daylight.'
            : 'Daylight off centre: rods are swamped by bright light and stop contributing; the scattered cones still see colour, but less sharply.'}
      </Readout>
    </div>
  );
}
