/**
 * Process diagram: the two life paths of stars, branching by mass from a shared stellar nursery.
 * Top row: Sun-like stars (main sequence → red giant → planetary nebula → white dwarf).
 * Bottom row: massive stars (blue main sequence → red supergiant → supernova → neutron star / black hole).
 * Real photos (from public/img, credits below the figure) where a photo exists; drawn icons where none does.
 */
import { useId, useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Step, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { imgUrl, type PhotoCredit } from './_objects-lib';

export const meta: DiagramMeta = {
  title: 'The two life paths of stars',
  summary: 'A branching process diagram from a stellar nursery to a white dwarf (Sun-like stars) or a supernova and neutron star (massive stars), with real photos; step through either path.',
  params: { path: '"low" | "high" — which path is highlighted first (default "low")', stage: 'starting stage 1–5 (default 1)' },
};

type Path = 'low' | 'high';
interface Stage { title: string; note: string; photo?: PhotoCredit; icon?: 'giant' | 'blue' | 'dwarf' | 'burst'; text: string }

const NURSERY: Stage = {
  title: 'Nursery', note: 'Orion Nebula',
  photo: { file: 'img/M42-1.jpg', label: 'Orion Nebula', kind: 'photograph', credit: 'NASA, ESA, M. Robberto (Space Telescope Science Institute/ESA) and the Hubble Space Telescope Orion Treasury Project Team', license: 'Public domain', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg' },
  text: 'A cold cloud of gas and dust collapses under its own gravity; dense clumps heat up until hydrogen fusion switches on. The Orion Nebula is making stars right now. Whether a newborn star takes the top or bottom path depends only on its mass.',
};
const LOW: Stage[] = [
  NURSERY,
  { title: 'Main sequence', note: 'the Sun today', photo: { file: 'img/Sun-1.jpg', label: 'the Sun', kind: 'photograph', credit: 'Matúš Motlo', license: 'CC BY-SA 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Sun_in_white_light.jpg' }, text: 'The star fuses hydrogen into helium in its core, steadily, for about 90% of its life: some 10 billion years for the Sun, which is about halfway through.' },
  { title: 'Red giant', note: 'like Aldebaran', icon: 'giant', text: 'With the core’s hydrogen gone, the core shrinks and heats while the outer layers swell to tens or hundreds of times the star’s old width and cool to orange-red. The Sun will do this in about 5 billion years.' },
  { title: 'Planetary nebula', note: 'Ring Nebula', photo: { file: 'img/M57-2.jpg', label: 'Ring Nebula', kind: 'photograph', credit: 'Göran Nilsson & The Liverpool Telescope', license: 'CC BY-SA 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Ring_Nebula_M57_Goran_Nilsson_&_The_Liverpool_Telescope.jpg' }, text: 'The giant gently puffs its outer layers into space, where the hot exposed core makes them glow for some tens of thousands of years before they fade.' },
  { title: 'White dwarf', note: 'like Sirius B', icon: 'dwarf', text: 'The leftover core: about the Sun’s mass squeezed into a ball the size of the Earth. It no longer fuses anything and slowly cools for billions of years. No explosion.' },
];
const HIGH: Stage[] = [
  NURSERY,
  { title: 'Blue main sequence', note: 'Trapezium stars', icon: 'blue', text: 'A star of more than about 8 solar masses fuses hydrogen so fiercely that it shines thousands of times brighter than the Sun, hot and blue-white, and runs out in only a few million to a few tens of millions of years.' },
  { title: 'Red supergiant', note: 'Betelgeuse', photo: { file: 'img/Betelgeuse-2.jpg', label: 'Betelgeuse', kind: 'false-color', credit: 'ESO/P. Kervella', license: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:ESO-Betelgeuse.jpg' }, text: 'The star swells into a supergiant hundreds of times wider than the Sun and fuses heavier and heavier elements in its core, ending with iron, which yields no energy. Betelgeuse and Antares are at this stage.' },
  { title: 'Supernova', note: 'core collapse', icon: 'burst', text: 'The iron core collapses in under a second and the star blows itself apart. For a few weeks it can outshine billions of ordinary stars, scattering newly made elements into space.' },
  { title: 'Neutron star', note: 'Crab Nebula', photo: { file: 'img/M1-1.jpg', label: 'Crab Nebula', kind: 'false-color', credit: 'NASA, ESA, J. Hester and A. Loll (Arizona State University)', license: 'Public domain', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Crab_Nebula.jpg' }, text: 'The collapsed core survives as a neutron star about 20 km across (or, for the heaviest stars, a black hole), inside the expanding debris. The Crab Nebula is the wreck of a supernova seen in 1054, with a spinning neutron star at its heart.' },
];

const COLS = [190, 322, 454, 590];
const ROW: Record<Path, number> = { low: 118, high: 316 };
const R = 44;

function Node({ st, cx, cy, r, on, dim, uid }: { st: Stage; cx: number; cy: number; r: number; on: boolean; dim: boolean; uid: string }) {
  const clip = `${uid}-${cx}-${cy}`;
  return (
    <g opacity={dim ? 0.35 : 1}>
      <circle cx={cx} cy={cy} r={r} fill="#05070f" />
      {st.photo && (
        <>
          <clipPath id={clip}><circle cx={cx} cy={cy} r={r} /></clipPath>
          <image href={imgUrl(st.photo.file)} x={cx - r} y={cy - r} width={2 * r} height={2 * r} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
        </>
      )}
      {st.icon === 'giant' && <circle cx={cx} cy={cy} r={r * 0.82} fill="#ffb469" />}
      {st.icon === 'blue' && (<><circle cx={cx} cy={cy} r={r * 0.5} fill="#a9c1ff" opacity={0.35} /><circle cx={cx} cy={cy} r={r * 0.3} fill="#c9d8ff" /></>)}
      {st.icon === 'dwarf' && (<><circle cx={cx} cy={cy} r={9} fill="#e9efff" opacity={0.3} /><circle cx={cx} cy={cy} r={4} fill="#f4f7ff" /></>)}
      {st.icon === 'burst' && (
        <g>
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2, l = i % 2 ? 0.55 : 0.9;
            return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r * l} y2={cy + Math.sin(a) * r * l} stroke="#ffe7b0" strokeWidth={2.5} strokeLinecap="round" />;
          })}
          <circle cx={cx} cy={cy} r={r * 0.28} fill="#fff6dc" />
        </g>
      )}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={on ? C.amber : C.lineStrong} strokeWidth={on ? 3 : 1} />
      <Label x={cx} y={cy + r + 18} anchor="middle" weight={700} color={on ? C.amber : C.text}>{st.title}</Label>
      <Label x={cx} y={cy + r + 34} anchor="middle" size="s" color={C.dim}>{st.note}</Label>
    </g>
  );
}

export default function StellarLifePaths({ params }: DiagramProps) {
  const uid = useId().replace(/:/g, '');
  const [path, setPath] = useState<Path>(params?.path === 'high' ? 'high' : 'low');
  const [stage, setStage] = useState(typeof params?.stage === 'number' ? Math.min(5, Math.max(1, params.stage as number)) : 1);
  const stages = path === 'low' ? LOW : HIGH;
  const cur = stages[stage - 1];
  const credits = [NURSERY, ...LOW.slice(1), ...HIGH.slice(1)].filter((s) => s.photo).map((s) => s.photo!);

  return (
    <div>
      <Svg w={720} h={420} title={meta.title} desc="A branching diagram. On the left a photo of the Orion Nebula, a stellar nursery. An upper path for Sun-like stars runs through the main sequence (photo of the Sun), a red giant, a planetary nebula (photo of the Ring Nebula) and a white dwarf. A lower path for massive stars runs through a blue main-sequence star, a red supergiant (image of Betelgeuse), a supernova and a neutron star in its debris (photo of the Crab Nebula).">
        <Label x={COLS[0] - R} y={34} weight={700} color={path === 'low' ? C.amber : C.dim}>Sun-like star (up to about 8 solar masses)</Label>
        <Label x={COLS[0] - R} y={ROW.high - R - 16} weight={700} color={path === 'high' ? C.amber : C.dim}>Massive star (over about 8 solar masses)</Label>
        {/* arrows */}
        {(['low', 'high'] as Path[]).map((p) => (
          <g key={p} opacity={p === path ? 1 : 0.35}>
            <path d={`M ${70 + 52} 216 C ${150} 216, ${120} ${ROW[p]}, ${COLS[0] - R - 6} ${ROW[p]}`} fill="none" stroke={C.lineStrong} strokeWidth={1.5} markerEnd="url(#fig-arrow)" />
            {COLS.slice(0, -1).map((x, i) => (
              <line key={i} x1={x + R + 4} x2={COLS[i + 1] - R - 6} y1={ROW[p]} y2={ROW[p]} stroke={C.lineStrong} strokeWidth={1.5} markerEnd="url(#fig-arrow)" />
            ))}
          </g>
        ))}
        <Node st={NURSERY} cx={70} cy={216} r={52} on={stage === 1} dim={false} uid={uid} />
        {(['low', 'high'] as Path[]).map((p) =>
          (p === 'low' ? LOW : HIGH).slice(1).map((st, i) => <Node key={p + i} st={st} cx={COLS[i]} cy={ROW[p]} r={R} on={p === path && stage === i + 2} dim={p !== path} uid={uid} />),
        )}
        <Step x={70 - 40} y={216 - 40} n={1} />
        {COLS.map((x, i) => <Step key={i} x={x - 34} y={ROW[path] - 34} n={i + 2} />)}
      </Svg>
      <Controls>
        <ChoiceControl label="Follow" value={path} options={[{ value: 'low', label: 'A Sun-like star' }, { value: 'high', label: 'A massive star' }]} onChange={setPath} />
        <RangeControl label="Stage" value={stage} min={1} max={5} onChange={setStage} format={(v) => `${v}. ${stages[v - 1].title}`} />
      </Controls>
      <Readout>
        <strong>{stage}. {cur.title}.</strong> {cur.text}
      </Readout>
      <p className="fig-credit">
        Photos: {credits.map((c, i) => (
          <span key={c.file}>
            {i ? '; ' : ''}{c.label} ({c.kind === 'false-color' ? 'false colour, ' : ''}{c.credit}, {c.license}, <a href={c.sourceUrl} target="_blank" rel="noreferrer">source</a>)
          </span>
        ))}. Drawn icons where no photo exists; not to scale.
      </p>
    </div>
  );
}
