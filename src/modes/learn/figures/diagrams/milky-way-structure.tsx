/**
 * Why the Milky Way is a band: our galaxy face-on (schematic) with the Sun 26,000 ly from the centre, and a side view
 * sliced along the learner's line of sight (thickness exaggerated). Two sliders aim the line of sight: direction
 * along the disc (galactic longitude) and tilt out of the disc (galactic latitude). The readout gives how many
 * light-years of disc the sightline crosses and which constellation it points to.
 * Disc radius 50,000 ly, thin-disc thickness ~1,000 ly, Sun at 26,000 ly (Wikipedia "Milky Way", Nov 2026).
 */
import { useMemo, useState } from 'react';
import { C, Controls, Label, RangeControl, Readout, Svg, clamp, rad, type DiagramMeta, type DiagramProps } from '../kit';
import { fmt, sig } from './_objects-lib';

export const meta: DiagramMeta = {
  title: 'Inside the disc of the Milky Way',
  summary: 'Our galaxy face-on and in side view with the Sun marked; aim your line of sight along or out of the disc to see why the Milky Way is a band.',
  params: { l: 'starting direction along the disc, 0–359 (0 = towards the centre, default 0)', b: 'starting tilt out of the disc, −90–90 (default 0)' },
};

const RDISC = 50000, RSUN = 26000, HALF = 500; // light-years
const FX = 190, FY = 196, FS = 160 / RDISC; // face-on centre and scale (px per ly)
const SX0 = 380, SX1 = 704, SY = 220, EXAG = 5; // side view

/** Distance from the Sun to the disc edge along in-plane direction l (degrees). */
function edge(l: number) {
  const dx = Math.sin(rad(l)), dy = -Math.cos(rad(l)); // centre is at (0, -RSUN) relative to the Sun in "up" coords
  // Sun at (0, RSUN) from centre with y pointing towards the Sun; solve |S + t d| = RDISC
  const sx = 0, sy = RSUN;
  const b = 2 * (sx * dx + sy * dy), c = sx * sx + sy * sy - RDISC * RDISC;
  return (-b + Math.sqrt(b * b - 4 * c)) / 2;
}
const CON: [number, string][] = [[0, 'Sagittarius'], [30, 'Aquila and Scutum'], [60, 'Vulpecula'], [90, 'Cygnus'], [120, 'Cassiopeia'], [150, 'Perseus'], [180, 'Auriga and Taurus'], [210, 'Monoceros, beside Orion'], [240, 'Puppis'], [270, 'Vela'], [300, 'Crux, the Southern Cross'], [330, 'Norma and Scorpius'], [360, 'Sagittarius']];
const conFor = (l: number) => CON.reduce((a, c) => (Math.abs(c[0] - l) < Math.abs(a[0] - l) ? c : a))[1];

