/**
 * A star cluster growing old. One simulated cluster (stars born together, masses drawn from a standard
 * initial-mass distribution) is aged with a slider: the heaviest stars run out of fuel first, swell briefly into
 * red giants and vanish, so the cluster's brightest stars and overall colour shift from blue-white to yellow-orange.
 * Real clusters of known age are marked. Lifetimes from the rough rule in objects-lib (msLifetime).
 */
import { useMemo, useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, clamp, type DiagramMeta, type DiagramProps } from '../kit';
import { fmt, gauss, msLifetime, msLum, msTemp, rng, sig, tempColor, turnoffMass, years } from './objects-lib';

export const meta: DiagramMeta = {
  title: 'A cluster growing old',
  summary: 'Age a simulated star cluster from 1 million to 12 billion years and watch its brightest blue stars die off, turning the cluster yellow; real clusters marked.',
  params: { age: 'starting age in years (default 1e7)' },
};

/** Ages from Wikipedia infoboxes (Nov 2026), rounded. */
const REAL = [
  { id: 'pleiades', name: 'Pleiades', age: 1.25e8 },
  { id: 'hyades', name: 'Hyades', age: 6.25e8 },
  { id: 'm67', name: 'M67', age: 4e9 },
  { id: 'm13', name: 'M13', age: 1.165e10 },
];
const AMIN = 1e6, AMAX = 1.2e10;
const toS = (a: number) => (1000 * Math.log(a / AMIN)) / Math.log(AMAX / AMIN);
const fromS = (s: number) => AMIN * Math.pow(AMAX / AMIN, s / 1000);

interface S { M: number; x: number; y: number }
function makeCluster(): S[] {
  const r = rng(5);
  const out: S[] = [];
  // Salpeter-like: N(M) ∝ M^-2.35 between 0.4 and 40 Suns (fainter stars would be invisible dots anyway)
  for (let i = 0; i < 420; i++) {
    const u = r();
    const a = 0.4 ** -1.35, b = 40 ** -1.35;
    const M = Math.pow(a + u * (b - a), -1 / 1.35);
    const rad = 70 * Math.sqrt(Math.abs(gauss(r))) * (0.5 + r());
    const th = r() * Math.PI * 2;
    out.push({ M, x: 190 + Math.cos(th) * rad * 1.5, y: 180 + Math.sin(th) * rad });
  }
  return out;
}

