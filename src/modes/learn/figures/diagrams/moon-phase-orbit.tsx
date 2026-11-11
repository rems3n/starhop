/**
 * The Moon's phases. Top view (from above the North Pole, not to scale): sunlight from the left, Earth in the
 * middle with its noon / sunset / midnight / sunrise sides marked, and the Moon round its orbit, always half lit.
 * Inset: the Moon as the learner sees it from their hemisphere, with its rough rise / highest / set times
 * (rule of thumb: each day of age delays the Moon about 50 minutes behind the Sun).
 */
import { useState } from 'react';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, polar, useAnimatedValue, type DiagramMeta, type DiagramProps } from '../kit';
import { MOON_PHASES as NAMES, litPath, phaseName, placeName, useObserver } from './ecliptic-common';

export const meta: DiagramMeta = {
  title: 'Why the Moon has phases',
  summary: 'Top view of the Sun’s light, Earth and the half-lit Moon; slide through the 29.5-day cycle to see the phase from your hemisphere and roughly when it rises and sets.',
  params: { day: 'starting age of the Moon in days, 0–29.5 (default 7.4, first quarter)' },
};

const SYN = 29.53;
const EX = 250, EY = 190, RO = 132;
const clock = (h: number) => {
  const x = ((h % 24) + 24) % 24;
  let hh = Math.floor(x), mm = Math.round(((x - hh) * 60) / 15) * 15;
  if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
  if (hh === 0 && mm === 0) return 'midnight';
  if (hh === 12 && mm === 0) return 'noon';
  return `${hh % 12 || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${hh < 12 ? 'am' : 'pm'}`;
};

export default function MoonPhaseOrbit({ params }: DiagramProps) {
  const o = useObserver();
  const south = o.lat < 0;
  const [playing, setPlaying] = useState(false);
  const [age, setAge] = useAnimatedValue(typeof params?.day === 'number' ? (params.day as number) : 7.4, playing, 2.5, [0, SYN]);
  const e = (age / SYN) * 360; // elongation east of the Sun
  const name = phaseName(e);
  const [mx, my] = polar(EX, EY, RO, 180 + e);
  const k = -Math.cos((e * Math.PI) / 180); // −1 new, +1 full
  const lit = Math.round(((1 + k) / 2) * 100);
  const waxing = e < 180;
  // Sky view: north of the tropics the lit side faces right when waxing (facing south); south of them, left.
  const skySide = (waxing ? 1 : -1) * (south ? -1 : 1);
  const transit = 12 + e / 15;
  const up = e < 12 || e > 348 ? null : { rise: transit - 6, high: transit, set: transit + 6 };

  return (
    <div>
      <Svg w={720} h={392} title={meta.title} desc={`${name}, ${age.toFixed(1)} days after new Moon: the Moon is ${Math.round(e)} degrees from the Sun as seen from Earth and appears ${lit}% lit.`}>
        {/* Sunlight */}
        {[60, 110, 160, 210, 260, 310, 350].map((y) => (
          <line key={y} x1={8} y1={y} x2={56} y2={y} stroke={C.sun} strokeOpacity={0.55} markerEnd="url(#fig-arrow)" />
        ))}
        <Label x={14} y={30} size="s" color={C.amber} weight={600}>
          sunlight
        </Label>
        <circle cx={EX} cy={EY} r={RO} fill="none" stroke={C.line} strokeDasharray="3 4" />
        {/* Ghost Moons: always lit on the Sun side */}
        {NAMES.map((n, i) => {
          const [gx, gy] = polar(EX, EY, RO, 180 + i * 45);
          const [lx, ly] = polar(EX, EY, RO + 34, 180 + i * 45);
          return (
            <g key={n} opacity={0.6}>
              <circle cx={gx} cy={gy} r={10} fill="#232a4d" />
              <path d={litPath(gx, gy, 10, -1, 0, 0)} fill={C.moon} />
              <Label x={lx} y={ly + 4} anchor={i === 0 ? 'end' : i === 4 ? 'start' : 'middle'} size="s" color={C.dim}>
                {n.replace('Waxing ', 'waxing ').replace('Waning ', 'waning ')}
              </Label>
            </g>
          );
        })}
        {/* Earth: day side left; times of day round the edge */}
        <circle cx={EX} cy={EY} r={26} fill="#16204a" />
        <path d={litPath(EX, EY, 26, -1, 0, 0)} fill={C.earth} />
        <Label x={EX - 32} y={EY + 4} anchor="end" size="s" color={C.text}>
          noon
        </Label>
        <Label x={EX + 32} y={EY + 4} size="s" color={C.text}>
          midnight
        </Label>
        <Label x={EX} y={EY - 32} anchor="middle" size="s" color={C.text}>
          6 am
        </Label>
        <Label x={EX} y={EY + 44} anchor="middle" size="s" color={C.text}>
          6 pm
        </Label>
        {/* Current Moon */}
        <line x1={EX} y1={EY} x2={mx} y2={my} stroke={C.text} strokeOpacity={0.35} strokeDasharray="4 4" />
        <circle cx={mx} cy={my} r={14} fill="#232a4d" stroke={C.text} strokeWidth={1.5} />
        <path d={litPath(mx, my, 14, -1, 0, 0)} fill={C.moon} />
        <Label x={472} y={384} anchor="end" size="s" color={C.faint}>
          seen from above the North Pole · not to scale
        </Label>
        {/* Inset */}
        <rect x={486} y={22} width={222} height={348} rx={10} fill={C.panel} stroke={C.line} />
        <Label x={597} y={46} anchor="middle" size="s" color={C.dim}>
          {`What you see from ${placeName(o)}`}
        </Label>
        <circle cx={597} cy={140} r={60} fill="#1b2142" />
        <path d={litPath(597, 140, 60, skySide, 0, k)} fill={C.moon} />
        <Label x={597} y={232} anchor="middle" size="l" weight={700}>
          {name}
        </Label>
        <Label x={597} y={252} anchor="middle" size="s" color={C.dim}>
          {`${age.toFixed(1)} days old · ${lit}% lit`}
        </Label>
        {up ? (
          <>
            <Label x={502} y={290} size="s">{`rises about ${clock(up.rise)}`}</Label>
            <Label x={502} y={310} size="s">{`highest about ${clock(up.high)}`}</Label>
            <Label x={502} y={330} size="s">{`sets about ${clock(up.set)}`}</Label>
            <Label x={502} y={354} size="s" color={C.faint}>roughly: varies with season</Label>
          </>
        ) : (
          <Label x={502} y={300} size="s">up with the Sun: lost in daylight</Label>
        )}
      </Svg>
      <Controls>
        <RangeControl label="Days since new Moon" value={Math.round(age * 4) / 4} min={0} max={29.5} step={0.25} onChange={(v) => { setPlaying(false); setAge(v); }} format={(v) => v.toFixed(1)} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} />
      </Controls>
      <Readout>
        {`${name}: the Moon is ${Math.round(e <= 180 ? e : 360 - e)}° ${waxing ? 'east' : 'west'} of the Sun. Its Sun-facing half is always lit; from Earth we see ${lit}% of a lit face. `}
        {e < 12 || e > 348
          ? 'It is in the same direction as the Sun, so we face its unlit half.'
          : Math.abs(e - 180) < 12
            ? 'It is opposite the Sun: we see the whole lit half, from sunset to sunrise.'
            : `From ${south ? 'the southern hemisphere' : 'the northern hemisphere'} the lit side is on the ${skySide > 0 ? 'right' : 'left'}, the side facing the Sun.`}
      </Readout>
    </div>
  );
}
