/**
 * The Big Dipper changing shape. Positions of its seven stars from the app's catalog, moved along their measured
 * proper motions (Hipparcos values quoted in Wikipedia infoboxes, Nov 2026) by up to ±100,000 years. Five stars
 * (the Ursa Major moving group) travel together; Dubhe and Alkaid go the other way. Straight-line extrapolation of
 * motion across the sky; changes in distance (and so brightness) are ignored, as the figure says.
 */
import { useEffect, useState } from 'react';
import { useCatalog } from '@/data/catalog';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, rad, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';
import { fmt } from './_objects-lib';

export const meta: DiagramMeta = {
  title: 'The Big Dipper changing shape',
  summary: 'The seven Dipper stars moved along their measured motions from 100,000 years ago to 100,000 years ahead; five move together, two do not.',
  params: { years: 'starting offset in years, −100000 to 100000 (default 0)' },
};

/** proper motion in mas/yr: μα* (includes cos δ), μδ */
const DIPPER = [
  { name: 'Dubhe', pm: [-134.11, -34.7], group: false },
  { name: 'Merak', pm: [81.43, 33.49], group: true },
  { name: 'Phecda', pm: [107.68, 11.01], group: true },
  { name: 'Megrez', pm: [104.11, 7.3], group: true },
  { name: 'Alioth', pm: [111.91, -8.24], group: true },
  { name: 'Mizar', pm: [119.01, -25.97], group: true },
  { name: 'Alkaid', pm: [-121.17, -14.91], group: false },
];
const ORDER = ['Alkaid', 'Mizar', 'Alioth', 'Megrez', 'Phecda', 'Merak', 'Dubhe', 'Megrez'];
const RA0 = 183, DEC0 = 55.5, SCALE = 17; // px per degree
const LIM = 100000;

export default function DipperMovingGroup({ params }: DiagramProps) {
  const cat = useCatalog();
  const [t, setT] = useState(typeof params?.years === 'number' ? (params.years as number) : 0);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((v) => {
      const n = v + (reduced ? 20000 : 1500);
      if (n >= LIM) { setPlaying(false); return LIM; }
      return n;
    }), reduced ? 500 : 60);
    return () => clearInterval(id);
  }, [playing, reduced]);

  const pos = (name: string, yrs: number): [number, number] | null => {
    const s = cat?.stars.find((x) => x.name === name);
    const d = DIPPER.find((x) => x.name === name)!;
    if (!s) return null;
    const dec = s.dec + (d.pm[1] * yrs) / 3.6e6;
    const ra = s.ra + (d.pm[0] * yrs) / 3.6e6 / Math.cos(rad(s.dec));
    // simple tangent-plane projection, east to the left as seen in the sky
    const x = 380 - (ra - RA0) * Math.cos(rad(DEC0)) * SCALE;
    const y = 170 - (dec - DEC0) * SCALE;
    return [x, y];
  };
  const now = Object.fromEntries(DIPPER.map((d) => [d.name, pos(d.name, t)]));
  const today = Object.fromEntries(DIPPER.map((d) => [d.name, pos(d.name, 0)]));
  const line = ORDER.map((n) => now[n]).filter(Boolean) as [number, number][];
  const ghost = ORDER.map((n) => today[n]).filter(Boolean) as [number, number][];
  const when = t === 0 ? 'today' : t > 0 ? `${fmt(Math.round(t / 1000) * 1000)} years from now` : `${fmt(Math.round(-t / 1000) * 1000)} years ago`;

  return (
    <div>
      <Svg w={720} h={360} title={meta.title} desc="The seven stars of the Big Dipper joined by lines. The five middle stars drift together in one direction; Dubhe at the end of the bowl and Alkaid at the end of the handle drift the opposite way, so the shape slowly bends. Today's shape is shown faintly for comparison.">
        {!cat && <Label x={360} y={180} anchor="middle" color={C.dim}>Loading the star catalog…</Label>}
        {t !== 0 && ghost.length > 1 && <polyline points={ghost.map((p) => p.join(',')).join(' ')} fill="none" stroke={C.text} strokeOpacity={0.25} strokeDasharray="4 4" />}
        {line.length > 1 && <polyline points={line.map((p) => p.join(',')).join(' ')} fill="none" stroke={C.lineStrong} strokeWidth={1.5} />}
        {DIPPER.map((d) => {
          const p = now[d.name], p0 = today[d.name];
          if (!p || !p0) return null;
          const end = pos(d.name, 50000)!;
          return (
            <g key={d.name}>
              <line x1={p0[0]} y1={p0[1]} x2={end[0]} y2={end[1]} stroke={d.group ? C.amber : C.blue} strokeOpacity={0.5} strokeWidth={1.5} markerEnd="url(#fig-arrow)" />
              <circle cx={p[0]} cy={p[1]} r={6} fill={d.group ? C.amber : C.blue} stroke={C.bg} strokeWidth={1.5} />
              <Label x={p[0]} y={p[1] + (d.name === 'Megrez' || d.name === 'Dubhe' ? -12 : 22)} anchor="middle" size="s" weight={600}>{d.name}</Label>
            </g>
          );
        })}
        <circle cx={24} cy={328} r={5} fill={C.amber} />
        <Label x={34} y={332} size="s">moving together: the Ursa Major moving group</Label>
        <circle cx={360} cy={328} r={5} fill={C.blue} />
        <Label x={370} y={332} size="s">unrelated: moving another way</Label>
        <Label x={24} y={350} size="s" color={C.dim}>arrows: motion over the next 50,000 years · motion towards or away from us ignored</Label>
        <Label x={24} y={30} weight={700}>The Big Dipper, {when}</Label>
      </Svg>
      <Controls>
        <RangeControl label="Years from now" value={t} min={-LIM} max={LIM} step={1000} onChange={(v) => { setPlaying(false); setT(v); }} format={(v) => (v === 0 ? 'today' : `${v > 0 ? '+' : '−'}${fmt(Math.abs(v))}`)} />
        <PlayButton playing={playing} onToggle={() => { if (t >= LIM) setT(-LIM); setPlaying((p) => !p); }} label="Run time forward" />
      </Controls>
      <Readout>
        {t === 0
          ? 'Today: the familiar dipper. The five orange-marked stars were born together and still travel together; Dubhe and Alkaid just happen to lie in the same direction.'
          : `${when[0].toUpperCase()}${when.slice(1)}: the five group stars have moved as a body, while Dubhe and Alkaid have drifted the other way, so the bowl and handle ${Math.abs(t) > 40000 ? 'are clearly bent out of shape' : 'have started to change shape'}.`}
      </Readout>
    </div>
  );
}