export default function ClusterAging({ params }: DiagramProps) {
  const [age, setAge] = useState(typeof params?.age === 'number' ? clamp(params.age as number, AMIN, AMAX) : 1e7);
  const stars = useMemo(makeCluster, []);
  const mTO = turnoffMass(age);
  const mGiant = turnoffMass(age / 1.12); // stars a little heavier than the turn-off are in their brief giant phase

  const drawn = stars.map((s) => {
    if (s.M <= mTO) { const L = msLum(s.M); return { ...s, L, T: msTemp(s.M), giant: false }; }
    if (s.M <= mGiant) return { ...s, L: 60 + 4 * msLum(Math.min(s.M, 15)), T: s.M > 8 ? 3700 : 4300, giant: true };
    return null;
  }).filter((s): s is NonNullable<typeof s> => !!s);
  const Ltot = drawn.reduce((a, s) => a + s.L, 0);
  // light-weighted colour of the whole cluster (average of temperatures in log, weighted by light)
  const Tmix = Math.exp(drawn.reduce((a, s) => a + s.L * Math.log(s.T), 0) / Math.max(Ltot, 1e-9));
  const hottest = drawn.filter((s) => !s.giant).reduce((m, s) => Math.max(m, s.T), 0);
  const cls = (T: number) => (T > 30000 ? 'O' : T > 10000 ? 'B' : T > 7500 ? 'A' : T > 6000 ? 'F' : T > 5200 ? 'G' : T > 3700 ? 'K' : 'M');
  const giants = drawn.filter((s) => s.giant).length;
  const lost = stars.length - drawn.length;
  const near = REAL.find((c) => Math.abs(Math.log(c.age / age)) < 0.06);

  // timeline
  const TX0 = 400, TX1 = 700, TY = 300;
  const tx = (a: number) => TX0 + (Math.log(a / AMIN) / Math.log(AMAX / AMIN)) * (TX1 - TX0);

  return (
    <div>
      <Svg w={720} h={350} title={meta.title} desc="Left: a simulated star cluster whose stars are drawn in their colours and brightnesses at the chosen age. Right: a disc showing the cluster's overall colour, the hottest surviving star class, and a timeline of ages with real clusters marked.">
        <rect x={20} y={30} width={340} height={300} rx={10} fill="#05070f" stroke={C.line} />
        <clipPath id="ca-clip"><rect x={20} y={30} width={340} height={300} rx={10} /></clipPath>
        <g clipPath="url(#ca-clip)">
        {drawn.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={clamp(1 + 1.5 * Math.log10(1 + s.L), 1, 8)} fill={tempColor(s.T)} opacity={clamp(0.55 + 0.2 * Math.log10(1 + s.L), 0.55, 1)} />
        ))}
        </g>
        <Label x={30} y={50} size="s" color={C.dim}>simulated cluster, {years(age)} old</Label>

        <Label x={400} y={50} weight={700}>Overall colour</Label>
        <circle cx={430} cy={98} r={26} fill={tempColor(Tmix)} />
        <Label x={468} y={94} size="s">light from the whole cluster</Label>
        <Label x={468} y={110} size="s" color={C.dim}>looks like a {fmt(Math.round(Tmix / 100) * 100)} K glow</Label>
        <Label x={400} y={160} weight={700}>Hottest stars left: class {cls(hottest)}</Label>
        <Label x={400} y={180} size="s" color={C.dim}>heavier than {fmt(sig(mTO, 2))} Suns: used up their fuel</Label>
        <Label x={400} y={198} size="s" color={C.dim}>{giants ? `${giants} red giant${giants > 1 ? 's' : ''} right now` : 'no giants right now'} · {lost} stars gone of {stars.length}</Label>

        <line x1={TX0} x2={TX1} y1={TY} y2={TY} stroke={C.lineStrong} />
        {[1e6, 1e8, 1e10].map((a) => (
          <Label key={a} x={tx(a)} y={TY + 18} anchor="middle" size="s" color={C.dim}>{years(a).replace(' years', '')}</Label>
        ))}
        {REAL.map((c, i) => (
          <g key={c.id}>
            <line x1={tx(c.age)} x2={tx(c.age)} y1={TY} y2={TY - 16 - (i % 2) * 18} stroke={C.line} />
            <Label x={tx(c.age)} y={TY - 20 - (i % 2) * 18} anchor="middle" size="s" color={near?.id === c.id ? C.amber : C.text}>{c.name}</Label>
          </g>
        ))}
        <circle cx={tx(age)} cy={TY} r={6} fill={C.amber} />
        <Label x={TX0} y={TY + 40} size="s" color={C.dim}>age (log scale)</Label>
      </Svg>
      <Controls>
        <RangeControl label="Cluster age" value={Math.round(toS(age))} min={0} max={1000} onChange={(v) => setAge(fromS(v))} format={() => years(age)} />
        <ChoiceControl label="Real clusters" value={near?.id ?? ''} options={REAL.map((c) => ({ value: c.id, label: c.name }))} onChange={(id) => setAge(REAL.find((c) => c.id === id)!.age)} />
      </Controls>
      <Readout>
        {near ? `${near.name}, about ${years(near.age)} old. ` : ''}
        {mTO > 15
          ? 'Young: blazing blue O and B stars dominate the light.'
          : mTO > 2.5
            ? `The O stars and the heaviest B stars are gone; the hottest left are class ${cls(hottest)}. Young open clusters like this look blue-white.`
            : mTO > 1.2
              ? `Middle-aged: the brightest main-sequence stars are now class ${cls(hottest)}, and orange giants add warm light.`
              : 'Ancient: only stars about as heavy as the Sun or lighter still shine on the main sequence. The cluster’s light is yellowish, from Sun-like stars and orange giants, like a globular cluster.'}
        {mTO <= 40 ? ` Stars heavier than ${fmt(sig(mTO, 2))} solar masses live less than ${years(msLifetime(mTO))}, so they are gone.` : ''}
      </Readout>
    </div>
  );
}
