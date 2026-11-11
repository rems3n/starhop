/**
 * Why there are seasons. Left: Earth's orbit drawn to its true (nearly circular) shape in perspective, with the
 * axis tilted 23.4° and always pointing the same way in space. Right: the midday Sun at the learner's location
 * on the chosen date — its height, how a beam of sunlight spreads over the ground, and the hours of daylight.
 * Earth's distance from the Sun is shown too, so the learner can see that we are closest in early January.
 */
import { useEffect, useMemo, useState } from 'react';
import { Body, SearchPlanetApsis, NextPlanetApsis } from 'astronomy-engine';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, rad, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';
import { dayOf2027, fmtHours, fmtTime, geoEcl, litPath, norm360, placeName, seasonName, sunDay, useObserver } from './ecliptic-common';

export const meta: DiagramMeta = {
  title: 'Tilt, not distance, makes the seasons',
  summary: 'Earth’s tilted axis keeps pointing the same way as it orbits; slide the date to see the midday Sun height and day length at your location, and Earth’s distance from the Sun.',
  params: { day: 'starting day of 2027, 0–364 (default 171, the June solstice)' },
};

const CX = 232, CY = 196, RO = 150, E = rad(22), TILT = rad(23.44);

function project(x: number, y: number, z: number): [number, number] {
  return [CX + x, CY - y * Math.sin(E) - z * Math.cos(E)];
}

