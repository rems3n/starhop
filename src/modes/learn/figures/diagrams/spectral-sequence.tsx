/**
 * The O B A F G K M sequence: one disc per class in its computed colour, with temperature range and example
 * stars. A second view compares how common each class is among all stars near the Sun with how common it is
 * among the stars you can see by eye (counted live from the app's own star catalog).
 */
import { useMemo, useState } from 'react';
import { useCatalog } from '@/data/catalog';
import { C, ChoiceControl, Controls, Label, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { fmt, tempColor } from './objects-lib';

export const meta: DiagramMeta = {
  title: 'The seven spectral classes',
  summary: 'O to M discs coloured by temperature with example stars; switch to compare how common each class is overall and among naked-eye stars.',
  params: { view: '"colour" | "common" — starting view (default "colour")' },
};

/**
 * Temperatures follow the lesson text (boundaries differ a little between sources).
 * Share of main-sequence stars: Wikipedia "Stellar classification" table (after LeDrew 2001), checked Nov 2026.
 */
const CLASSES = [
  { c: 'O', T: 36000, r1: 'over', r2: '30,000 K', range: 'over 30,000 K', look: 'blue', ex: 'Alnitak, Mintaka', share: 0.00003 },
  { c: 'B', T: 18000, r1: '10,000–', r2: '30,000 K', range: '10,000–30,000 K', look: 'blue-white', ex: 'Rigel, Spica', share: 0.12 },
  { c: 'A', T: 8700, r1: '7,500–', r2: '10,000 K', range: '7,500–10,000 K', look: 'white', ex: 'Sirius, Vega', share: 0.61 },
  { c: 'F', T: 6700, r1: '6,000–', r2: '7,500 K', range: '6,000–7,500 K', look: 'yellow-white', ex: 'Procyon, Polaris', share: 3.0 },
  { c: 'G', T: 5600, r1: '5,200–', r2: '6,000 K', range: '5,200–6,000 K', look: 'yellow', ex: 'Sun, Capella', share: 7.6 },
  { c: 'K', T: 4400, r1: '3,700–', r2: '5,200 K', range: '3,700–5,200 K', look: 'orange', ex: 'Arcturus, Aldebaran', share: 12 },
  { c: 'M', T: 3200, r1: 'under', r2: '3,700 K', range: 'under 3,700 K', look: 'orange-red', ex: 'Betelgeuse, Antares', share: 76 },
] as const;
type Cls = (typeof CLASSES)[number]['c'];

const X0 = 70, DX = 97;
const cx = (i: number) => X0 + i * DX;

export default function SpectralSequence({ params }: DiagramProps) {
  const [view, setView] = useState<'colour' | 'common'>(params?.view === 'common' ? 'common' : 'colour');
  const [sel, setSel] = useState<Cls>('G');
  const cat = useCatalog();
  const eye = useMemo(() => {
    if (!cat) return null;
    const n: Record<string, number> = {};
    let total = 0;
    for (const s of cat.stars) {
      const k = s.sp?.[0];
      if (k && 'OBAFGKM'.includes(k)) { n[k] = (n[k] ?? 0) + 1; total++; }
    }
    return { pct: Object.fromEntries(Object.entries(n).map(([k, v]) => [k, (100 * v) / total])) as Record<string, number>, total };
  }, [cat]);
  const cur = CLASSES.find((k) => k.c === sel)!;
  const pctLabel = (p: number) => (p < 0.01 ? '<0.01%' : p < 1 ? `${p.toFixed(2).replace(/0$/, '')}%` : `${Math.round(p)}%`);

  return (
    <div>
      <Svg w={720} h={300} title={meta.title} desc={view === 'colour' ? 'Seven discs from blue (class O) to orange-red (class M), each labelled with its temperature range and two example stars.' : 'Paired bars for each class: share among all stars near the Sun, where class M dominates at about three quarters, and share among naked-eye stars, where B, A and K stars dominate and M stars are rare.'}>
        <Label x={36} y={34} size="s" color={C.dim}>hottest</Label>
        <Label x={684} y={34} anchor="end" size="s" color={C.dim}>coolest</Label>
        <line x1={92} x2={628} y1={30} y2={30} stroke={C.line} markerEnd="url(#fig-arrow)" />
        {CLASSES.map((k, i) => {
          const on = k.c === sel;
          return (
            <g key={k.c} onClick={() => setSel(k.c)} style={{ cursor: 'pointer' }}>
              <rect x={cx(i) - 46} y={44} width={92} height={view === 'colour' ? 210 : 88} rx={8} fill={on ? C.panel : 'transparent'} stroke={on ? C.amber : 'transparent'} />
              <circle cx={cx(i)} cy={88} r={26} fill={tempColor(k.T)} />
              <text x={cx(i)} y={95} textAnchor="middle" fontSize={20} fontWeight={700} fill="#1b1b2b">{k.c}</text>
              {view === 'colour' && (
                <>
                  <Label x={cx(i)} y={138} anchor="middle" weight={700}>{k.look}</Label>
                  <Label x={cx(i)} y={160} anchor="middle" size="s" color={C.dim}>{k.r1}</Label>
                  <Label x={cx(i)} y={175} anchor="middle" size="s" color={C.dim}>{k.r2}</Label>
                  {k.ex.split(', ').map((e, j) => (
                    <Label key={e} x={cx(i)} y={204 + j * 19} anchor="middle">{e}</Label>
                  ))}
                </>
              )}
            </g>
          );
        })}
        {view === 'colour' && (
          <Label x={360} y={284} anchor="middle" size="s" color={C.dim}>
            Disc colours computed from each temperature; sizes are not to scale. Tap a class.
          </Label>
        )}
        {view === 'common' && (
          <g>
            {/* bars: all stars vs naked-eye stars, 0–80 % */}
            {[0, 20, 40, 60, 80].map((p) => (
              <g key={p}>
                <line x1={24} x2={700} y1={290 - p * 1.9} y2={290 - p * 1.9} stroke={C.line} strokeDasharray={p ? '2 5' : undefined} />
              </g>
            ))}
            {CLASSES.map((k, i) => {
              const a = k.share, b = eye?.pct[k.c] ?? 0;
              return (
                <g key={k.c}>
                  <rect x={cx(i) - 30} y={290 - Math.max(1, a * 1.9)} width={26} height={Math.max(1, a * 1.9)} fill={C.amber} />
                  <rect x={cx(i) + 4} y={290 - Math.max(1, b * 1.9)} width={26} height={Math.max(1, b * 1.9)} fill={C.blue} />
                  <Label x={cx(i) - 17} y={284 - Math.max(1, a * 1.9)} anchor="middle" size="s">{pctLabel(a)}</Label>
                  {eye && <Label x={cx(i) + 17} y={284 - Math.max(1, b * 1.9) - (Math.abs(a - b) < 4 ? 14 : 0)} anchor="middle" size="s">{pctLabel(b)}</Label>}
                </g>
              );
            })}
            <rect x={290} y={150} width={12} height={12} fill={C.amber} />
            <Label x={308} y={161} size="s">all stars near the Sun (most are dwarfs)</Label>
            <rect x={290} y={170} width={12} height={12} fill={C.blue} />
            <Label x={308} y={181} size="s">{eye ? `the ${fmt(eye.total)} stars you can see by eye` : 'naked-eye stars (loading…)'}</Label>
          </g>
        )}
      </Svg>
      <Controls>
        <ChoiceControl
          label="Show"
          value={view}
          options={[
            { value: 'colour', label: 'Colour and temperature' },
            { value: 'common', label: 'How common' },
          ]}
          onChange={setView}
        />
        <ChoiceControl label="Class" value={sel} options={CLASSES.map((k) => ({ value: k.c, label: k.c }))} onChange={setSel} />
      </Controls>
      <Readout>
        {view === 'colour'
          ? `Class ${cur.c}: ${cur.range}, ${cur.look}. Examples: ${cur.ex}.` + (cur.c === 'G' ? ' The Sun is a G star; from space it looks white, not yellow.' : '')
          : `Class ${cur.c} is ${pctLabel(cur.share)} of all stars near the Sun but ${eye ? pctLabel(eye.pct[cur.c] ?? 0) : '…'} of the stars you can see by eye.` +
            (cur.c === 'M' ? ' Red dwarfs are everywhere, but far too dim to see; the few red naked-eye stars are giants.' : cur.c === 'O' || cur.c === 'B' ? ' These rare, brilliant stars can be seen across hundreds of light-years, so they crowd the naked-eye sky.' : '')}
      </Readout>
    </div>
  );
}
