/**
 * Why the night-time constellations change through the year. Top-down view from above Earth's North Pole:
 * the Sun, Earth on its orbit (real position for the chosen date, astronomy-engine), and the ring of
 * constellations along the ecliptic (spans from the IAU boundaries). Constellations behind the Sun are up in
 * daylight; those on the far side from the Sun are up at night. Orion is marked just off the ring.
 */
import { useMemo, useState } from 'react';
import * as Astronomy from 'astronomy-engine';
import { constellationAt, eclipticToRaDec, sunLongitudeJ2000 } from '@/astro';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, useAnimatedValue, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';
import { atan2d, cosd, sind, wrap180, wrap360 } from './_motion-sky';

export const meta: DiagramMeta = {
  title: 'The Sun hides its own part of the sky',
  summary: 'Top-down view of Earth’s orbit inside the ring of zodiac constellations; slide through the year to see which are up at night and which are hidden behind the Sun.',
  params: { day: 'starting day of the year, 0–364 (default 14 = 15 January)' },
};

const W = 720, H = 440, CX = 360, CY = 220;
const RO = 82, RING = 148, LAB = 170;
const NAMES: Record<string, string> = { Psc: 'Pisces', Ari: 'Aries', Tau: 'Taurus', Gem: 'Gemini', Cnc: 'Cancer', Leo: 'Leo', Vir: 'Virgo', Lib: 'Libra', Sco: 'Scorpius', Oph: 'Ophiuchus', Sgr: 'Sagittarius', Cap: 'Capricornus', Aqr: 'Aquarius', Cet: 'Cetus' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const Y0 = Date.UTC(2026, 0, 1, 12);
const dateOf = (d: number) => new Date(Y0 + Math.round(d) * 86400000);
const fmtDay = (d: number) => { const t = dateOf(d); return `${t.getUTCDate()} ${MON[t.getUTCMonth()]}`; };
// Screen angle = ecliptic longitude, counter-clockwise (we look down from the north side of the orbit).
const P = (r: number, lon: number): [number, number] => [CX + r * cosd(lon), CY - r * sind(lon)];

export default function NightSideConstellations({ params }: DiagramProps) {
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [day, setDay] = useAnimatedValue(typeof params?.day === 'number' ? (params.day as number) : 14, playing, reduced ? 30 : 24, [0, 365]);

  const spans = useMemo(() => {
    const out: { id: string; a: number; b: number }[] = [];
    for (let l = 0; l < 360; l += 0.5) {
      const q = eclipticToRaDec(l);
      const id = constellationAt(q.ra, q.dec);
      const last = out[out.length - 1];
      if (last && last.id === id) last.b = l + 0.5;
      else out.push({ id, a: l, b: l + 0.5 });
    }
    if (out.length > 1 && out[0].id === out[out.length - 1].id) { const f = out.shift()!; out[out.length - 1].b = 360 + f.b; }
    return out;
  }, []);
  const orionLon = useMemo(() => {
    const v = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECL(), new Astronomy.Vector(cosd(-1.2) * cosd(84.05), cosd(-1.2) * sind(84.05), sind(-1.2), Astronomy.MakeTime(new Date(Y0))));
    return wrap360(atan2d(v.y, v.x));
  }, []);

  const date = dateOf(day);
  const sunLon = sunLongitudeJ2000(date);
  const earthLon = wrap360(sunLon + 180);
  const E = P(RO, earthLon);
  const elong = (lon: number) => Math.abs(wrap180(lon - sunLon));
  const spanAt = (lon: number) => spans.find((s) => wrap360(lon - s.a) < s.b - s.a) ?? spans[0];
  const sunCon = NAMES[spanAt(sunLon).id] ?? spanAt(sunLon).id;
  const midCon = NAMES[spanAt(earthLon).id] ?? spanAt(earthLon).id;
  const eo = elong(orionLon);
  const orionEast = wrap180(orionLon - sunLon) > 0;
  const orion =
    eo < 35 ? 'lost in the Sun’s glare: it is above the horizon only in daytime'
      : eo < 80 ? `only low in the ${orionEast ? 'west after sunset' : 'east before dawn'}`
        : eo < 135 ? `up for part of the night, ${orionEast ? 'in the evening' : 'after midnight and before dawn'}`
          : 'up most of the night';

  const tone = (lon: number) => { const e = elong(lon); return e < 30 ? 'sun' : e > 90 ? 'night' : 'twilight'; };
  const arc = (r: number, a: number, b: number) => { const [x0, y0] = P(r, a), [x1, y1] = P(r, b); return `M ${x0} ${y0} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 0 ${x1} ${y1}`; };
  const half = (c: [number, number], r: number, toward: number) => { const [x0, y0] = [c[0] + r * cosd(toward + 90), c[1] - r * sind(toward + 90)], [x1, y1] = [c[0] + r * cosd(toward - 90), c[1] - r * sind(toward - 90)]; return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`; };
  const mid = [E[0] + 60 * cosd(earthLon), E[1] - 60 * sind(earthLon)];
  const noon = [E[0] - 36 * cosd(earthLon), E[1] + 36 * sind(earthLon)];

  return (
    <div>
      <Svg w={W} h={H} title={meta.title} desc={`Top-down view of the Sun, Earth's orbit and a ring of zodiac constellations on ${fmtDay(day)}. The constellations beyond the Sun are hidden in daylight; those on the opposite side are up at night.`}>
        {/* Night-side wedge: the part of the ring more than 90° from the Sun */}
        <path d={`M ${CX} ${CY} L ${P(RING + 8, earthLon - 90)[0]} ${P(RING + 8, earthLon - 90)[1]} A ${RING + 8} ${RING + 8} 0 0 0 ${P(RING + 8, earthLon + 90)[0]} ${P(RING + 8, earthLon + 90)[1]} Z`} fill={C.amber} fillOpacity={0.05} />
        {spans.map((s, i) => {
          const t = tone((s.a + s.b) / 2);
          return <path key={i} d={arc(RING, s.a + 0.6, s.b - 0.6)} fill="none" strokeWidth={t === 'sun' ? 5 : 10} strokeLinecap="butt" stroke={t === 'night' ? C.amber : t === 'sun' ? C.faint : C.blue} strokeOpacity={t === 'sun' ? 0.3 : t === 'night' ? 0.9 : 0.45} />;
        })}
        {spans.filter((s) => s.b - s.a > 5 && s.id !== 'Cet').map((s) => {
          const m = (s.a + s.b) / 2;
          const r = s.id === 'Sco' ? LAB + 18 : LAB;
          const [x, y] = P(r, m);
          const t = tone(m);
          const anchor = Math.abs(cosd(m)) < 0.35 ? 'middle' : cosd(m) > 0 ? 'start' : 'end';
          return <Label key={s.id} x={x} y={y + 5 + (sind(m) < -0.9 ? 6 : 0)} anchor={anchor} size="s" color={t === 'night' ? C.text : t === 'sun' ? C.faint : C.dim} weight={t === 'night' ? 600 : 400}>{NAMES[s.id] ?? s.id}</Label>;
        })}
        {/* Orion, just south of the ecliptic */}
        {(() => { const [x, y] = P(RING - 20, orionLon); return <g><circle cx={x} cy={y} r={4} fill={eo > 90 ? C.amber : C.dim} /><Label x={x + 8} y={y + 4} size="s" color={eo > 90 ? C.amber : C.dim} weight={600}>Orion</Label></g>; })()}
        {/* Sun and orbit */}
        <circle cx={CX} cy={CY} r={RO} fill="none" stroke={C.line} strokeDasharray="4 5" />
        <circle cx={CX} cy={CY} r={40} fill="url(#fig-glow)" />
        <circle cx={CX} cy={CY} r={15} fill={C.sun} />
        {/* Earth: day side toward the Sun */}
        <circle cx={E[0]} cy={E[1]} r={11} fill="#1d2a52" stroke={C.lineStrong} />
        <path d={half(E, 11, sunLon)} fill={C.earth} />
        <line x1={E[0]} y1={E[1]} x2={mid[0]} y2={mid[1]} stroke={C.amber} strokeWidth={2} markerEnd="url(#fig-arrow)" />
        {(() => { const m = [E[0] + 34 * cosd(earthLon) + 14 * cosd(earthLon + 90), E[1] - 34 * sind(earthLon) - 14 * sind(earthLon + 90)]; return <Label x={m[0]} y={m[1] + 4} anchor={sind(earthLon) > 0.3 ? 'end' : sind(earthLon) < -0.3 ? 'start' : 'middle'} size="s" color={C.amber} weight={600}>midnight</Label>; })()}
        <line x1={E[0]} y1={E[1]} x2={noon[0]} y2={noon[1]} stroke={C.sun} strokeWidth={1.5} strokeDasharray="3 3" />
        {/* Legend */}
        <rect x={16} y={18} width={18} height={8} fill={C.amber} opacity={0.85} />
        <Label x={40} y={27} size="s">up at night</Label>
        <rect x={16} y={36} width={18} height={8} fill={C.blue} opacity={0.45} />
        <Label x={40} y={45} size="s" color={C.dim}>evening or dawn only</Label>
        <rect x={16} y={56} width={18} height={4} fill={C.faint} opacity={0.4} />
        <Label x={40} y={63} size="s" color={C.dim}>behind the Sun: up in daylight</Label>
        <Label x={W - 14} y={H - 30} anchor="end" size="s" color={C.faint}>Seen from above Earth’s North Pole.</Label>
        <Label x={W - 14} y={H - 13} anchor="end" size="s" color={C.faint}>Not to scale: the stars are vastly farther away.</Label>
      </Svg>
      <Controls>
        <RangeControl label="Date" value={Math.round(day) % 365} min={0} max={364} step={1} onChange={(v) => { setPlaying(false); setDay(v); }} format={fmtDay} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} label="Play the year" />
      </Controls>
      <Readout>{`${fmtDay(day)}: the Sun is in front of ${sunCon}, so ${sunCon} is up only in daylight. At midnight you face ${midCon}, on the opposite side of the sky from the Sun. Orion is ${orion}.`}</Readout>
    </div>
  );
}
