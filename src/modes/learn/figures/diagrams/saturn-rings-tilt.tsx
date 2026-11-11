/**
 * Saturn's rings opening and closing. The ring tilt as seen from Earth is computed with astronomy-engine
 * (Illumination(...).ring_tilt) for any date 2020–2050. Left: Saturn drawn with its rings at that tilt (ring and
 * globe dimensions to scale). Right: the tilt over 30 years, with the edge-on crossings marked.
 * Ring radii: A ring outer edge 136,775 km, B ring inner edge 92,000 km, Cassini Division 117,580–122,170 km;
 * Saturn equatorial radius 60,268 km, polar 54,364 km (Wikipedia "Rings of Saturn", "Saturn").
 */
import { useEffect, useMemo, useState } from 'react';
import { Body, Illumination } from 'astronomy-engine';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, clamp, rad, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Saturn’s rings open and close',
  summary: 'Slide the year from 2020 to 2050 to watch Saturn’s rings tilt open and close to edge-on as Saturn circles the Sun every 29 years.',
  params: { year: 'starting year, 2020–2050 (default the current year)' },
};

const Y0 = 2020, Y1 = 2050;
const tiltAt = (y: number) => Illumination(Body.Saturn, new Date(Date.UTC(Math.floor(y), 0, 1) + (y % 1) * 365.25 * 86400e3)).ring_tilt ?? 0;
const EQ = 60268, POL = 54364, A_OUT = 136775, CAS_OUT = 122170, CAS_IN = 117580, B_IN = 92000;

