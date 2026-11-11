/**
 * Total or annular? The Moon's distance changes through its orbit (357,273–406,597 km in 2027, from
 * astronomy-engine's lunar apsides), so its apparent size changes. Left: side view of the Moon's umbra, which
 * either reaches Earth's surface or falls short. Right: the Moon's disc against the Sun's (Sun at its mean
 * distance), with apparent sizes computed for an observer under the Moon.
 */
import { useState } from 'react';
import { C, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Total or annular',
  summary: 'Slide the Moon between its nearest and farthest: its disc grows and shrinks against the Sun, and its dark shadow either reaches Earth (total) or falls short (annular).',
  params: { dist: 'starting Moon distance in km, 357000–407000 (default 360000)' },
};

const RS = 696000, RM = 1737.4, RE = 6371, DS = 149.6e6;
const NEAR = 357273, FAR = 406597;
const arcmin = (r: number, d: number) => (2 * Math.asin(r / d) * 180 * 60) / Math.PI;

export default function SunMoonSize({ params }: DiagramProps) {
  const [dist, setDist] = useState(typeof params?.dist === 'number' ? (params.dist as number) : 360000);
  const dObs = dist - RE; // observer on Earth's surface, straight under the Moon
  const moonAm = arcmin(RM, dObs);
  const sunAm = arcmin(RS, DS);
  const umbraLen = ((DS - dObs) * RM) / (RS - RM); // umbra length from the Moon's centre, km (Sun–Moon distance × RM / (RS − RM))
  const reaches = umbraLen >= dObs;
  const total = moonAm >= sunAm;
  // Left panel: Moon at x=60, Earth's surface at x scaled
  const kx = 300 / FAR;
  const mx = 60, sx = mx + dObs * kx, tipX = mx + umbraLen * kx;
  const R = 70; // Sun disc px in the right panel
  const rm = (R * moonAm) / sunAm;

  return (
    <div>
      <Svg w={720} h={300} title={meta.title} desc={`The Moon at ${Math.round(dist).toLocaleString('en-US')} km appears ${moonAm.toFixed(1)} arcminutes across against the Sun's ${sunAm.toFixed(1)}, so a central eclipse would be ${total ? 'total' : 'annular'}.`}>
        <Label x={14} y={24} size="s" color={C.dim}>
          The Moon's dark shadow (side view; widths exaggerated)
        </Label>
        <path d={`M ${mx} ${150 - 14} L ${Math.min(tipX, 420)} ${150 - (tipX > 420 ? 14 * (1 - (420 - mx) / (tipX - mx)) : 0)} L ${Math.min(tipX, 420)} ${150 + (tipX > 420 ? 14 * (1 - (420 - mx) / (tipX - mx)) : 0)} L ${mx} ${150 + 14} Z`} fill="#05081a" stroke={C.line} />
        <circle cx={mx} cy={150} r={14} fill={C.moon} />
        <Label x={mx} y={124} anchor="middle" size="s" weight={600}>
          Moon
        </Label>
        {/* Earth's surface */}
        <path d={`M ${sx} 40 Q ${sx - 18} 150 ${sx} 260`} fill="none" stroke={C.earth} strokeWidth={6} />
        <Label x={sx + 10} y={60} size="s" color={C.earth} weight={600}>
          Earth's surface
        </Label>
        <line x1={tipX} y1={140} x2={tipX} y2={160} stroke={C.amber} />
        <Label x={tipX} y={182} anchor="middle" size="s" color={C.amber}>
          shadow tip
        </Label>
        <Label x={mx} y={278} size="s" color={C.dim}>
          {reaches ? 'The tip reaches Earth: a total eclipse along a narrow track' : `The tip stops ${Math.round(dObs - umbraLen).toLocaleString('en-US')} km short: an annular eclipse`}
        </Label>
        {/* Right panel */}
        <rect x={452} y={14} width={256} height={272} rx={10} fill="#060a1e" stroke={C.line} />
        <circle cx={580} cy={140} r={R} fill={C.sun} />
        <circle cx={580} cy={140} r={rm} fill="#05060f" />
        <Label x={580} y={240} anchor="middle" weight={700}>
          {total ? 'Total' : 'Annular: a ring of Sun'}
        </Label>
        <Label x={580} y={262} anchor="middle" size="s" color={C.dim}>
          {`Moon ${moonAm.toFixed(1)}′ · Sun ${sunAm.toFixed(1)}′ across`}
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Moon's distance from Earth" value={dist} min={NEAR} max={FAR} step={500} onChange={setDist} format={(v) => `${Math.round(v / 1000).toLocaleString('en-US')},000 km`} />
      </Controls>
      <Readout>
        {`At ${Math.round(dist / 1000).toLocaleString('en-US')},000 km the Moon looks ${moonAm.toFixed(1)} arcminutes wide, ${total ? 'slightly bigger than' : 'slightly smaller than'} the Sun's ${sunAm.toFixed(1)}. `}
        {total ? 'Lined up exactly, it covers the whole Sun: a total eclipse, with the corona on show.' : 'Lined up exactly, it leaves a bright ring of Sun: an annular eclipse. The sky barely darkens and eye protection is needed throughout.'}
      </Readout>
    </div>
  );
}
