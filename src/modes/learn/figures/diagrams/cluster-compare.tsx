/**
 * Open vs globular clusters, side by side. "Up close": a loose open cluster (a few hundred stars, young, blue-white)
 * beside a dense globular (hundreds of thousands of stars, ancient, yellowish), simulated, with key facts.
 * "In the galaxy": an edge-on Milky Way with open clusters in the thin disc and globulars swarming in the
 * spherical halo around the centre, and the Sun marked. Facts: Wikipedia (Pleiades, Messier 13, Globular cluster), Nov 2026.
 */
import { useMemo, useState } from 'react';
import { C, ChoiceControl, Controls, Label, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { gauss, rng } from './_objects-lib';

export const meta: DiagramMeta = {
  title: 'Open and globular clusters',
  summary: 'A loose young open cluster beside a dense ancient globular, then both placed in the Milky Way: open clusters in the disc, globulars in the halo.',
  params: { view: '"close" | "galaxy" (default "close")' },
};

export default function ClusterCompare({ params }: DiagramProps) {
  const [view, setView] = useState<'close' | 'galaxy'>(params?.view === 'galaxy' ? 'galaxy' : 'close');
  const art = useMemo(() => {
    const r = rng(21);
    const open = Array.from({ length: 90 }, () => {
      const b = r() < 0.12;
      return { x: 180 + gauss(r) * 55, y: 170 + gauss(r) * 45, rr: b ? 2.6 + r() * 1.8 : 0.8 + r() * 0.8, c: b ? '#cfdcff' : r() < 0.5 ? '#f3f1ff' : '#ffe7c4' };
    });
    // Plummer sphere projected: r = a / sqrt(u^(-2/3) - 1)
    const glob = Array.from({ length: 2600 }, () => {
      const u = Math.max(0.02, r());
      const rad = Math.min(130, 16 / Math.sqrt(Math.pow(u, -2 / 3) - 1));
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
      const g = r() < 0.03;
      return { x: 540 + rad * Math.sin(ph) * Math.cos(th), y: 170 + rad * Math.sin(ph) * Math.sin(th), rr: g ? 1.6 : 0.6, c: g ? '#ffc98a' : r() < 0.6 ? '#fff0d6' : '#ffe2b0' };
    });
    const opens = Array.from({ length: 40 }, () => ({ x: Math.min(648, Math.max(72, 360 + gauss(r) * 130)), y: 210 + gauss(r) * 3 }));
    const globs = Array.from({ length: 70 }, () => {
      const u = Math.max(0.03, r());
      const rad = Math.min(170, 40 / Math.sqrt(Math.pow(u, -2 / 3) - 1));
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
      return { x: 360 + rad * Math.sin(ph) * Math.cos(th), y: 210 + rad * Math.cos(ph) * 0.95 };
    });
    return { open, glob, opens, globs };
  }, []);

  return (
    <div>
      {view === 'close' ? (
        <Svg w={720} h={380} title="An open cluster beside a globular cluster" desc="Left: a loose scattering of about a hundred stars, a few bright blue-white ones among them. Right: a ball of thousands of yellowish stars packed so tightly that the centre merges into a solid glow.">
          <rect x={20} y={20} width={330} height={300} rx={10} fill="#05070f" stroke={C.line} />
          <rect x={370} y={20} width={330} height={300} rx={10} fill="#05070f" stroke={C.line} />
          {art.open.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.rr} fill={s.c} />)}
          {art.glob.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.rr} fill={s.c} opacity={0.8} />)}
          <Label x={36} y={44} weight={700}>Open cluster</Label>
          <Label x={36} y={62} size="s" color={C.dim}>like the Pleiades</Label>
          <Label x={386} y={44} weight={700}>Globular cluster</Label>
          <Label x={386} y={62} size="s" color={C.dim}>like M13</Label>
          <Label x={36} y={342} size="s">hundreds to a few thousand stars · young</Label>
          <Label x={36} y={360} size="s" color={C.dim}>Pleiades: ~125 million years, ~40 light-years</Label>
          <Label x={386} y={342} size="s">hundreds of thousands of stars · ancient</Label>
          <Label x={386} y={360} size="s" color={C.dim}>M13: ~12 billion years, ~170 light-years</Label>
        </Svg>
      ) : (
        <Svg w={720} h={380} title="Where clusters live in the Milky Way" desc="The Milky Way seen edge-on: a thin disc with a central bulge, the Sun about halfway out. Open clusters, shown blue, lie in the thin disc. Globular clusters, shown yellow, are scattered through a large spherical halo centred on the bulge.">
          <ellipse cx={360} cy={210} rx={180} ry={180} fill="none" stroke={C.line} strokeDasharray="5 5" />
          <rect x={60} y={204} width={600} height={12} rx={6} fill="#29325f" />
          <ellipse cx={360} cy={210} rx={42} ry={24} fill="#ffe2a8" opacity={0.7} />
          {art.globs.map((g, i) => <circle key={`g${i}`} cx={g.x} cy={g.y} r={3} fill="#ffd27a" />)}
          {art.opens.map((o, i) => <circle key={`o${i}`} cx={o.x} cy={o.y} r={2.4} fill="#9db7ff" />)}
          <circle cx={360 - 94} cy={210} r={5} fill={C.amber} stroke={C.bg} />
          <Label x={360 - 94} y={244} anchor="middle" size="s" color={C.amber} weight={700}>Sun</Label>
          <Label x={360} y={22} anchor="middle" weight={700}>The Milky Way, edge-on (schematic)</Label>
          <Label x={548} y={66} size="s" color={C.dim}>halo</Label>
          <Label x={612} y={196} size="s" color={C.dim}>disc</Label>
          <circle cx={40} cy={354} r={4} fill="#9db7ff" />
          <Label x={50} y={358} size="s">open clusters: in the thin disc</Label>
          <circle cx={300} cy={354} r={4} fill="#ffd27a" />
          <Label x={310} y={358} size="s">globular clusters: in the halo, around the centre</Label>
        </Svg>
      )}
      <Controls>
        <ChoiceControl label="Show" value={view} options={[{ value: 'close', label: 'Up close' }, { value: 'galaxy', label: 'In the galaxy' }]} onChange={setView} />
      </Controls>
      <Readout>
        {view === 'close'
          ? 'Open clusters are loose and young, so they still have hot blue-white stars. Globulars are packed and ancient: their heavy blue stars died long ago, leaving yellow and orange light. Both are simulated here, not to the same scale.'
          : 'Open clusters are born, and slowly dissolve, in the thin disc where gas still makes new stars. Globulars swarm in a great sphere around the centre, so from the Sun we see most of them towards the centre: Sagittarius, Scorpius and Ophiuchus.'}
      </Readout>
    </div>
  );
}
