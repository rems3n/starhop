/**
 * Looking out is looking back. A log scale of light-travel time from the Moon (1.3 light-seconds) to the earliest
 * galaxies (~13.5 billion years), with real objects marked. Slide the "light left its source" marker, or jump to an
 * object, and the readout says what was happening on Earth when that light set out.
 * Distances: Wikipedia infoboxes (Nov 2026), rounded. For the farthest galaxies the number is the light-travel time,
 * not today's distance (space has expanded meanwhile); the figure says so.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { years } from './objects-lib';

export const meta: DiagramMeta = {
  title: 'Looking out is looking back in time',
  summary: 'A log scale of light-travel time from the Moon to the earliest galaxies; slide or jump to an object to see what was happening on Earth when its light set out.',
  params: { object: 'starting object id: moon, sun, sirius, m42, centre, lmc, m31, m87, early (default m31)' },
};

const YR = 3.156e7; // seconds per year
const OBJ: { id: string; name: string; t: number; how: string; lv: 1 | 2 | -1 | -2 }[] = [
  { id: 'moon', name: 'Moon', t: 1.28 / YR, how: '1.3 seconds', lv: 1 },
  { id: 'sun', name: 'Sun', t: 499 / YR, how: '8.3 minutes', lv: -1 },
  { id: 'sirius', name: 'Sirius', t: 8.6, how: '8.6 years', lv: 1 },
  { id: 'm42', name: 'Orion Nebula', t: 1340, how: 'about 1,300 years', lv: -1 },
  { id: 'centre', name: 'Galaxy’s centre', t: 26000, how: 'about 26,000 years', lv: 1 },
  { id: 'lmc', name: 'Large Magellanic Cloud', t: 163000, how: 'about 160,000 years', lv: -2 },
  { id: 'm31', name: 'Andromeda Galaxy', t: 2.5e6, how: 'about 2.5 million years', lv: 2 },
  { id: 'm87', name: 'M87, Virgo Cluster', t: 5.35e7, how: 'about 54 million years', lv: -1 },
  { id: 'early', name: 'Earliest galaxies seen', t: 1.35e10, how: 'about 13.5 billion years', lv: 1 },
];
const LMIN = Math.log10(0.5 / YR), LMAX = Math.log10(1.38e10);
const X0 = 30, X1 = 690, AY = 168;
const LY: Record<number, number> = { 1: -40, 2: -66, [-1]: 46, [-2]: 70 };
const ax = (t: number) => X0 + ((Math.log10(t) - LMIN) / (LMAX - LMIN)) * (X1 - X0);

/** What was happening on Earth (or in the cosmos) a given number of years ago. Rounded textbook dates. */
function then(t: number): string {
  if (t < 1 / 365) return 'a moment ago: effectively now';
  if (t < 1) return 'earlier today or this year';
  if (t < 30) return 'within your own lifetime, perhaps';
  if (t < 500) return 'in recent history';
  if (t < 5000) return 'in recorded history (the Orion Nebula’s light left around the 7th century)';
  if (t < 12000) return 'around the end of the last ice age, as farming began';
  if (t < 100000) return 'during the last ice age, when people lived by hunting and gathering';
  if (t < 300000) return 'when early modern humans were living in Africa';
  if (t < 4e6) return 'before modern humans existed: early human relatives were living in Africa';
  if (t < 6.6e7) return 'after the dinosaurs died out (66 million years ago), but long before any humans';
  if (t < 2.5e8) return 'in the age of dinosaurs';
  if (t < 5.4e8) return 'when animal life was spreading through the seas and onto land';
  if (t < 4.6e9) return 'when life on Earth was only single cells';
  if (t < 1e10) return 'before the Sun and Earth had formed (4.6 billion years ago)';
  return 'when the universe was young, only a few hundred million years after the Big Bang';
}

