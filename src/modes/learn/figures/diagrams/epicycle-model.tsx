/**
 * Two explanations of Mars's loops, running side by side on the same clock. Left: an Earth-centred model in the
 * style of Ptolemy: Mars rides a small circle (epicycle) whose centre goes round Earth on a big circle (deferent).
 * Right: the Sun-centred model of Copernicus: Earth (1 year) and Mars (1.88 years) both circle the Sun.
 * With circular orbits these give exactly the same direction from Earth to Mars, so the left-hand path is
 * also the shape of Mars's real path relative to Earth.
 */
import { useMemo, useState } from 'react';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, polar, useAnimatedValue, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Circles on circles, or a moving Earth',
  summary: 'Ptolemy-style epicycle model beside the Sun-centred model, on one clock: both trace the same loops as seen from Earth.',
};

const A_M = 1.524, P_M = 1.881; // Mars orbit radius (AU) and period (years)
const K = 54;
const L = { x: 180, y: 178 }, R = { x: 540, y: 178 };
const YEARS = 4.3;

function geo(t: number) {
  const em = 2 * Math.PI * t, mm = (2 * Math.PI * t) / P_M;
  return { ex: Math.cos(em), ey: Math.sin(em), mx: A_M * Math.cos(mm), my: A_M * Math.sin(mm) };
}

export default function EpicycleModel(_: DiagramProps) {
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useAnimatedValue(1.6, playing, 0.35, [0, YEARS]);
  const loop = useMemo(() => {
    const pts: string[] = [];
    for (let s = 0; s <= YEARS; s += 0.01) {
      const g = geo(s);
      pts.push(`${(L.x + (g.mx - g.ex) * K).toFixed(1)},${(L.y - (g.my - g.ey) * K).toFixed(1)}`);
    }
    return pts.join(' ');
  }, []);
  const g = geo(t);
  // Left: deferent centre at Earth; epicycle centre at the Mars-orbit position; Mars = centre minus Earth's heliocentric vector
  const dc = [L.x + g.mx * K, L.y - g.my * K];
  const mL = [L.x + (g.mx - g.ex) * K, L.y - (g.my - g.ey) * K];
  // Right
  const eR = [R.x + g.ex * K, R.y - g.ey * K], mR = [R.x + g.mx * K, R.y - g.my * K];
  const dir = (Math.atan2(g.my - g.ey, g.mx - g.ex) * 180) / Math.PI;
  const arrowL = polar(L.x, L.y, 150, dir);
  const arrowR = [eR[0] + (mR[0] - eR[0]) * 3, eR[1] + (mR[1] - eR[1]) * 3];
  const g2 = geo(t + 0.02);
  const dir2 = (Math.atan2(g2.my - g2.ey, g2.mx - g2.ex) * 180) / Math.PI;
  const retro = ((dir2 - dir + 540) % 360) - 180 < 0;

  return (
    <div>
      <Svg w={720} h={360} title={meta.title} desc="Left: Earth at the centre, Mars on a small circle riding a big circle, tracing a looping path. Right: the Sun at the centre with Earth and Mars on circular orbits. An arrow from Earth to Mars points the same way in both.">
        <defs>
          <clipPath id="epi-l">
            <rect x={10} y={30} width={340} height={300} />
          </clipPath>
        </defs>
        <Label x={L.x} y={24} anchor="middle" weight={600}>
          Earth-centred: circles on circles
        </Label>
        <Label x={R.x} y={24} anchor="middle" weight={600}>
          Sun-centred: Earth moves too
        </Label>
        <line x1={360} y1={14} x2={360} y2={346} stroke={C.line} />
        <g clipPath="url(#epi-l)">
          <polyline points={loop} fill="none" stroke={C.red} strokeOpacity={0.35} />
          <circle cx={L.x} cy={L.y} r={A_M * K} fill="none" stroke={C.lineStrong} strokeDasharray="3 4" />
          <circle cx={dc[0]} cy={dc[1]} r={K} fill="none" stroke={C.amber} strokeOpacity={0.8} />
          <line x1={dc[0]} y1={dc[1]} x2={mL[0]} y2={mL[1]} stroke={C.amber} strokeOpacity={0.8} />
          <circle cx={dc[0]} cy={dc[1]} r={2.5} fill={C.amber} />
          <line x1={L.x} y1={L.y} x2={arrowL[0]} y2={arrowL[1]} stroke={C.text} strokeDasharray="5 4" markerEnd="url(#fig-arrow)" />
          <circle cx={mL[0]} cy={mL[1]} r={6} fill={C.red} />
        </g>
        <circle cx={L.x} cy={L.y} r={7} fill={C.earth} />
        <Label x={L.x} y={L.y + 22} anchor="middle" size="s" weight={600}>
          Earth
        </Label>
        <Label x={20} y={326} size="s" color={C.amber}>
          epicycle (small circle)
        </Label>
        <Label x={20} y={342} size="s" color={C.dim}>
          deferent (big circle, dashed)
        </Label>
        {/* Right */}
        <circle cx={R.x} cy={R.y} r={K} fill="none" stroke={C.earth} strokeOpacity={0.5} strokeDasharray="3 4" />
        <circle cx={R.x} cy={R.y} r={A_M * K} fill="none" stroke={C.red} strokeOpacity={0.5} strokeDasharray="3 4" />
        <circle cx={R.x} cy={R.y} r={20} fill="url(#fig-glow)" />
        <circle cx={R.x} cy={R.y} r={8} fill={C.sun} />
        <line x1={eR[0]} y1={eR[1]} x2={arrowR[0]} y2={arrowR[1]} stroke={C.text} strokeDasharray="5 4" markerEnd="url(#fig-arrow)" />
        <circle cx={eR[0]} cy={eR[1]} r={6} fill={C.earth} />
        <circle cx={mR[0]} cy={mR[1]} r={6} fill={C.red} />
        <Label x={eR[0] + 9} y={eR[1] + 16} size="s" weight={600}>
          Earth
        </Label>
        <Label x={mR[0] + 9} y={mR[1] - 8} size="s" weight={600}>
          Mars
        </Label>
        <Label x={706} y={342} anchor="end" size="s" color={C.faint}>
          circular orbits · arrows: direction from Earth to Mars
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Years" value={Math.round(t * 20) / 20} min={0} max={YEARS} step={0.05} onChange={(x) => { setPlaying(false); setT(x); }} format={(x) => x.toFixed(1)} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} />
      </Controls>
      <Readout>
        {retro
          ? 'Retrograde now: on the left, Mars is on the inner side of its small circle and swings backward; on the right, Earth is overtaking Mars. The two arrows point the same way.'
          : 'Moving forward now: both models aim the arrow at the same spot. The Sun-centred one needs no small circle: the loop comes from riding on a moving Earth.'}
      </Readout>
    </div>
  );
}
