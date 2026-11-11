/**
 * Star sizes to scale in three zoom steps (dwarfs → giants → supergiants). Each step keeps one star from the
 * step before so the learner can see the jump in scale. Radii from Wikipedia infoboxes (Nov 2026); colours computed
 * from each star's surface temperature. A scale analogy (Sun = 1 cm marble) runs in the readout.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { fmt, sig, tempColor } from './objects-lib';

export const meta: DiagramMeta = {
  title: 'How big stars are',
  summary: 'Stars drawn to scale in three zoom steps: dwarfs, giants and supergiants, with Earth’s and Mars’s orbits around Betelgeuse.',
  params: { view: '"dwarfs" | "giants" | "supergiants" (default "dwarfs")' },
};

type View = 'dwarfs' | 'giants' | 'supergiants';
/** radius in solar radii, temperature in K */
const S = {
  sun: { name: 'Sun', R: 1, T: 5772 },
  proxima: { name: 'Proxima Cen', R: 0.162, T: 2833 },
  siriusB: { name: 'Sirius B', R: 0.0081, T: 25000 },
  sirius: { name: 'Sirius', R: 1.71, T: 9850 },
  procyon: { name: 'Procyon', R: 2.04, T: 6580 },
  arcturus: { name: 'Arcturus', R: 25.4, T: 4290 },
  aldebaran: { name: 'Aldebaran', R: 45, T: 3900 },
  rigel: { name: 'Rigel', R: 74, T: 12100 },
  antares: { name: 'Antares', R: 680, T: 3660 },
  betelgeuse: { name: 'Betelgeuse', R: 700, T: 3600 },
};
type Key = keyof typeof S;
const AU = 215; // solar radii

const VIEWS: Record<View, { scale: number; stars: { k: Key; x: number }[]; note: string }> = {
  dwarfs: { scale: 58, stars: [{ k: 'siriusB', x: 40 }, { k: 'proxima', x: 82 }, { k: 'sun', x: 170 }, { k: 'sirius', x: 340 }, { k: 'procyon', x: 572 }], note: 'Main-sequence stars and a white dwarf' },
  giants: { scale: 2.5, stars: [{ k: 'sun', x: 90 }, { k: 'arcturus', x: 200 }, { k: 'aldebaran', x: 470 }], note: 'The Sun beside two orange giants' },
  supergiants: { scale: 0.2, stars: [{ k: 'sun', x: 34 }, { k: 'aldebaran', x: 60 }, { k: 'rigel', x: 100 }, { k: 'antares', x: 268 }, { k: 'betelgeuse', x: 560 }], note: 'Red supergiants dwarf everything else' },
};

export default function StarSizes({ params }: DiagramProps) {
  const p = params?.view;
  const [view, setView] = useState<View>(p === 'giants' || p === 'supergiants' ? p : 'dwarfs');
  const v = VIEWS[view];
  const CY = 170;
  const cm = (R: number) => (R < 1 ? `${fmt(sig(R * 10, 2))} mm` : R < 100 ? `${fmt(sig(R, 2))} cm` : `${fmt(sig(R / 100, 2))} m`);

  return (
    <div>
      <Svg w={720} h={350} title={meta.title} desc={`${v.note}, drawn to the same scale. ${v.stars.map((s) => `${S[s.k].name}: ${S[s.k].R} times the Sun's radius`).join('; ')}.`}>
        {v.stars.map(({ k, x }) => {
          const s = S[k];
          const r = Math.max(1.2, s.R * v.scale);
          return (
            <g key={k}>
              {r > 2 && <circle cx={x} cy={CY} r={r * 1.06} fill={tempColor(s.T)} opacity={0.25} />}
              <circle cx={x} cy={CY} r={r} fill={tempColor(s.T)} />
            </g>
          );
        })}
        {view === 'supergiants' && (
          <g>
            {[{ r: 1, n: 'Earth’s orbit' }, { r: 1.52, n: 'Mars’s orbit' }].map((o) => (
              <g key={o.n}>
                <circle cx={560} cy={CY} r={o.r * AU * v.scale} fill="none" stroke={C.text} strokeOpacity={0.6} strokeDasharray="4 4" />
              </g>
            ))}
          </g>
        )}
        {/* labels */}
        {v.stars.map(({ k, x }, i) => {
          const s = S[k];
          const r = Math.max(1.2, s.R * v.scale);
          const small = r < 14;
          const ly = small ? (i % 2 ? CY + 34 : CY - 26) : CY + r + 22;
          return (
            <g key={`l${k}`}>
              {small && <line x1={x} x2={x} y1={i % 2 ? CY + 6 : CY - 6} y2={i % 2 ? CY + 22 : CY - 18} stroke={C.lineStrong} />}
              <Label x={x} y={Math.min(ly, 324)} anchor="middle" size="s" weight={700} color={view === 'supergiants' && small ? C.dim : C.text}>{s.name}</Label>
              {!small && <Label x={x} y={Math.min(ly, 324) + 15} anchor="middle" size="s" color={C.dim}>{s.R >= 10 ? fmt(Math.round(s.R)) : s.R} × Sun</Label>}
            </g>
          );
        })}
        {view === 'supergiants' && (
          <>
            <Label x={560 + AU * v.scale * 0.7 + 4} y={CY - AU * v.scale * 0.7 - 2} size="s">Earth’s orbit</Label>
            <Label x={560 + 1.52 * AU * v.scale * 0.7 + 4} y={CY - 1.52 * AU * v.scale * 0.7 - 2} size="s">Mars’s orbit</Label>
          </>
        )}
        {view === 'dwarfs' && <Label x={40} y={CY + 60} anchor="middle" size="s" color={C.dim}>Earth-sized</Label>}
        <Label x={16} y={26} size="s" color={C.dim}>{v.note} · all drawn to the same scale</Label>
      </Svg>
      <Controls>
        <ChoiceControl
          label="Zoom out"
          value={view}
          options={[
            { value: 'dwarfs', label: 'Dwarfs' },
            { value: 'giants', label: 'Giants' },
            { value: 'supergiants', label: 'Supergiants' },
          ]}
          onChange={setView}
        />
      </Controls>
      <Readout>
        If the Sun were a marble 1 cm across, {v.stars.filter((s) => s.k !== 'sun').map((s) => `${S[s.k].name} would be ${cm(S[s.k].R)}`).join(', ')}.
        {view === 'dwarfs' && ' Sirius B packs about the Sun’s mass into a ball the size of the Earth.'}
        {view === 'giants' && ' Aldebaran has about the same mass as the Sun; it has simply swollen in old age.'}
        {view === 'supergiants' && ' Put Betelgeuse where the Sun is and its surface would reach beyond the orbit of Mars. (Its size is uncertain: estimates run from about 640 to 760 times the Sun’s.)'}
      </Readout>
    </div>
  );
}