export default function LookbackTime({ params }: DiagramProps) {
  const start = OBJ.find((o) => o.id === params?.object) ?? OBJ[6];
  const [lg, setLg] = useState(Math.log10(start.t));
  const t = Math.pow(10, lg);
  const near = OBJ.find((o) => Math.abs(Math.log10(o.t) - lg) < 0.08);
  const ticks = [{ t: 1 / YR, l: '1 s' }, { t: 3600 / YR, l: '1 hr' }, { t: 1, l: '1 yr' }, { t: 1000, l: '1,000 yr' }, { t: 1e6, l: '1 Myr' }, { t: 1e9, l: '1 Gyr' }];

  return (
    <div>
      <Svg w={720} h={290} title={meta.title} desc="A logarithmic scale of light-travel time, from 1 second on the left to 13.8 billion years on the right, with the Moon, Sun, Sirius, the Orion Nebula, the galaxy's centre, the Large Magellanic Cloud, the Andromeda Galaxy, M87 and the earliest galaxies marked, and a marker for the chosen light-travel time.">
        <Label x={X0} y={30} weight={700}>How long the light has been travelling</Label>
        <Label x={X0} y={48} size="s" color={C.dim}>log scale: each tick is a jump of about a thousand times</Label>
        <line x1={X0} x2={X1} y1={AY} y2={AY} stroke={C.lineStrong} strokeWidth={2} />
        {ticks.map((k) => (
          <g key={k.l}>
            <line x1={ax(k.t)} x2={ax(k.t)} y1={AY - 5} y2={AY + 5} stroke={C.lineStrong} />
            <Label x={ax(k.t)} y={AY + 20} anchor="middle" size="s" color={C.dim}>{k.l}</Label>
          </g>
        ))}
        {OBJ.map((o) => {
          const x = ax(o.t), on = near?.id === o.id, ly = LY[o.lv];
          const anchor = x > 640 ? 'end' : x < 60 ? 'start' : 'middle';
          return (
            <g key={o.id} style={{ cursor: 'pointer' }} onClick={() => setLg(Math.log10(o.t))}>
              <line x1={x} x2={x} y1={AY} y2={AY + ly + (ly < 0 ? 6 : -14)} stroke={on ? C.amber : C.line} />
              <circle cx={x} cy={AY} r={on ? 6 : 4} fill={on ? C.amber : C.text} />
              <Label x={anchor === 'end' ? x + 4 : anchor === 'start' ? x - 4 : x} y={AY + ly} anchor={anchor} size="s" weight={on ? 700 : 500} color={on ? C.amber : C.text}>{o.name}</Label>
            </g>
          );
        })}
        <path d={`M ${ax(t)} ${AY - 82} l -8 -14 h 16 z`} fill={C.amber} />
        <line x1={ax(t)} x2={ax(t)} y1={AY - 82} y2={AY} stroke={C.amber} strokeDasharray="3 3" />
        <Label x={X0} y={276} size="s" color={C.dim}>
          For the farthest galaxies this is the travel time of the light; space has stretched while it travelled.
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Light-travel time" value={Math.round(lg * 100)} min={Math.ceil(LMIN * 100)} max={Math.floor(LMAX * 100)} onChange={(v) => setLg(v / 100)} format={() => (near ? near.how : years(t))} />
        <ChoiceControl label="Jump to" value={near?.id ?? ''} options={OBJ.filter((o) => o.id !== 'moon').map((o) => ({ value: o.id, label: o.name.replace(', Virgo Cluster', '').replace('Large Magellanic Cloud', 'LMC').replace('Earliest galaxies seen', 'Earliest galaxies') }))} onChange={(id) => setLg(Math.log10(OBJ.find((o) => o.id === id)!.t))} />
      </Controls>
      <Readout>
        {near ? `Light from ${near.name === 'Earliest galaxies seen' ? 'the earliest galaxies yet seen' : `the ${near.name}`.replace('the Sirius', 'Sirius').replace('the M87', 'M87')} takes ${near.how} to reach you. ` : `Light that has travelled for ${years(t)} `}
        {near ? 'You see it as it was when that light set out: ' : 'set out '}
        {then(t)}.
      </Readout>
    </div>
  );
}
