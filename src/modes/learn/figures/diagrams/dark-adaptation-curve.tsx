/**
 * Dark-adaptation curve: how much more sensitive your eyes become the longer you stay in the dark.
 * Cones adapt within ~7 minutes; rods take over at the "rod–cone break" and keep improving for ~30–40 minutes.
 * The learner drags the time slider or presses "Wait in the dark"; "Glance at a phone" knocks the clock back.
 * Curve shapes follow the classic Hecht et al. (1937) form; the y-axis is a rough overall gain (log scale).
 */
import { useEffect, useState } from 'react';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'How your eyes adapt to the dark',
  summary: 'Sensitivity vs minutes in the dark for cones and rods; slide or play time, and see a bright light reset it.',
  params: { start: 'starting minutes, 0–40 (default 0)' },
};

const T = 40;
/** log10 of the gain over light-adapted vision */
const cone = (t: number) => 2.0 * (1 - Math.exp(-t / 2));
const rod = (t: number) => Math.max(0, 4.2 * (1 - Math.exp(-(t - 3) / 8)));
const gain = (t: number) => Math.max(cone(t), rod(t));

const X0 = 80, X1 = 680, Y0 = 300, Y1 = 50; // plot box
const x = (t: number) => X0 + (t / T) * (X1 - X0);
const y = (lg: number) => Y0 - (lg / 4.5) * (Y0 - Y1);

function path(f: (t: number) => number, from = 0, to = T) {
  const pts: string[] = [];
  for (let t = from; t <= to + 1e-9; t += 0.25) pts.push(`${x(t).toFixed(1)},${y(f(t)).toFixed(1)}`);
  return `M ${pts.join(' L ')}`;
}

export default function DarkAdaptationCurve({ params }: DiagramProps) {
  const [t, setT] = useState(typeof params?.start === 'number' ? (params.start as number) : 0);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();

  // "Wait in the dark": 40 simulated minutes in ~12 seconds (or in jumps under reduced motion).
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((v) => {
      const n = Math.min(T, v + (reduced ? 2 : 0.25));
      if (n >= T) setPlaying(false);
      return n;
    }), reduced ? 400 : 75);
    return () => clearInterval(id);
  }, [playing, reduced]);

  const g = gain(t);
  const raw = Math.pow(10, g);
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 1));
  const times = Math.round(raw / mag) * mag; // two significant figures: this is a rough curve
  const usingRods = rod(t) > cone(t);
  const crossing = 8.6;

  return (
    <div>
      <Svg w={720} h={360} title={meta.title} desc="A graph with minutes in the dark across the bottom and how many times more sensitive your eyes are up the side. The cone curve rises quickly and levels off after about 7 minutes; the rod curve takes over around 9 minutes and keeps rising until about 30 to 40 minutes.">
        {/* Grid and axes */}
        {[0, 1, 2, 3, 4].map((lg) => (
          <g key={lg}>
            <line x1={X0} x2={X1} y1={y(lg)} y2={y(lg)} stroke={C.line} />
            <Label x={X0 - 8} y={y(lg) + 4} anchor="end" size="s" color={C.dim}>
              {['1×', '10×', '100×', '1,000×', '10,000×'][lg]}
            </Label>
          </g>
        ))}
        {[0, 5, 10, 15, 20, 25, 30, 35, 40].map((m) => (
          <Label key={m} x={x(m)} y={Y0 + 18} anchor="middle" size="s" color={C.dim}>
            {m}
          </Label>
        ))}
        <Label x={(X0 + X1) / 2} y={Y0 + 40} anchor="middle" size="s" color={C.dim}>
          minutes in the dark
        </Label>
        <Label x={X0} y={Y1 - 18} size="s" color={C.dim}>
          how much more sensitive than in daylight (roughly)
        </Label>

        {/* Curves */}
        <path d={path(cone)} fill="none" stroke={C.amber} strokeWidth={2.5} strokeDasharray={usingRods ? '6 5' : undefined} opacity={usingRods ? 0.55 : 1} />
        <path d={path(rod, 3)} fill="none" stroke={C.blue} strokeWidth={2.5} strokeDasharray={usingRods ? undefined : '6 5'} opacity={usingRods ? 1 : 0.55} />
        <Label x={x(2.2)} y={y(cone(2.2)) - 10} color={C.amber} weight={600}>
          Cones
        </Label>
        <Label x={x(26)} y={y(rod(26)) - 12} color={C.blue} weight={600}>
          Rods
        </Label>
        {/* Rod–cone break */}
        <line x1={x(crossing)} x2={x(crossing)} y1={y(gain(crossing)) + 6} y2={Y0} stroke={C.line} strokeDasharray="3 4" />
        <Label x={x(crossing) + 6} y={y(0.6)} size="s" color={C.dim}>
          rods take over
        </Label>
        <Label x={x(crossing) + 6} y={y(0.6) + 15} size="s" color={C.dim}>
          (about 8–10 min)
        </Label>

        {/* Your eyes now */}
        <line x1={x(t)} x2={x(t)} y1={Y1} y2={Y0} stroke={C.text} strokeOpacity={0.35} />
        <circle cx={x(t)} cy={y(g)} r={7} fill={usingRods ? C.blue : C.amber} stroke={C.bg} strokeWidth={2} />
      </Svg>
      <Controls>
        <RangeControl label="Time in the dark" value={t} min={0} max={T} step={0.5} onChange={(v) => { setPlaying(false); setT(v); }} format={(v) => `${Math.round(v)} min`} />
        <PlayButton playing={playing} onToggle={() => { if (t >= T) setT(0); setPlaying((p) => !p); }} label="Wait in the dark" />
        <button type="button" className="btn btn--sm" onClick={() => { setPlaying(false); setT(0); }}>
          Glance at a bright phone
        </button>
      </Controls>
      <Readout>
        {t < 0.5
          ? 'You have just stepped out of a lit room: your eyes are tuned for daylight.'
          : `After ${Math.round(t)} minutes your eyes are roughly ${times.toLocaleString('en-US')} times more sensitive than in daylight, mostly thanks to your ${usingRods ? 'rods' : 'cones'}.` +
            (t >= 30 ? ' This is about as good as it gets. One look at a bright screen sends you back to the start.' : usingRods ? ' Keep waiting: the rods are still improving.' : ' The cones are nearly done; the slower rods have not caught up yet.')}
      </Readout>
    </div>
  );
}
