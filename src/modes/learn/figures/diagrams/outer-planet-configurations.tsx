/**
 * Opposition and conjunction of an outer planet. Top view: Earth (inner, faster) and Mars, Jupiter or Saturn
 * start lined up at opposition; a slider runs time through one full cycle (synodic period). The angle between
 * the planet and the Sun as seen from Earth sets when the planet is up: a clock bar shows its hours above the
 * horizon (rough rule for an object on the ecliptic: it crosses the meridian 1 hour later per 15° east of the Sun).
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, PlayButton, RangeControl, Readout, Svg, polar, useAnimatedValue, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Opposition and conjunction',
  summary: 'Earth laps an outer planet: slide through one cycle from opposition to conjunction and back, and see when the planet is in the night sky.',
  params: { planet: '"mars" | "jupiter" | "saturn" (default "mars")' },
};

// Orbital periods (days) and mean distances (AU) from the NASA planetary fact sheet.
const PL = {
  mars: { name: 'Mars', P: 687.0, a: 1.524, r: 107, color: C.red, toScale: true },
  jupiter: { name: 'Jupiter', P: 4331, a: 5.203, r: 158, color: '#e3c89a', toScale: false },
  saturn: { name: 'Saturn', P: 10747, a: 9.537, r: 170, color: '#e8d590', toScale: false },
} as const;
const SX = 210, SY = 186, RE = 70, YEAR = 365.24;
const n180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const clock = (h: number) => {
  const x = ((h % 24) + 24) % 24;
  const hh = Math.round(x) % 24;
  return hh === 0 ? 'midnight' : hh === 12 ? 'noon' : `${hh % 12} ${hh < 12 ? 'am' : 'pm'}`;
};

export default function OuterPlanetConfigurations({ params }: DiagramProps) {
  const init = (typeof params?.planet === 'string' && params.planet in PL ? params.planet : 'mars') as keyof typeof PL;
  const [pk, setPk] = useState<keyof typeof PL>(init);
  const P = PL[pk];
  const syn = 1 / (1 / YEAR - 1 / P.P);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useAnimatedValue(0, playing, syn / 12, [0, syn]);
  const aE = (360 * t) / YEAR, aP = (360 * t) / P.P;
  const E = polar(SX, SY, RE, aE), Q = polar(SX, SY, P.r, aP);
  // Directions seen from Earth, in true AU geometry (not the compressed drawing)
  const ex = Math.cos((aE * Math.PI) / 180), ey = Math.sin((aE * Math.PI) / 180);
  const qx = P.a * Math.cos((aP * Math.PI) / 180), qy = P.a * Math.sin((aP * Math.PI) / 180);
  const sunAng = (Math.atan2(-ey, -ex) * 180) / Math.PI;
  const plAng = (Math.atan2(qy - ey, qx - ex) * 180) / Math.PI;
  const d = n180(plAng - sunAng); // + = east of the Sun
  const dist = Math.hypot(qx - ex, qy - ey);
  const transit = 12 + d / 15;
  const state = Math.abs(d) > 168 ? 'opposition' : Math.abs(d) < 14 ? 'conjunction' : d > 0 ? 'evening' : 'morning';

  // Clock bar: noon → noon
  const BX = 452, BW = 254, BY = 250;
  const hx = (h: number) => BX + ((((h - 12) % 24) + 24) % 24) / 24 * BW;
  const upFrom = transit - 6, upTo = transit + 6;
  const segs: [number, number][] = [];
  {
    const a = (((upFrom - 12) % 24) + 24) % 24;
    const b = a + 12;
    if (b <= 24) segs.push([a, b]);
    else segs.push([a, 24], [0, b - 24]);
  }
  void upTo;
  const months = Math.round(t / 30.44);
  return (
    <div>
      <Svg w={720} h={360} title={meta.title} desc={`${P.name} ${Math.round(t)} days after opposition: ${Math.abs(Math.round(d))} degrees ${d >= 0 ? 'east' : 'west'} of the Sun as seen from Earth.`}>
        <circle cx={SX} cy={SY} r={RE} fill="none" stroke={C.line} strokeDasharray="3 4" />
        <circle cx={SX} cy={SY} r={P.r} fill="none" stroke={C.lineStrong} strokeDasharray="3 4" />
        <line x1={E[0]} y1={E[1]} x2={SX} y2={SY} stroke={C.amber} strokeWidth={1.4} />
        <line x1={E[0]} y1={E[1]} x2={Q[0]} y2={Q[1]} stroke={C.text} strokeWidth={1.4} strokeDasharray={state === 'conjunction' ? '4 4' : undefined} />
        <circle cx={SX} cy={SY} r={26} fill="url(#fig-glow)" />
        <circle cx={SX} cy={SY} r={11} fill={C.sun} />
        <circle cx={Q[0]} cy={Q[1]} r={7} fill={P.color} />
        <Label x={Q[0] + 11} y={Q[1] - 8} weight={600}>
          {P.name}
        </Label>
        <circle cx={E[0]} cy={E[1]} r={6} fill={C.earth} />
        <Label x={E[0] + 9} y={E[1] + 18} weight={600}>
          Earth
        </Label>
        <Label x={14} y={24} size="s" color={C.dim}>
          {`Top view: both go counterclockwise; Earth laps ${P.name} every ${(syn / 30.44).toFixed(1)} months`}
        </Label>
        <Label x={14} y={346} size="s" color={C.faint}>
          {P.toScale ? 'circular orbits, distances to scale' : `circular orbits · ${P.name}'s orbit drawn much closer than it is`}
        </Label>
        {/* Right panel */}
        <Label x={BX} y={70} weight={700} color={state === 'opposition' ? C.amber : C.text}>
          {state === 'opposition' ? 'Opposition' : state === 'conjunction' ? 'Conjunction' : state === 'evening' ? 'Evening sky' : 'Morning sky'}
        </Label>
        <Label x={BX} y={92} size="s" color={C.dim}>
          {`${state === 'opposition' ? 'opposite the Sun' : state === 'conjunction' ? 'beside the Sun' : `${Math.abs(Math.round(d))}° ${d >= 0 ? 'east' : 'west'} of the Sun`} · ${(dist * 149.6).toFixed(0)} million km from Earth`}
        </Label>
        {/* Brightness hint: disc size ∝ 1/distance */}
        <circle cx={BX + 30} cy={150} r={Math.min(26, (pk === 'mars' ? 9 : pk === 'jupiter' ? 22 : 18) / dist + 2)} fill={P.color} opacity={state === 'conjunction' ? 0.25 : 0.95} />
        <Label x={BX + 66} y={146} size="s" color={C.dim}>
          apparent size
        </Label>
        <Label x={BX + 66} y={162} size="s" color={C.dim}>
          {dist < P.a - 0.6 ? 'near its biggest and brightest' : dist > P.a + 0.6 ? 'near its smallest and faintest' : 'in between'}
        </Label>
        <Label x={BX} y={BY - 12} size="s" color={C.dim}>
          {state === 'conjunction' ? 'up only in daylight: hidden' : 'hours above the horizon (roughly)'}
        </Label>
        <rect x={BX} y={BY} width={BW} height={16} rx={4} fill={C.sun} opacity={0.25} />
        <rect x={hx(18)} y={BY} width={BW / 2} height={16} fill="#0a0f26" />
        {segs.map(([a, b], i) => (
          <rect key={i} x={BX + (a / 24) * BW} y={BY + 4} width={((b - a) / 24) * BW} height={8} rx={3} fill={P.color} opacity={state === 'conjunction' ? 0.3 : 1} />
        ))}
        {[12, 18, 24, 30, 36].map((h, i) => (
          <Label key={h} x={BX + (i * BW) / 4} y={BY + 32} anchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} size="s" color={C.faint}>
            {['noon', '6 pm', 'midnight', '6 am', 'noon'][i]}
          </Label>
        ))}
        <Label x={BX} y={BY + 52} size="s" color={C.faint}>
          dark band: night (about 6 pm to 6 am)
        </Label>
      </Svg>
      <Controls>
        <ChoiceControl
          label="Planet"
          value={pk}
          options={[
            { value: 'mars', label: 'Mars' },
            { value: 'jupiter', label: 'Jupiter' },
            { value: 'saturn', label: 'Saturn' },
          ]}
          onChange={(v) => { setPk(v); setT(0); }}
        />
        <RangeControl label="Time since opposition" value={Math.round(t)} min={0} max={Math.floor(syn)} onChange={(v) => { setPlaying(false); setT(v); }} format={(v) => `${v} days`} />
        <PlayButton playing={playing} onToggle={() => setPlaying((x) => !x)} />
      </Controls>
      <Readout>
        {state === 'opposition'
          ? `Opposition: Earth is passing between the Sun and ${P.name}. It rises around sunset, is highest around midnight and sets around sunrise: up all night, and at its closest and brightest.`
          : state === 'conjunction'
            ? `Conjunction, about ${months} months on: ${P.name} is on the far side of the Sun, up only in daytime and lost in the glare.`
            : `${Math.round(t)} days after opposition ${P.name} is ${Math.abs(Math.round(d))}° ${d >= 0 ? 'east' : 'west'} of the Sun. It is highest around ${clock(transit)} and is ${d >= 0 ? `already up at dusk, setting around ${clock(transit + 6)}` : `rising around ${clock(transit - 6)}, best before dawn`}.`}
      </Readout>
    </div>
  );
}
