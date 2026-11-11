/**
 * Hubble's tuning fork of galaxy shapes, drawn schematically, with a real photograph of an example of the selected
 * type beside it (photos from public/img; credits under the figure). Pick a type with the buttons or by tapping a
 * shape. A sorting scheme by appearance, not a life story; the readout says so.
 */
import { useId, useMemo, useState } from 'react';
import { C, ChoiceControl, Controls, Label, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { imgUrl, type PhotoCredit } from './_objects-lib';

export const meta: DiagramMeta = {
  title: 'Galaxy shapes: Hubble’s tuning fork',
  summary: 'Schematic tuning fork of elliptical, lenticular, spiral, barred-spiral and irregular galaxies; choose a type to see a real example photographed.',
  params: { type: '"E" | "S0" | "S" | "SB" | "Irr" — starting type (default "S")' },
};

type T = 'E' | 'S0' | 'S' | 'SB' | 'Irr';
const TYPES: Record<T, { name: string; ex: string; text: string; photo: PhotoCredit }> = {
  E: { name: 'Elliptical', ex: 'M49 in Virgo (type E2)', text: 'A smooth ball or oval of mostly old, yellowish stars with little gas or dust and no arms, so almost no new stars form. The biggest galaxies of all are giant ellipticals such as M49 and M87.', photo: { file: 'img/M49-1.jpg', label: 'M49', kind: 'photograph', credit: 'RubinObs/NOIRLab/SLAC/NSF/DOE/AURA', license: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Messier_49-Rubin_Observatory.png' } },
  S0: { name: 'Lenticular', ex: 'the Spindle, M102 (seen edge-on)', text: 'In between: a disc and a central bulge like a spiral, but no spiral arms and little gas. Seen edge-on, as here, it looks like a lens or a spindle.', photo: { file: 'img/M102-1.jpg', label: 'M102', kind: 'photograph', credit: 'Sboone61', license: 'CC0 1.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:M102_PS.jpg' } },
  S: { name: 'Spiral', ex: 'the Whirlpool, M51', text: 'A flat, rotating disc with a central bulge and winding arms. The arms are where gas piles up and new stars form; their hot blue stars make the arms stand out. Along the fork, the arms get looser and the bulge smaller.', photo: { file: 'img/M51-1.jpg', label: 'M51', kind: 'photograph', credit: 'NASA and European Space Agency', license: 'Public domain', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Messier51_sRGB.jpg' } },
  SB: { name: 'Barred spiral', ex: 'NGC 1365 in Fornax', text: 'A spiral whose arms start from the ends of a straight bar of stars across the centre. Many spirals have a bar, and so does the Milky Way.', photo: { file: 'img/NGC1365-1.jpg', label: 'NGC 1365', kind: 'photograph', credit: 'Dark Energy Survey/DOE/FNAL/DECam/CTIO/NOIRLab/NSF/AURA; processing T. Rector, J. Miller, M. Zamani & D. de Martin', license: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Portrait_of_the_Great_Barred_Spiral.jpg' } },
  Irr: { name: 'Irregular', ex: 'the Small Magellanic Cloud', text: 'No tidy shape at all, often because a neighbour’s gravity has pulled it about. The Magellanic Clouds, small companions of the Milky Way, are the best-known irregulars.', photo: { file: 'img/SMC-1.jpg', label: 'Small Magellanic Cloud', kind: 'photograph', credit: 'ESA/Hubble and Digitized Sky Survey 2', license: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Small_Magellanic_Cloud_(Digitized_Sky_Survey_2).jpg' } },
};

function spiral(cx: number, cy: number, r: number, open: number, barLen: number) {
  const out: string[] = [];
  for (const off of [0, Math.PI]) {
    const pts: string[] = [];
    for (let t = 0; t <= 3.4; t += 0.1) {
      const rr = barLen + (r - barLen) * (t / 3.4);
      const a = off + t * (1.2 - open * 0.35);
      pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr * 0.62).toFixed(1)}`);
    }
    out.push(`M ${pts.join(' L ')}`);
  }
  return out;
}

export default function HubbleSequence({ params }: DiagramProps) {
  const id = useId().replace(/:/g, '');
  const p = params?.type as T | undefined;
  const [sel, setSel] = useState<T>(p && p in TYPES ? p : 'S');
  const cur = TYPES[sel];
  const shapes = useMemo(() => ({
    spirals: [0, 1, 2].map((i) => spiral(250 + i * 78, 70, 26, i, 4)),
    bars: [0, 1, 2].map((i) => spiral(250 + i * 78, 214, 26, i, 11)),
  }), []);
  const glow = '#ffe6b8';
  const hit = (t: T) => ({ onClick: () => setSel(t), style: { cursor: 'pointer' }, opacity: sel === t ? 1 : 0.62 });

  return (
    <div>
      <Svg w={720} h={300} title={meta.title} desc={`Hubble's tuning fork: ellipticals on the handle from round to flattened, a lenticular at the fork, ordinary spirals on the upper prong and barred spirals on the lower prong with arms getting looser, and irregulars set apart. Beside it, a photograph of ${cur.ex}.`}>
        <defs>
          <radialGradient id={`${id}g`}><stop offset="0" stopColor="#fff6dc" /><stop offset="0.5" stopColor={glow} stopOpacity="0.7" /><stop offset="1" stopColor={glow} stopOpacity="0" /></radialGradient>
          <clipPath id={`${id}ph`}><rect x={500} y={40} width={204} height={204} rx={8} /></clipPath>
        </defs>
        {/* fork lines */}
        <path d="M 30 142 L 190 142 M 190 142 L 222 72 L 430 72 M 190 142 L 222 214 L 430 214" fill="none" stroke={C.line} strokeWidth={2} />
        {/* ellipticals */}
        <g {...hit('E')}>
          {[0, 3, 6].map((e, i) => <ellipse key={e} cx={44 + i * 52} cy={142} rx={20} ry={20 * (1 - e / 10)} fill={`url(#${id}g)`} />)}
          {['E0', 'E3', 'E6'].map((t, i) => <Label key={t} x={44 + i * 52} y={182} anchor="middle" size="s" color={C.dim}>{t}</Label>)}
          <Label x={74} y={112} anchor="middle" weight={700} color={sel === 'E' ? C.amber : C.text}>Elliptical</Label>
        </g>
        {/* lenticular */}
        <g {...hit('S0')}>
          <ellipse cx={196} cy={142} rx={24} ry={9} fill={glow} opacity={0.55} />
          <ellipse cx={196} cy={142} rx={10} ry={8} fill="#fff6dc" />
          <Label x={196} y={182} anchor="middle" size="s" color={C.dim}>S0</Label>
          <Label x={196} y={112} anchor="middle" weight={700} color={sel === 'S0' ? C.amber : C.text}>Lenticular</Label>
        </g>
        {/* spirals */}
        <g {...hit('S')}>
          {shapes.spirals.map((arms, i) => (
            <g key={i}>
              {arms.map((d, j) => <path key={j} d={d} fill="none" stroke="#b9c8ff" strokeWidth={3} strokeLinecap="round" opacity={0.8} />)}
              <ellipse cx={250 + i * 78} cy={70} rx={9 - i * 2} ry={7 - i * 1.5} fill="#fff1cf" />
            </g>
          ))}
          {['Sa', 'Sb', 'Sc'].map((t, i) => <Label key={t} x={250 + i * 78} y={110} anchor="middle" size="s" color={C.dim}>{t}</Label>)}
          <Label x={328} y={30} anchor="middle" weight={700} color={sel === 'S' ? C.amber : C.text}>Spiral</Label>
        </g>
        {/* barred spirals */}
        <g {...hit('SB')}>
          {shapes.bars.map((arms, i) => (
            <g key={i}>
              <line x1={250 + i * 78 - 11} x2={250 + i * 78 + 11} y1={214} y2={214} stroke="#fff1cf" strokeWidth={4} strokeLinecap="round" />
              {arms.map((d, j) => <path key={j} d={d} fill="none" stroke="#b9c8ff" strokeWidth={3} strokeLinecap="round" opacity={0.8} />)}
              <circle cx={250 + i * 78} cy={214} r={5 - i} fill="#fff1cf" />
            </g>
          ))}
          {['SBa', 'SBb', 'SBc'].map((t, i) => <Label key={t} x={250 + i * 78} y={254} anchor="middle" size="s" color={C.dim}>{t}</Label>)}
          <Label x={328} y={282} anchor="middle" weight={700} color={sel === 'SB' ? C.amber : C.text}>Barred spiral</Label>
        </g>
        {/* irregular */}
        <g {...hit('Irr')}>
          {[[448, 140, 9], [462, 132, 6], [440, 152, 5], [456, 150, 7], [470, 146, 4], [446, 128, 4]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#c9d6ff" opacity={0.75} />)}
          <Label x={456} y={182} anchor="middle" weight={700} color={sel === 'Irr' ? C.amber : C.text}>Irregular</Label>
        </g>
        <Label x={250} y={160} size="s" color={C.dim}>arms looser, bulge smaller →</Label>

        {/* photo */}
        <rect x={500} y={40} width={204} height={204} rx={8} fill="#000" />
        <image href={imgUrl(cur.photo.file)} x={500} y={40} width={204} height={204} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}ph)`} />
        <rect x={500} y={40} width={204} height={204} rx={8} fill="none" stroke={C.lineStrong} />
        <Label x={602} y={28} anchor="middle" size="s" color={C.dim}>a real example (photograph)</Label>
        <Label x={602} y={264} anchor="middle" weight={700}>{cur.photo.label}</Label>
      </Svg>
      <Controls>
        <ChoiceControl label="Galaxy type" value={sel} options={(Object.keys(TYPES) as T[]).map((t) => ({ value: t, label: TYPES[t].name }))} onChange={setSel} />
      </Controls>
      <Readout>
        <strong>{cur.name}</strong> ({cur.ex}). {cur.text} The fork sorts galaxies by how they look; it is not a sequence that galaxies grow through.
      </Readout>
      <p className="fig-credit">
        Photo: {cur.photo.label}, {cur.photo.credit}, {cur.photo.license},{' '}
        <a href={cur.photo.sourceUrl} target="_blank" rel="noreferrer">source</a>. Shapes on the fork are schematic drawings.
      </p>
    </div>
  );
}
