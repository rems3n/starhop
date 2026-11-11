/**
 * The flat solar system. The real orbits of the eight planets (and dwarf planet Pluto for contrast) are
 * sampled from astronomy-engine and drawn in 3-D. The learner tilts the view from "from above" to "edge-on"
 * and can exaggerate the tilts ×5. Distances are compressed (logarithmic) so the inner planets show;
 * directions and tilts are true.
 */
import { useMemo, useState } from 'react';
import { Body, HelioVector, Rotation_EQJ_ECL, RotateVector } from 'astronomy-engine';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, rad, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'A flat solar system',
  summary: 'The planets’ real orbits in 3-D; tilt the view from above to edge-on and exaggerate the tilts to see how nearly flat the system is.',
  params: { view: 'starting view angle above the plane, 0–90 (default 0 = edge-on)', exaggerate: 'true to start with tilts ×5' },
};

const PLANETS: { body: Body; name: string; years: number; incl: string; color: string; dwarf?: boolean }[] = [
  { body: Body.Mercury, name: 'Mercury', years: 0.241, incl: '7.0°', color: '#b9b2a6' },
  { body: Body.Venus, name: 'Venus', years: 0.615, incl: '3.4°', color: '#f1e3b8' },
  { body: Body.Earth, name: 'Earth', years: 1, incl: '0° (by definition)', color: C.earth },
  { body: Body.Mars, name: 'Mars', years: 1.881, incl: '1.8°', color: C.red },
  { body: Body.Jupiter, name: 'Jupiter', years: 11.86, incl: '1.3°', color: '#e3c89a' },
  { body: Body.Saturn, name: 'Saturn', years: 29.46, incl: '2.5°', color: '#e8d590' },
  { body: Body.Uranus, name: 'Uranus', years: 84.0, incl: '0.8°', color: '#9fd8dc' },
  { body: Body.Neptune, name: 'Neptune', years: 164.8, incl: '1.8°', color: '#7c9cf0' },
  { body: Body.Pluto, name: 'Pluto', years: 247.9, incl: '17.2°', color: C.dim, dwarf: true },
];
const CX = 360, CY = 168, K = 132, R0 = 0.15;
const compress = (r: number) => K * Math.log10(r / R0);
const ROT = Rotation_EQJ_ECL();
const T0 = new Date(Date.UTC(2027, 0, 1));
/** Look along ecliptic longitude 90°: the direction from which most planets' node lines are seen nearly end-on. */
const AZ = rad(90);