export default function SeasonsTilt({ params }: DiagramProps) {
  const o = useObserver();
  const [day, setDay] = useState(typeof params?.day === 'number' ? (params.day as number) : 171);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setDay((d) => (d + (reduced ? 7 : 2)) % 365), reduced ? 500 : 80);
    return () => clearInterval(id);
  }, [playing, reduced]);

  const apsides = useMemo(() => {
    const p = SearchPlanetApsis(Body.Earth, new Date(Date.UTC(2027, 0, 1)));
    const a = NextPlanetApsis(Body.Earth, p);
    return { peri: p.time.date, periAu: p.dist_au, aph: a.time.date, aphAu: a.dist_au };
  }, []);
  // The orbit itself, sampled from real positions (true shape and size ratio).
  const orbit = useMemo(() => {
    const pts: string[] = [];
    for (let d = 0; d <= 365; d += 5) {
      const s = geoEcl(Body.Sun, dayOf2027(d));
      const phi = rad(norm360(s.lon + 180) - 90);
      const [x, y] = project(RO * s.dist * Math.cos(phi), RO * s.dist * Math.sin(phi), 0);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return `M ${pts.join(' L ')} Z`;
  }, []);

  const date = dayOf2027(day);
  const sun = geoEcl(Body.Sun, date);
  const phi = rad(norm360(sun.lon + 180) - 90);
  const pos = [RO * sun.dist * Math.cos(phi), RO * sun.dist * Math.sin(phi), 0];
  const [ex, ey] = project(pos[0], pos[1], pos[2]);
  // Sun direction from Earth (3-D) → page direction and phase as seen by the viewer
  const len = Math.hypot(pos[0], pos[1]);
  const s3 = [-pos[0] / len, -pos[1] / len, 0];
  const sx = s3[0], sy = -s3[1] * Math.sin(E);
  const sl = Math.hypot(sx, sy) || 1;
  const k = s3[1] * -Math.cos(E); // dot with direction toward the viewer (0, −cos e, sin e)
  const n3 = [Math.sin(TILT), 0, Math.cos(TILT)];
  const towardSun = s3[0] * n3[0]; // >0: north pole tipped toward the Sun
  const ax = n3[0], ay = -n3[2] * Math.cos(E);

  const sd = useMemo(() => sunDay(o, date), [o, day]); // eslint-disable-line react-hooks/exhaustive-deps
  const month = date.getUTCMonth();
  const season = seasonName(o, month);
  const dateLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  const mkm = (au: number) => (au * 149.598).toFixed(1);

  // Right panel geometry
  const GX0 = 448, GX1 = 708, GY = 272, OX = 496;
  const h = Math.max(0, sd.noonAlt);
  const beamW = 26;
  const foot = h > 1 ? Math.min(GX1 - OX - 30, beamW / Math.sin(rad(h))) : GX1 - OX - 30;
  const bx = OX + 80; // centre of the beam footprint
  const dirx = -Math.cos(rad(h)), diry = -Math.sin(rad(h)); // pointing from ground back up toward the Sun (Sun on the left)
  const bl = 140;
  const hemi = towardSun > 0.05 ? 'north' : towardSun < -0.05 ? 'south' : null;

  // Day-length bar
  const BX = 452, BW = 250, BY = 350;
  const hr = (d?: Date) => (d ? ((d.getTime() - date.getTime()) / 3600000 + 24 * 3) % 24 : 0);
  const riseH = sd.rise ? Number(fmtTime(o.tz, sd.rise).replace(/\D.*$/, '')) : 0; // only for desc
  void riseH;
  const localH = (d: Date) => {
    const t = fmtTime(o.tz, d); // e.g. "5:25 AM"
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return hr(d);
    return ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) + Number(m[2]) / 60;
  };
  const r0 = sd.rise ? localH(sd.rise) : 0;
  const r1 = sd.set ? localH(sd.set) : 24;

  return (
    <div>
      <Svg w={720} h={404} title={meta.title} desc={`Earth's orbit in perspective with the axis tilted 23.4 degrees, and the midday Sun at ${o.name} on ${dateLabel}: ${sd.noonAlt.toFixed(0)} degrees high with ${fmtHours(sd.hours)} of daylight.`}>
        <path d={orbit} fill="none" stroke={C.lineStrong} strokeDasharray="3 4" />
        {/* Sun */}
        <circle cx={CX} cy={CY} r={34} fill="url(#fig-glow)" />
        <circle cx={CX} cy={CY} r={14} fill={C.sun} />
        {/* Month markers for the four turning points */}
        {[
          [78, 'March equinox'],
          [171, 'June solstice'],
          [265, 'Sept. equinox'],
          [355, 'December solstice'],
        ].map(([d, l]) => {
          const s = geoEcl(Body.Sun, dayOf2027(d as number));
          const p = rad(norm360(s.lon + 180) - 90);
          const [x, y] = project(RO * s.dist * Math.cos(p), RO * s.dist * Math.sin(p), 0);
          const side = Math.cos(p);
          return (
            <g key={l as string}>
              <circle cx={x} cy={y} r={3} fill={C.lineStrong} />
              <Label x={x} y={y + (Math.abs(side) > 0.5 ? 38 : Math.sin(p) > 0 ? -12 : 24)} anchor="middle" size="s" color={C.faint}>
                {l}
              </Label>
            </g>
          );
        })}
        {/* Earth with fixed axis */}
        <circle cx={ex} cy={ey} r={18} fill="#16204a" />
        <path d={litPath(ex, ey, 18, sx / sl, sy / sl, k)} fill={C.earth} />
        <line x1={ex - ax * 30} y1={ey - ay * 30} x2={ex + ax * 30} y2={ey + ay * 30} stroke={C.text} strokeWidth={1.5} />
        <Label x={ex + ax * 30 + 4} y={ey + ay * 30 - 2} size="s" weight={700}>
          N
        </Label>
        <Label x={20} y={26} size="s" color={C.dim}>
          Earth’s axis is tilted 23.4° and always points the same way in space
        </Label>
        <Label x={20} y={386} size="s" color={C.faint}>
          Orbit drawn to its true shape: nearly a circle
        </Label>
        {/* Right panel: midday Sun at the learner's place */}
        <Label x={GX0} y={62} weight={600}>
          {`Midday at ${placeName(o)}`}
        </Label>
        <Label x={GX0} y={80} size="s" color={C.dim}>
          {`looking ${sd.noonAlt > 0 ? (o.lat >= 0 ? (sd.noonAlt > 89 ? 'straight up' : 'south') : 'north') : 'toward the horizon'}`}
        </Label>
        <line x1={GX0} y1={GY} x2={GX1} y2={GY} stroke={C.land} strokeWidth={3} />
        {h > 0 && (
          <g>
            {/* Beam of sunlight of fixed width, spreading over the ground */}
            <path d={`M ${bx - foot / 2} ${GY} L ${bx - foot / 2 + dirx * bl} ${GY + diry * bl} L ${bx + foot / 2 + dirx * bl} ${GY + diry * bl} L ${bx + foot / 2} ${GY} Z`} fill={C.sun} opacity={0.22} />
            <line x1={bx - foot / 2} y1={GY + 4} x2={bx + foot / 2} y2={GY + 4} stroke={C.amber} strokeWidth={4} />
            <path d={`M ${OX + 40} ${GY} A 40 40 0 0 0 ${OX + 40 - 40 * Math.cos(rad(h))} ${GY - 40 * Math.sin(rad(h))}`} fill="none" stroke={C.amber} />
            <Label x={OX + 46} y={GY - 10} size="s" color={C.amber} weight={700}>
              {`${sd.noonAlt.toFixed(0)}°`}
            </Label>
            <circle cx={bx + dirx * (bl + 12)} cy={GY + diry * (bl + 12)} r={9} fill={C.sun} />
          </g>
        )}
        <Label x={GX0} y={GY + 24} size="s" color={C.dim}>
          {h > 0 ? `a beam of sunlight spreads over ${(1 / Math.sin(rad(Math.max(h, 1)))).toFixed(1)}×` : 'the Sun does not rise today'}
        </Label>
        {h > 0 && (
          <Label x={GX0} y={GY + 39} size="s" color={C.dim}>
            the ground it would light from overhead
          </Label>
        )}
        {/* Day length bar */}
        <Label x={BX} y={BY - 10} size="s" color={C.dim}>
          {`daylight: ${fmtHours(sd.hours)}`}
        </Label>
        <rect x={BX} y={BY} width={BW} height={14} rx={4} fill="#121a3a" stroke={C.line} />
        {sd.polar === 'day' ? (
          <rect x={BX} y={BY} width={BW} height={14} rx={4} fill={C.sun} opacity={0.75} />
        ) : sd.polar === 'night' ? null : r1 > r0 ? (
          <rect x={BX + (r0 / 24) * BW} y={BY} width={((r1 - r0) / 24) * BW} height={14} fill={C.sun} opacity={0.75} />
        ) : (
          <>
            <rect x={BX} y={BY} width={(r1 / 24) * BW} height={14} fill={C.sun} opacity={0.75} />
            <rect x={BX + (r0 / 24) * BW} y={BY} width={((24 - r0) / 24) * BW} height={14} fill={C.sun} opacity={0.75} />
          </>
        )}
        {['midnight', 'noon', 'midnight'].map((t, i) => (
          <Label key={i} x={BX + (i * BW) / 2} y={BY + 30} anchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} size="s" color={C.faint}>
            {t}
          </Label>
        ))}
      </Svg>
      <Controls>
        <RangeControl label="Date" value={day} min={0} max={364} onChange={(v) => { setPlaying(false); setDay(v); }} format={() => dateLabel} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} label="Play a year" />
      </Controls>
      <Readout>
        {`${dateLabel}${season ? ` (${season} at ${placeName(o)})` : ''}: the midday Sun is ${sd.noonAlt.toFixed(0)}° high and the day lasts ${fmtHours(sd.hours)}. `}
        {hemi ? `The ${hemi}ern half of Earth is tipped toward the Sun. ` : 'Neither hemisphere is tipped toward the Sun. '}
        {`Earth is ${mkm(sun.dist)} million km from the Sun`}
        {Math.abs(date.getTime() - apsides.peri.getTime()) < 12 * 86400000
          ? ` — about its closest of the year (${mkm(apsides.periAu)} million km on ${apsides.peri.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}), yet it is winter in the north.`
          : Math.abs(date.getTime() - apsides.aph.getTime()) < 12 * 86400000
            ? ` — about its farthest (${mkm(apsides.aphAu)} million km on ${apsides.aph.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}), yet it is summer in the north.`
            : `; it varies only between ${mkm(apsides.periAu)} and ${mkm(apsides.aphAu)} million km in the year.`}
      </Readout>
    </div>
  );
}
