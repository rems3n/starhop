/**
 * Why Mercury and Venus stay near the Sun. Top view with Earth held still at the bottom (the picture turns with
 * Earth): the inner planet goes round its orbit; the angle at Earth between the Sun and the planet is its
 * elongation, which can never exceed the angle of the tangent line (sin⁻¹ a: 46° Venus, 23° Mercury for circular
 * orbits). An inset shows the planet through a telescope: its phase and apparent size from the same geometry.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, PlayButton, RangeControl, Readout, Svg, polar, rad, useAnimatedValue, type DiagramMeta, type DiagramProps } from '../kit';
import { litPath } from './ecliptic-common';

export const meta: DiagramMeta = {
  title: 'Evening star, morning star',
  summary: 'Top view of Earth, the Sun and Venus or Mercury: slide the planet round its orbit to see its angle from the Sun, whether it is an evening or morning star, and its phase in a telescope.',
  params: { planet: '"venus" | "mercury" (default "venus")', pos: 'starting angle round the orbit from inferior conjunction, 0–359 (default 300)' },
};

const PL = {
  venus: { name: 'Venus', a: 0.7233, diam: 12104, color: '#f1e3b8' },
  mercury: { name: 'Mercury', a: 0.3871, diam: 4879, color: '#b9b2a6' },
} as const;
const SX = 236, SY = 166, RE = 150;

export default function InnerPlanetElongation({ params }: DiagramProps) {
  const [pk, setPk] = useState<keyof typeof PL>(params?.planet === 'mercury' ? 'mercury' : 'venus');
  const [playing, setPlaying] = useState(false);
  const [p, setP] = useAnimatedValue(typeof params?.pos === 'number' ? (params.pos as number) : 300, playing, 30, [0, 360]);
  const P = PL[pk];
  const rp = RE * P.a;
  const E: [number, number] = [SX, SY + RE];
  const Q = polar(SX, SY, rp, -90 + p);
  // Vectors in AU (page coordinates, y down)
  const toSun = [(SX - E[0]) / RE, (SY - E[1]) / RE];
  const toPl = [(Q[0] - E[0]) / RE, (Q[1] - E[1]) / RE];
  const dist = Math.hypot(toPl[0], toPl[1]);
  const cosEl = (toSun[0] * toPl[0] + toSun[1] * toPl[1]) / dist;
  const elong = (Math.acos(Math.max(-1, Math.min(1, cosEl))) * 180) / Math.PI;
  const east = Q[0] < SX - 0.01; // left of the Sun–Earth line = east of the Sun
  const maxEl = (Math.asin(P.a) * 180) / Math.PI;
  // Phase: angle at the planet between the Sun and Earth
  const pSun = [SX - Q[0], SY - Q[1]], pEarth = [E[0] - Q[0], E[1] - Q[1]];
  const cosPh = (pSun[0] * pEarth[0] + pSun[1] * pEarth[1]) / (Math.hypot(...pSun) * Math.hypot(...pEarth));
  const litFrac = (1 + cosPh) / 2;
  const discR = Math.min(54, (13 * (P.diam / 12104)) / dist + 2);
  const glare = elong < 10;
  const tA = Math.acos(P.a) * (180 / Math.PI); // orbit angle of greatest elongation
  const tW = polar(SX, SY, rp, -90 + tA), tE = polar(SX, SY, rp, -90 - tA);

  const stage = p < 8 || p > 352 ? 'inferior' : Math.abs(p - 180) < 12 ? 'superior' : null;
  return (
    <div>
      <Svg w={720} h={360} title={meta.title} desc={`${P.name} is ${elong.toFixed(0)} degrees ${east ? 'east' : 'west'} of the Sun as seen from Earth, so it is ${glare ? 'lost in the Sun’s glare' : east ? 'an evening star' : 'a morning star'}. Its greatest possible angle from the Sun is about ${maxEl.toFixed(0)} degrees.`}>
        {/* Orbits */}
        <circle cx={SX} cy={SY} r={RE} fill="none" stroke={C.line} strokeDasharray="3 4" />
        <circle cx={SX} cy={SY} r={rp} fill="none" stroke={C.lineStrong} strokeDasharray="3 4" />
        {/* Tangent lines = greatest elongation */}
        <line x1={E[0]} y1={E[1]} x2={tW[0] + (tW[0] - E[0]) * 0.25} y2={tW[1] + (tW[1] - E[1]) * 0.25} stroke={C.good} strokeDasharray="5 4" opacity={0.7} />
        <line x1={E[0]} y1={E[1]} x2={tE[0] + (tE[0] - E[0]) * 0.25} y2={tE[1] + (tE[1] - E[1]) * 0.25} stroke={C.good} strokeDasharray="5 4" opacity={0.7} />
        <Label x={Math.max(16, tE[0] - 60)} y={tE[1] - 40} size="s" color={C.good}>
          greatest eastern
        </Label>
        <Label x={Math.max(16, tE[0] - 60)} y={tE[1] - 26} size="s" color={C.good}>
          elongation
        </Label>
        <Label x={tW[0] + 4} y={tW[1] - 40} size="s" color={C.good}>
          greatest western
        </Label>
        <Label x={tW[0] + 4} y={tW[1] - 26} size="s" color={C.good}>
          elongation
        </Label>
        {/* Sight lines */}
        <line x1={E[0]} y1={E[1]} x2={SX} y2={SY} stroke={C.amber} strokeWidth={1.4} />
        <line x1={E[0]} y1={E[1]} x2={Q[0]} y2={Q[1]} stroke={C.text} strokeWidth={1.4} />
        <path d={`M ${E[0] + 34 * toSun[0]} ${E[1] + 34 * toSun[1]} A 34 34 0 0 ${east ? 0 : 1} ${E[0] + (34 * toPl[0]) / dist} ${E[1] + (34 * toPl[1]) / dist}`} fill="none" stroke={C.text} />
        <Label x={E[0] + (east ? -44 : 44)} y={E[1] - 40} anchor={east ? 'end' : 'start'} weight={700}>
          {`${elong.toFixed(0)}°`}
        </Label>
        {/* Sun, planet, Earth */}
        <circle cx={SX} cy={SY} r={24} fill="url(#fig-glow)" />
        <circle cx={SX} cy={SY} r={10} fill={C.sun} />
        <circle cx={Q[0]} cy={Q[1]} r={7} fill="#1a2148" />
        <path d={litPath(Q[0], Q[1], 7, (SX - Q[0]) / Math.hypot(SX - Q[0], SY - Q[1]), (SY - Q[1]) / Math.hypot(SX - Q[0], SY - Q[1]), 0)} fill={P.color} />
        <Label x={Q[0] + (Q[0] >= SX ? 12 : -12)} y={Q[1] + 5} anchor={Q[0] >= SX ? 'start' : 'end'} weight={600}>
          {P.name}
        </Label>
        <circle cx={E[0]} cy={E[1]} r={7} fill={C.earth} />
        <Label x={E[0] + 12} y={E[1] + 18} weight={600}>
          Earth
        </Label>
        <Label x={E[0] - 90} y={E[1] + 4} anchor="end" size="s" color={C.dim}>
          ← east
        </Label>
        <Label x={E[0] + 90} y={E[1] + 4} size="s" color={C.dim}>
          west →
        </Label>
        {/* Inset: through a telescope */}
        <rect x={470} y={40} width={236} height={236} rx={10} fill={C.panel} stroke={C.line} />
        <Label x={588} y={30} anchor="middle" size="s" color={C.dim}>
          {`${P.name} through a small telescope`}
        </Label>
        <circle cx={588} cy={158} r={discR} fill="#20284f" />
        {!stage && <path d={litPath(588, 158, discR, east ? 1 : -1, 0, cosPh)} fill={P.color} />}
        <Label x={588} y={264} anchor="middle" size="s" color={C.dim}>
          {stage === 'inferior' ? 'dark side toward us, lost in the glare' : stage === 'superior' ? 'fully lit but behind the Sun' : `${Math.round(litFrac * 100)}% lit · Sun to the ${east ? 'right' : 'left'}`}
        </Label>
        <Label x={706} y={346} anchor="end" size="s" color={C.faint}>
          top view · circular orbits · Earth held still
        </Label>
      </Svg>
      <Controls>
        <ChoiceControl
          label="Planet"
          value={pk}
          options={[
            { value: 'venus', label: 'Venus' },
            { value: 'mercury', label: 'Mercury' },
          ]}
          onChange={setPk}
        />
        <RangeControl label="Position in its orbit" value={Math.round(p)} min={0} max={359} onChange={(v) => { setPlaying(false); setP(v); }} format={(v) => `${v}°`} />
        <PlayButton playing={playing} onToggle={() => setPlaying((x) => !x)} />
      </Controls>
      <Readout>
        {stage === 'inferior'
          ? `${P.name} is passing between Earth and the Sun (inferior conjunction): it is closest to us but shows its dark side and is lost in the Sun's glare.`
          : stage === 'superior'
            ? `${P.name} is on the far side of the Sun (superior conjunction): hidden in the glare for weeks.`
            : glare
              ? `${P.name} is only ${elong.toFixed(0)}° from the Sun: too close to see in the glare.`
              : `${P.name} is ${elong.toFixed(0)}° ${east ? 'east' : 'west'} of the Sun: ${east ? 'an evening star in the west after sunset, setting' : 'a morning star in the east before sunrise, rising'} up to about ${Math.round(elong / 15 * 10) / 10} hours ${east ? 'after' : 'before'} the Sun. It can never get more than about ${maxEl.toFixed(0)}° from the Sun${pk === 'mercury' ? ' (18°–28° in reality, because its orbit is quite oval)' : ''}.`}
      </Readout>
    </div>
  );
}