export default function SolarSystemEdgeOn({ params }: DiagramProps) {
  const [view, setView] = useState(typeof params?.view === 'number' ? (params.view as number) : 0);
  const [ex, setEx] = useState<'1' | '5'>(params?.exaggerate === true ? '5' : '1');
  const orbits = useMemo(
    () =>
      PLANETS.map((p) => {
        const n = 120;
        const pts: [number, number, number][] = [];
        for (let i = 0; i <= n; i++) {
          const t = new Date(T0.getTime() + (i / n) * p.years * 365.25 * 86400000);
          const v = RotateVector(ROT, HelioVector(p.body, t));
          pts.push([v.x, v.y, v.z]);
        }
        return pts;
      }),
    [],
  );
  const e = rad(view), f = Number(ex);
  const proj = ([x, y, z]: [number, number, number]): [number, number] => {
    const r = Math.hypot(x, y, z);
    const z2 = z * f;
    const r2 = Math.hypot(x, y, z2);
    const s = compress(r) / r2; // keep compressed distance, true (or exaggerated) direction
    const X = x * s, Y = y * s, Z = z2 * s;
    // rotate so we look along AZ, then tilt by view elevation
    const u = X * Math.sin(AZ) - Y * Math.cos(AZ); // across the page
    const w = X * Math.cos(AZ) + Y * Math.sin(AZ); // away from the viewer
    void r;
    return [CX + u, CY - (w * Math.sin(e) + Z * Math.cos(e))];
  };

  const stagger = [-18, 30, -34, 46, -18, 30, -34, 46, -18];
  return (
    <div>
      <Svg w={720} h={340} title={meta.title} desc={`The planets' orbits seen from ${view < 5 ? 'edge-on' : view > 85 ? 'above' : `${view} degrees above the plane`}${f > 1 ? ', with tilts exaggerated five times' : ''}. All the planets' orbits lie close to one plane; Pluto's is tilted more.`}>
        <line x1={14} y1={CY} x2={706} y2={CY} stroke={C.line} strokeDasharray="2 5" />
        {orbits.map((pts, i) => {
          const p = PLANETS[i];
          if (p.dwarf && f > 1) return null;
          const d = pts.map((q) => proj(q)).map(([x, y], j) => `${j ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
          return <path key={p.name} d={d} fill="none" stroke={p.color} strokeWidth={p.dwarf ? 1.2 : 1.6} strokeDasharray={p.dwarf ? '4 4' : undefined} opacity={0.85} />;
        })}
        <circle cx={CX} cy={CY} r={9} fill="url(#fig-glow)" />
        <circle cx={CX} cy={CY} r={4} fill={C.sun} />
        {orbits.map((pts, i) => {
          const p = PLANETS[i];
          if (p.dwarf && f > 1) return null;
          const [x, y] = proj(pts[0]);
          // label at the orbit's rightmost point
          let best = proj(pts[0]);
          for (const q of pts) {
            const pq = proj(q);
            if (pq[0] > best[0]) best = pq;
          }
          const ly = best[1] + stagger[i];
          const anchor = best[0] > 690 ? 'end' : 'middle';
          return (
            <g key={p.name}>
              <circle cx={x} cy={y} r={p.dwarf ? 2.5 : 3.5} fill={p.color} />
              <line x1={best[0]} y1={best[1]} x2={best[0]} y2={ly + (stagger[i] < 0 ? 4 : -12)} stroke={C.line} />
              <Label x={anchor === 'end' ? 706 : best[0]} y={ly} anchor={anchor} size="s" color={p.dwarf ? C.dim : C.text} italic={p.dwarf}>
                {p.name}
              </Label>
            </g>
          );
        })}
        <Label x={14} y={24} size="s" color={C.dim}>
          {view < 5 ? 'Edge-on: as we see it from inside the disc' : view > 85 ? 'From above the north pole of the solar system' : `Seen from ${view}° above the plane`}
        </Label>
        <Label x={706} y={324} anchor="end" size="s" color={C.faint}>
          {`real orbits · distances compressed${f > 1 ? ' · tilts exaggerated ×5 (Pluto hidden)' : ' · true tilts'} · dots: 1 Jan 2027`}
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="View from above the plane" value={view} min={0} max={90} step={1} onChange={setView} format={(v) => (v === 0 ? 'edge-on' : `${v}°`)} />
        <ChoiceControl
          label="Tilts"
          value={ex}
          options={[
            { value: '1', label: 'True' },
            { value: '5', label: 'Exaggerated ×5' },
          ]}
          onChange={setEx}
        />
      </Controls>
      <Readout>
        {view < 10
          ? `Edge-on, the planets' paths ${f > 1 ? 'fan out a little only because the tilts are multiplied by five' : 'almost merge into one line'}. Measured against Earth's orbit, Venus is tilted 3.4°, Mars 1.8°, Jupiter 1.3°, Saturn 2.5°, Mercury 7°. This flat disc is what we see from inside as the ecliptic, and only Pluto, a dwarf planet, strays far (17°).`
          : view > 80
            ? 'From above, the orbits are nearly circles round the Sun, all going the same way. Tilt the view down to edge-on to see how flat they are.'
            : 'Keep tilting toward edge-on: the circles squash into thin ovals and then almost into a single line.'}
      </Readout>
    </div>
  );
}