export default function SaturnRingsTilt({ params }: DiagramProps) {
  const now = new Date();
  const [y, setY] = useState(typeof params?.year === 'number' ? clamp(params.year as number, Y0, Y1) : clamp(now.getUTCFullYear() + now.getUTCMonth() / 12, Y0, Y1));
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setY((v) => { const n = v + (reduced ? 2 : 0.1); if (n >= Y1) { setPlaying(false); return Y1; } return n; }), reduced ? 500 : 50);
    return () => clearInterval(id);
  }, [playing, reduced]);
  const curve = useMemo(() => Array.from({ length: (Y1 - Y0) * 4 + 1 }, (_, i) => [Y0 + i / 4, tiltAt(Y0 + i / 4)] as [number, number]), []);
  const crossings = useMemo(() => {
    const out: number[] = [];
    for (let i = 1; i < curve.length; i++) if (Math.sign(curve[i][1]) !== Math.sign(curve[i - 1][1])) out.push(curve[i - 1][0] + (curve[i - 1][1] / (curve[i - 1][1] - curve[i][1])) / 4);
    return out;
  }, [curve]);
  const groups = useMemo(() => crossings.reduce<number[][]>((acc, c) => {
    const last = acc[acc.length - 1];
    if (last && c - last[last.length - 1] < 1.5) last.push(c); else acc.push([c]);
    return acc;
  }, []), [crossings]);
  const B = tiltAt(y);

  // Saturn drawing
  const CX = 175, CY = 175, K = 140 / A_OUT; // px per km
  const sb = Math.abs(Math.sin(rad(B)));
  const ring = (r: number) => [r * K, Math.max(0.6, r * K * sb)] as const;
  const half = (r: number, front: boolean) => {
    const [a, b] = ring(r);
    const lowerFront = B >= 0; // seen from north of the ring plane, the near side of the rings is below the globe
    const lower = front === lowerFront;
    return `M ${CX - a} ${CY} A ${a} ${b} 0 0 ${lower ? 0 : 1} ${CX + a} ${CY}`;
  };
  const rings = (front: boolean) => (
    <g>
      <path d={half((A_OUT + CAS_OUT) / 2, front)} fill="none" stroke="#cdb98a" strokeWidth={Math.max(1, (A_OUT - CAS_OUT) * K * 0.98)} opacity={0.85} />
      <path d={half((CAS_IN + B_IN) / 2, front)} fill="none" stroke="#e8d5a4" strokeWidth={Math.max(1, (CAS_IN - B_IN) * K * 0.98)} opacity={0.95} />
    </g>
  );

  // graph
  const GX0 = 380, GX1 = 700, GY = 175, GS = 4.2;
  const gx = (yy: number) => GX0 + ((yy - Y0) / (Y1 - Y0)) * (GX1 - GX0);
  const path = `M ${curve.map(([yy, b]) => `${gx(yy).toFixed(1)},${(GY - b * GS).toFixed(1)}`).join(' L ')}`;
  const edge = Math.abs(B) < 2.5;

  return (
    <div>
      <Svg w={720} h={340} title={meta.title} desc="Left: Saturn with its rings drawn at the tilt seen from Earth in the chosen year, from wide open to edge-on. Right: a graph of the ring tilt from 2020 to 2050, a wave that crosses zero (edge-on) about every 15 years and peaks near 27 degrees.">
        {rings(false)}
        <ellipse cx={CX} cy={CY} rx={EQ * K} ry={POL * K} fill="#e6cf98" />
        <ellipse cx={CX} cy={CY - POL * K * 0.25} rx={EQ * K * 0.97} ry={POL * K * 0.1} fill="#d9bd85" opacity={0.6} />
        {rings(true)}
        <Label x={CX} y={30} anchor="middle" weight={700}>Saturn in {Math.floor(y)}</Label>
        <Label x={CX} y={318} anchor="middle" weight={600}>{edge ? 'rings edge-on: almost invisible' : `rings tilted ${Math.abs(B).toFixed(0)}°, ${B > 0 ? 'north' : 'south'} face showing`}</Label>

        <Label x={GX0} y={30} weight={700}>Ring tilt seen from Earth</Label>
        <line x1={GX0} x2={GX1} y1={GY} y2={GY} stroke={C.lineStrong} />
        {[-27, 27].map((b) => <line key={b} x1={GX0} x2={GX1} y1={GY - b * GS} y2={GY - b * GS} stroke={C.line} strokeDasharray="3 5" />)}
        <Label x={GX0 - 4} y={GY - 27 * GS + 4} anchor="end" size="s" color={C.dim}>27°</Label>
        <Label x={GX0 - 4} y={GY + 4} anchor="end" size="s" color={C.dim}>0°</Label>
        <Label x={GX0 - 4} y={GY + 27 * GS + 4} anchor="end" size="s" color={C.dim}>27°</Label>
        <path d={path} fill="none" stroke={C.amber} strokeWidth={2} />
        {[2020, 2030, 2040, 2050].map((yy) => <Label key={yy} x={gx(yy)} y={GY + 27 * GS + 22} anchor="middle" size="s" color={C.dim}>{yy}</Label>)}
        {crossings.map((c) => <circle key={c} cx={gx(c)} cy={GY} r={4} fill={C.blue} />)}
        {groups.map((g) => (
          <Label key={g[0]} x={gx((g[0] + g[g.length - 1]) / 2)} y={GY - 10} anchor="middle" size="s" color={C.blue}>
            edge-on {Math.floor(g[0])}{Math.floor(g[g.length - 1]) !== Math.floor(g[0]) ? `–${String(Math.floor(g[g.length - 1])).slice(2)}` : ''}
          </Label>
        ))}
        <Label x={GX1} y={GY - 27 * GS - 8} anchor="end" size="s" color={C.dim}>north face</Label>
        <Label x={GX1} y={GY + 27 * GS + 38} anchor="end" size="s" color={C.dim}>south face</Label>
        <circle cx={gx(y)} cy={GY - B * GS} r={6} fill={C.amber} stroke={C.bg} strokeWidth={2} />
      </Svg>
      <Controls>
        <RangeControl label="Year" value={Math.round(y * 10)} min={Y0 * 10} max={Y1 * 10} onChange={(v) => { setPlaying(false); setY(v / 10); }} format={() => String(Math.floor(y))} />
        <PlayButton playing={playing} onToggle={() => { if (y >= Y1) setY(Y0); setPlaying((p) => !p); }} label="Play 30 years" />
      </Controls>
      <Readout>
        {edge
          ? `${Math.floor(y)}: the rings are almost edge-on to us. They are typically only about ten metres thick, so they nearly vanish in a small telescope, and Saturn looks like a plain yellow ball.`
          : `${Math.floor(y)}: the rings are tilted ${Math.abs(B).toFixed(0)}° to our line of sight, ${Math.abs(B) > 20 ? 'wide open and bright' : 'opening or closing'}. The rings keep the same tilt in space; as Saturn circles the Sun every 29 years we see first one face, then the other, edge-on in between.`}
      </Readout>
    </div>
  );
}
