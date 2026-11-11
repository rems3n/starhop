/**
 * From ZHR to what you will actually count. Standard visual-observer formula:
 * hourly rate = ZHR × sin(radiant altitude) ÷ r^(6.5 − limiting magnitude), where r is the shower's population
 * index (how much more numerous each fainter magnitude is). ZHR and r: Perseids 100 and 2.2, Geminids 150 and
 * 2.6 (IMO working list). Limiting magnitude per Bortle class: the app's BORTLE table (src/types.ts).
 * Starts from the learner's own sky class in settings. Ignores moonlight, clouds and the field of view.
 */
import { useState } from 'react';
import { useSettings } from '@/store/settings';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, rad, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'How many meteors will you see?',
  summary: 'Pick a shower, the radiant’s height and how dark your sky is: the published ZHR shrinks to what one observer would really count in an hour.',
  params: { shower: '"per" | "gem" (default "per")', alt: 'radiant altitude 0–90 (default 55)' },
};

const SHOWERS = {
  per: { name: 'Perseids', zhr: 100, r: 2.2 },
  gem: { name: 'Geminids', zhr: 150, r: 2.6 },
} as const;
/** Limiting magnitude for Bortle 1–9, same values as BORTLE in src/types.ts */
const LM = [7.6, 7.3, 6.8, 6.3, 5.8, 5.3, 4.8, 4.3, 3.8];
const SKY = ['an excellent dark site', 'a truly dark site', 'a rural site', 'a rural/suburban site', 'the suburbs', 'bright suburbs', 'the suburban/urban edge', 'a city', 'an inner city'];

export default function MeteorRateEstimate({ params }: DiagramProps) {
  const myBortle = useSettings((s) => s.bortle);
  const [sh, setSh] = useState<keyof typeof SHOWERS>(params?.shower === 'gem' ? 'gem' : 'per');
  const [alt, setAlt] = useState(typeof params?.alt === 'number' ? (params.alt as number) : 55);
  const [b, setB] = useState(Math.min(9, Math.max(1, Math.round(myBortle || 8))));
  const S = SHOWERS[sh];
  const lm = LM[b - 1];
  const altF = Math.max(0, Math.sin(rad(alt)));
  const skyF = 1 / Math.pow(S.r, 6.5 - lm);
  const hr = S.zhr * altF * skyF;
  const n = Math.round(hr);
  const X0 = 40, X1 = 690;
  const bar = (v: number) => (Math.min(v, 200) / 200) * (X1 - X0);

  return (
    <div>
      <Svg w={720} h={300} title={meta.title} desc={`${S.name}: ZHR ${S.zhr}. With the radiant ${alt} degrees up from ${SKY[b - 1]} (limiting magnitude ${lm}), one observer would count about ${n} meteors an hour.`}>
        <Label x={X0} y={34} size="s" color={C.dim}>
          {`Published ZHR: radiant overhead, sky down to magnitude 6.5`}
        </Label>
        <rect x={X0} y={44} width={bar(S.zhr)} height={22} rx={4} fill={C.dim} opacity={0.5} />
        <Label x={X0 + bar(S.zhr) + 8} y={60} weight={700}>
          {`${S.zhr} an hour`}
        </Label>
        <Label x={X0} y={98} size="s" color={C.dim}>
          {`× ${altF.toFixed(2)} for the radiant ${alt}° up`}
        </Label>
        <rect x={X0} y={108} width={bar(S.zhr * altF)} height={14} rx={4} fill={C.blue} opacity={0.6} />
        <Label x={X0} y={146} size="s" color={C.dim}>
          {`× ${skyF < 1 ? skyF.toFixed(2) : skyF.toFixed(1)} for your sky (stars to magnitude ${lm}: ${SKY[b - 1]})`}
        </Label>
        <rect x={X0} y={156} width={bar(hr)} height={22} rx={4} fill={C.amber} />
        <Label x={X0 + bar(hr) + 8} y={172} weight={700} color={C.amber}>
          {`about ${n} an hour`}
        </Label>
        {/* One streak per meteor you'd count in an hour (up to 120) */}
        {Array.from({ length: Math.min(n, 120) }, (_, i) => {
          const x = X0 + (i % 40) * 16.2, y = 206 + Math.floor(i / 40) * 24;
          return <line key={i} x1={x} y1={y + 12} x2={x + 10} y2={y} stroke={C.star} strokeWidth={2} strokeLinecap="round" />;
        })}
        {n === 0 && (
          <Label x={X0} y={226} size="s" color={C.dim}>
            hardly any
          </Label>
        )}
        <Label x={706} y={290} anchor="end" size="s" color={C.faint}>
          rate = ZHR × sin(radiant height) ÷ r^(6.5 − limiting magnitude) · ignores moonlight
        </Label>
      </Svg>
      <Controls>
        <ChoiceControl
          label="Shower"
          value={sh}
          options={[
            { value: 'per', label: 'Perseids' },
            { value: 'gem', label: 'Geminids' },
          ]}
          onChange={setSh}
        />
        <RangeControl label="Radiant height" value={alt} min={0} max={90} onChange={setAlt} format={(v) => `${v}°`} />
        <RangeControl label="Sky darkness (Bortle class)" value={10 - b} min={1} max={9} onChange={(v) => setB(10 - v)} format={() => `Bortle ${b}`} />
      </Controls>
      <Readout>
        {`${S.name} from ${SKY[b - 1]} with the radiant ${alt}° up: about ${n} meteors an hour, ${n < 0.5 * S.zhr ? `far below the published ${S.zhr}` : n < 0.9 * S.zhr ? `below the published ${S.zhr}` : `close to the published ${S.zhr}`}. `}
        {b >= 8 ? 'City light hides the faint majority; only the bright ones get through.' : b <= 3 ? 'A truly dark sky shows the faint ones too.' : ''}
        {b === Math.round(myBortle) ? ' (This is the sky class saved in your settings.)' : ''}
      </Readout>
    </div>
  );
}
