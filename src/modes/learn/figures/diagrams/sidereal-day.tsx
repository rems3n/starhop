/**
 * Why a day by the stars (sidereal day, 23 h 56 min) is shorter than a day by the Sun (24 h). Top-down view:
 * the Sun, a stretch of Earth's orbit, and Earth turning while it moves along. At noon an observer has the
 * Sun and a distant star (far beyond the Sun) overhead. After one turn relative to the stars the star is
 * overhead again, but Earth has moved along its orbit, so it must turn a little more to face the Sun.
 * The orbit step is exaggerated ×20 so the extra turn is visible; the clock shows real times.
 */
import { useEffect, useState } from 'react';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Step, Svg, useAnimatedValue, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';
import { cosd, sind } from './_motion-sky';

export const meta: DiagramMeta = {
  title: 'Sidereal day and solar day',
  summary: 'Top-down view of Earth spinning while it moves along its orbit; play one day and see why facing the Sun again takes 4 minutes longer than facing a star again.',
  params: { turn: 'starting rotation in degrees, 0–380 (default 0)' },
};

const W = 720, H = 400;
const SUN: [number, number] = [105, 220];
const RO = 360, RE = 34;
const REAL_DAY = 360 * (1 + 1 / 365.256); // degrees Earth turns relative to the stars in one solar day (≈ 360.986°)
const EXAG = 20;
const TH = (REAL_DAY - 360) * EXAG; // drawn orbit step per day (≈ 19.7°)
const STAR_DIR = 180 - TH / 2; // direction (math degrees, y up) from the noon Earth toward the Sun and the distant star
const END = 360 + TH;

const pt = (c: [number, number], r: number, a: number): [number, number] => [c[0] + r * cosd(a), c[1] - r * sind(a)];
/** Real minutes after noon for a drawn rotation s (degrees relative to the stars). */
function minutesOf(s: number): number {
  const real = s <= 360 ? s : 360 + ((s - 360) * (REAL_DAY - 360)) / TH;
  return (real / REAL_DAY) * 1440;
}
const fmtT = (min: number) => {
  const tot = Math.round(min * 60);
  const h = Math.floor(tot / 3600), m = Math.floor((tot % 3600) / 60), s = tot % 60;
  return `${h} h ${String(m).padStart(2, '0')} min${s && h >= 23 ? ` ${String(s).padStart(2, '0')} s` : ''}`;
};