export default function MilkyWayStructure({ params }: DiagramProps) {
  const [l, setL] = useState(typeof params?.l === 'number' ? (params.l as number) : 0);
  const [b, setB] = useState(typeof params?.b === 'number' ? clamp(params.b as number, -90, 90) : 0);

  const arms = useMemo(() => {
    const k = Math.tan(rad(21)); // pitch opened up for a schematic look
    return [0, 90, 180, 270].map((off) => {
      const pts: string[] = [];
      for (let t = 0; t < 12; t += 0.08) {
        const r = 7000 * Math.exp(k * t);
        if (r > RDISC * 0.98) break;
        const a = t + rad(off) + rad(20);
        pts.push(`${(FX + Math.cos(a) * r * FS).toFixed(1)},${(FY + Math.sin(a) * r * FS).toFixed(1)}`);
      }
      return `M ${pts.join(' L ')}`;
    });
  }, []);

  const dPlane = edge(l), dBack = edge((l + 180) % 360);
  const sb = Math.abs(Math.sin(rad(b))), cb = Math.cos(rad(b));
  const path = sb < 1e-6 ? dPlane : Math.min(dPlane / Math.max(cb, 1e-6), HALF / sb);
  // face-on: Sun below the centre; l = 0 points up to the centre, l = 90 to the right
  const sun: [number, number] = [FX, FY + RSUN * FS];
  const dir: [number, number] = [Math.sin(rad(l)), -Math.cos(rad(l))];
  const inPlane = path * cb;
  const tip: [number, number] = [sun[0] + dir[0] * inPlane * FS, sun[1] + dir[1] * inPlane * FS];

  // side view sliced along the sightline: slab from back edge to front edge
  const SS = (SX1 - SX0) / (dPlane + dBack);
  const sunX = SX0 + dBack * SS;
  const slabH = 2 * HALF * SS * EXAG;
  const perp = Math.abs(RSUN * Math.sin(rad(l))); // centre's distance from this slice
  const centreAlong = -RSUN * Math.cos(rad(l)) * -1; // along the sightline (+ ahead)
  const cX = sunX + centreAlong * SS;
  const bulgeOp = clamp(1 - perp / 8000, 0, 1);
  const ang = Math.atan2(Math.sin(rad(b)) * EXAG, cb); // drawn angle with exaggeration
  const reach = (b >= 0 ? -1 : 1) * Math.min(Math.abs((slabH / 2) / Math.sin(ang || 1e-9)), (dPlane * SS) / Math.max(Math.cos(ang), 1e-6));
  const segLen = Math.min(Math.abs(reach), 400);
  const sTip: [number, number] = [sunX + Math.cos(ang) * segLen, SY - Math.sin(ang) * segLen];

  const where = Math.abs(b) > 70 ? (b > 0 ? 'Coma Berenices, straight out of the disc to the north' : 'Sculptor, straight out of the disc to the south') : Math.abs(b) > 25 ? `well away from the band, above or below ${conFor(l)}` : conFor(l);
  const band = path > 10000 ? 'right along the band: a glowing river of distant stars' : path > 3000 ? 'near the band' : path > 1500 ? 'just off the band' : 'out of the disc, where the sky between the stars is dark';

  return (
    <div>
      <Svg w={720} h={400} title={meta.title} desc="Left: a schematic face-on view of the Milky Way, a barred spiral 100,000 light-years across, with the Sun marked about halfway out and a line of sight drawn from it. Right: a side view of the thin disc sliced along that line of sight, with the line tilted out of the disc by the chosen angle.">
        {/* face-on */}
        <Label x={FX} y={24} anchor="middle" weight={700}>Seen from above (schematic)</Label>
        <defs>
          <radialGradient id="mw-disc"><stop offset="0" stopColor="#3a4373" /><stop offset="0.5" stopColor="#202852" /><stop offset="1" stopColor="#141b3c" /></radialGradient>
        </defs>
        <circle cx={FX} cy={FY} r={RDISC * FS} fill="url(#mw-disc)" stroke={C.line} />
        {arms.map((d, i) => <path key={i} d={d} fill="none" stroke="#a9b8ff" strokeOpacity={i % 2 ? 0.16 : 0.3} strokeWidth={i % 2 ? 8 : 12} strokeLinecap="round" />)}
        <ellipse cx={FX} cy={FY} rx={30} ry={13} transform={`rotate(-27 ${FX} ${FY})`} fill="#ffe2a8" opacity={0.85} />
        <circle cx={FX} cy={FY} r={14} fill="#fff1cf" opacity={0.7} />
        <line x1={sun[0]} y1={sun[1]} x2={tip[0]} y2={tip[1]} stroke={C.amber} strokeWidth={2} markerEnd="url(#fig-arrow)" />
        <circle cx={sun[0]} cy={sun[1]} r={4.5} fill={C.amber} stroke={C.bg} />
        <Label x={sun[0] + 8} y={sun[1] + 16} size="s" color={C.amber} weight={700}>Sun</Label>
        <Label x={FX} y={FY - 22} anchor="middle" size="s">centre</Label>
        <line x1={30} x2={30 + 10000 * FS} y1={380} y2={380} stroke={C.lineStrong} strokeWidth={2} />
        <Label x={30} y={372} size="s" color={C.dim}>10,000 light-years</Label>

        {/* side view */}
        <Label x={(SX0 + SX1) / 2} y={24} anchor="middle" weight={700}>Side view, along your line of sight</Label>
        <Label x={(SX0 + SX1) / 2} y={42} anchor="middle" size="s" color={C.dim}>thickness exaggerated ×{EXAG}</Label>
        <rect x={SX0} y={SY - slabH / 2} width={SX1 - SX0} height={slabH} rx={slabH / 2} fill="#141b3c" stroke={C.line} />
        {bulgeOp > 0 && cX > SX0 && cX < SX1 && <ellipse cx={cX} cy={SY} rx={34} ry={22} fill="#ffe2a8" opacity={0.6 * bulgeOp} />}
        <line x1={sunX} y1={SY} x2={sTip[0]} y2={sTip[1]} stroke={C.amber} strokeWidth={2} markerEnd="url(#fig-arrow)" />
        <line x1={sunX} y1={SY} x2={sunX + Math.cos(ang) * 160} y2={SY - Math.sin(ang) * 160} stroke={C.amber} strokeOpacity={0.35} strokeDasharray="4 4" />
        <circle cx={sunX} cy={SY} r={4.5} fill={C.amber} stroke={C.bg} />
        <Label x={sunX} y={SY + slabH / 2 + 18} anchor="middle" size="s" color={C.amber} weight={700}>Sun</Label>
        <Label x={SX0} y={SY + slabH / 2 + 46} size="s" color={C.dim}>behind you</Label>
        <Label x={SX1} y={SY + slabH / 2 + 46} anchor="end" size="s" color={C.dim}>ahead</Label>
        {bulgeOp > 0.3 && cX > SX0 && cX < SX1 && <Label x={cX} y={SY - 30} anchor="middle" size="s">central bulge</Label>}
        <Label x={(SX0 + SX1) / 2} y={350} anchor="middle" weight={600}>
          You look through {fmt(sig(path, 2))} light-years of disc
        </Label>
        <rect x={SX0} y={362} width={SX1 - SX0} height={10} rx={3} fill={C.panel} stroke={C.line} />
        <rect x={SX0} y={362} width={Math.max(2, ((SX1 - SX0) * Math.log10(path / 300)) / Math.log10(80000 / 300))} height={10} rx={3} fill={C.amber} />
        <Label x={SX0} y={392} size="s" color={C.dim}>300 ly</Label>
        <Label x={SX1} y={392} anchor="end" size="s" color={C.dim}>80,000 ly (log scale)</Label>
      </Svg>
      <Controls>
        <RangeControl label="Direction along the disc" value={l} min={0} max={359} onChange={setL} format={(v) => `${v}° · ${conFor(v)}`} />
        <RangeControl label="Tilt out of the disc" value={b} min={-90} max={90} onChange={setB} format={(v) => `${v > 0 ? '+' : ''}${v}°`} />
      </Controls>
      <Readout>
        Looking towards {where}, your line of sight crosses about {fmt(sig(path, 2))} light-years of the disc before leaving the galaxy: {band}.
        {Math.abs(b) < 10 && (l < 30 || l > 330) ? ' This is towards the centre, where stars are most crowded, though dark dust clouds hide the centre itself.' : ''}
      </Readout>
    </div>
  );
}