export default function SiderealDay({ params }: DiagramProps) {
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [s, setS] = useAnimatedValue(typeof params?.turn === 'number' ? (params.turn as number) : 0, playing, reduced ? 120 : 45);
  useEffect(() => { if (playing && s >= END) { setPlaying(false); setS(END); } }, [playing, s, setS]);
  const sd = Math.min(END, Math.max(0, s));

  const min = minutesOf(sd);
  const orbitA = -TH / 2 + TH * (min / 1440);
  const E = pt(SUN, RO, orbitA);
  const E0 = pt(SUN, RO, -TH / 2);
  const E1 = pt(SUN, RO, TH / 2);
  const look = STAR_DIR + sd; // direction the observer's "overhead" arrow points
  const sunDir = 180 + orbitA; // direction from Earth to the Sun

  const earth = (c: [number, number], lookA: number, sunA: number, ghost: boolean) => {
    const [ax, ay] = pt(c, RE, sunA + 90), [bx, by] = pt(c, RE, sunA - 90);
    const o = pt(c, RE, lookA), tip = pt(c, RE + 46, lookA);
    return (
      <g opacity={ghost ? 0.35 : 1}>
        <circle cx={c[0]} cy={c[1]} r={RE} fill="#1d2a52" stroke={C.lineStrong} />
        <path d={`M ${ax} ${ay} A ${RE} ${RE} 0 0 1 ${bx} ${by} Z`} fill={C.earth} />
        <line x1={o[0]} y1={o[1]} x2={tip[0]} y2={tip[1]} stroke={C.amber} strokeWidth={2.2} markerEnd="url(#fig-arrow)" />
        <circle cx={o[0]} cy={o[1]} r={4} fill={C.amber} />
      </g>
    );
  };
  const arcD = (c: [number, number], r: number, a0: number, a1: number) => {
    const [x0, y0] = pt(c, r, a0), [x1, y1] = pt(c, r, a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 0 ${x1} ${y1}`;
  };
  const orbit = Array.from({ length: 41 }, (_, i) => pt(SUN, RO, -30 + i * 1.5)).map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const starRay = (c: [number, number]) => { const a = pt(c, RE + 2, STAR_DIR), b = pt(c, 330, STAR_DIR); return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={C.star} strokeWidth={1.2} strokeDasharray="2 5" opacity={0.7} />; };

  let text: string;
  if (sd < 1) text = 'Noon: the Sun is overhead, and so is a distant star that lies far beyond it in the same direction. Press Play to run one day.';
  else if (sd < 359) text = `${fmtT(min)} after noon: Earth has turned ${Math.round(sd)}° relative to the stars, and moved a little along its orbit.`;
  else if (sd < 361) text = `${fmtT(min)}: one full turn relative to the stars. The star is overhead again, but because Earth has moved along its orbit the Sun is not: Earth must turn about 1° more.`;
  else if (sd < END - 0.5) text = `${fmtT(min)}: the extra turn. About 1° more (drawn 20 times bigger) takes about 4 minutes.`;
  else text = `24 h 00 min: the Sun is overhead again, one solar day after the start. A day by the stars is 23 h 56 min; a day by the Sun is 24 h, about 4 minutes longer.`;

  return (
    <div>
      <Svg w={W} h={H} title={meta.title} desc="Top-down view: the Sun on the left, an arc of Earth's orbit on the right with Earth at the start and at the current time. An arrow on Earth shows the direction overhead for one observer; dotted lines point toward a distant star far beyond the Sun.">
        <circle cx={SUN[0]} cy={SUN[1]} r={70} fill="url(#fig-glow)" />
        <circle cx={SUN[0]} cy={SUN[1]} r={26} fill={C.sun} />
        <Label x={SUN[0]} y={SUN[1] + 50} anchor="middle" weight={600}>Sun</Label>
        <path d={orbit} fill="none" stroke={C.line} strokeWidth={1.5} strokeDasharray="6 5" />
        <Label x={pt(SUN, RO, 27)[0] + 10} y={pt(SUN, RO, 27)[1] + 4} size="s" color={C.dim}>Earth’s orbit</Label>
        {/* Direction of travel */}
        {(() => { const a = pt(SUN, RO + 24, 13), b = pt(SUN, RO + 24, 20); return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={C.dim} strokeWidth={1.5} markerEnd="url(#fig-arrow)" />; })()}
        {/* Rays toward the distant star: parallel from every position */}
        {starRay(E0)}
        {sd > 1 && starRay(E)}
        {(() => { const p = pt(E0, 300, STAR_DIR); return <Label x={p[0] - 8} y={p[1] - 12} size="s" color={C.dim}>to a distant star (far beyond the Sun)</Label>; })()}
        {/* Sun direction from the current Earth */}
        {sd > 1 && (() => { const a = pt(E, RE + 2, sunDir), b = pt(E, 120, sunDir); return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={C.sun} strokeWidth={1.2} strokeDasharray="6 4" opacity={0.8} />; })()}
        {sd > 1 && earth(E0, STAR_DIR, 180 - TH / 2, true)}
        {sd >= 359 && (
          <g>
            <path d={arcD(E, RE + 30, STAR_DIR, STAR_DIR + TH)} fill="none" stroke={C.amber} strokeWidth={2} />
            {(() => { const p = pt(E, RE + 44, STAR_DIR + TH / 2); return <Label x={p[0] - 6} y={p[1] + 4} anchor="end" size="s" color={C.amber} weight={700}>extra turn ≈ 1°</Label>; })()}
          </g>
        )}
        {earth(E, look, sunDir, false)}
        <Step x={E0[0] + 50} y={E0[1] + 28} n={1} />
        <Label x={E0[0] + 66} y={E0[1] + 32} size="s">Noon</Label>
        {sd >= 359 && <><Step x={E1[0] + 50} y={E1[1] - 34} n={2} /><Label x={E1[0] + 66} y={E1[1] - 30} size="s">23 h 56 min: star overhead</Label></>}
        {sd >= END - 0.5 && <><Step x={E1[0] + 50} y={E1[1] - 8} n={3} /><Label x={E1[0] + 66} y={E1[1] - 4} size="s">24 h: Sun overhead</Label></>}
        <Label x={16} y={H - 14} size="s" color={C.faint}>Not to scale. Orbit step exaggerated ×20: really about 1° a day.</Label>
      </Svg>
      <Controls>
        <RangeControl label="Time after noon" value={sd} min={0} max={END} step={0.5} onChange={(v) => { setPlaying(false); setS(v); }} format={(v) => (v >= END - 0.3 ? '24 h 00 min' : fmtT(minutesOf(v)))} />
        <PlayButton playing={playing} onToggle={() => { if (sd >= END) setS(0); setPlaying((p) => !p); }} label="Play one day" />
      </Controls>
      <Readout>{text}</Readout>
    </div>
  );
}
