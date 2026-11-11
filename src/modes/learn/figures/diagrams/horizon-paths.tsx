/**
 * Star paths across a 180° panorama of the sky, facing east, south, west or north, for any latitude.
 * Each line is the daily path of a star at one declination; dots are one hour apart (15°). The celestial
 * equator's path is highlighted, and facing east/west the figure measures the angle at which stars rise or
 * set: 90° minus the latitude. Equal-angle panorama (azimuth across, altitude up, same scale), so angles at
 * the horizon are true.
 */
import { useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { fmtLat, hadecToAltAz, hemi, placeName, placeOf, placeOptions, polyPath, useObserver, wrap180 } from './_motion-sky';

export const meta: DiagramMeta = {
  title: 'How stars cross your sky',
  summary: 'A 180° panorama facing east, south, west or north showing the daily paths of stars, with a latitude slider and place presets.',
  params: { face: '"east" | "south" | "west" | "north" (default "east")', lat: 'starting latitude (default: the learner’s location)' },
};

type Face = 'east' | 'south' | 'west' | 'north';
const FACE_AZ: Record<Face, number> = { north: 0, east: 90, south: 180, west: 270 };
const W = 720, H = 380;
const X0 = 50, X1 = 670, Y0 = 340, PX = (X1 - X0) / 180; // px per degree, both axes
const DECS = [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75];
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export default function HorizonPaths({ params }: DiagramProps) {
  const obs = useObserver();
  const [face, setFace] = useState<Face>(['east', 'south', 'west', 'north'].includes(params?.face as string) ? (params!.face as Face) : 'east');
  const [lat, setLat] = useState<number>(typeof params?.lat === 'number' ? (params.lat as number) : Math.round(obs.lat * 10) / 10);
  const F = FACE_AZ[face];
  const opts = placeOptions(obs);
  const sx = (az: number) => (X0 + X1) / 2 + wrap180(az - F) * PX;
  const sy = (alt: number) => Y0 - alt * PX;
  const inView = (az: number, alt: number) => alt > -1 && Math.abs(wrap180(az - F)) < 91;

  const tracks = DECS.map((dec) => {
    const pts: ([number, number] | null)[] = [];
    const dots: [number, number][] = [];
    let arrow: { x: number; y: number; dx: number; dy: number } | null = null;
    let best = 1e9;
    for (let h = -180; h <= 180; h += 1) {
      const p = hadecToAltAz(h, dec, lat);
      const ok = inView(p.az, p.alt) && !(p.alt > 89.5);
      const xy: [number, number] | null = ok ? [sx(p.az), sy(Math.max(0, p.alt))] : null;
      pts.push(xy);
      if (xy && h % 15 === 0) dots.push(xy);
      // Arrow near the middle of the visible part
      if (xy) {
        const q = hadecToAltAz(h + 4, dec, lat);
        const d = Math.abs(xy[0] - (X0 + X1) / 2) + Math.abs(xy[1] - 190) * 0.5;
        if (inView(q.az, q.alt) && d < best && Math.abs(wrap180(q.az - p.az)) < 20) {
          best = d;
          arrow = { x: xy[0], y: xy[1], dx: sx(q.az) - xy[0], dy: sy(Math.max(0, q.alt)) - xy[1] };
        }
      }
    }
    return { dec, d: polyPath(pts, 30), dots, arrow };
  });

  const sgn = hemi(lat);
  const slant = 90 - Math.abs(lat);
  const poleAlt = Math.abs(lat);
  const poleAz = lat >= 0 ? 0 : 180;
  const poleVisible = inView(poleAz, poleAlt) && poleAlt > 0.5;

  // Angle marker where the celestial equator crosses the horizon (east or west point)
  let angle: { x: number; y: number; a0: number; a1: number } | null = null;
  if ((face === 'east' || face === 'west') && Math.abs(lat) < 89) {
    const h = face === 'east' ? -90 : 90;
    const p = hadecToAltAz(h + (face === 'east' ? 6 : -6), 0, lat);
    const dir = Math.atan2(-(sy(p.alt) - Y0), sx(p.az) - sx(F)) * (180 / Math.PI); // direction of the path leaving the horizon, screen degrees
    angle = { x: sx(F), y: Y0, a0: dir > 90 ? 180 : 0, a1: dir };
  }
  const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    const p0 = [cx + r * Math.cos((a0 * Math.PI) / 180), cy - r * Math.sin((a0 * Math.PI) / 180)];
    const p1 = [cx + r * Math.cos((a1 * Math.PI) / 180), cy - r * Math.sin((a1 * Math.PI) / 180)];
    return `M ${p0[0]} ${p0[1]} A ${r} ${r} 0 0 ${a1 > a0 ? 0 : 1} ${p1[0]} ${p1[1]}`;
  };

  const leftRight = (s: number) => (s > 0 ? 'right' : 'left');
  let text: string;
  const where = `From latitude ${fmtLat(lat)}, facing ${face}: `;
  if (Math.abs(lat) > 89) text = `${where}nothing rises or sets. Every star circles parallel to the horizon at a fixed height, and the celestial ${lat > 0 ? 'north' : 'south'} pole is straight overhead.`;
  else if (face === 'east') text = Math.abs(lat) < 1 ? `${where}stars rise straight up out of the horizon, 15° (one dot) each hour.` : `${where}stars rise at ${slant.toFixed(0)}° to the horizon (90° − ${Math.abs(lat).toFixed(0)}°), leaning to the ${leftRight(sgn)}, toward the ${sgn > 0 ? 'south' : 'north'}. Dots are one hour apart.`;
  else if (face === 'west') text = Math.abs(lat) < 1 ? `${where}stars drop straight down into the horizon.` : `${where}stars set on the same ${slant.toFixed(0)}° slant, moving down and to the ${leftRight(sgn)}.`;
  else if ((face === 'south') === (lat > 0)) text = `${where}stars move ${lat > 0 ? 'left to right' : 'right to left'} and are highest when due ${face}. The celestial equator peaks ${slant.toFixed(0)}° up.`;
  else text = `${where}stars circle the celestial ${lat > 0 ? 'north' : 'south'} pole, ${poleAlt.toFixed(0)}° up, ${lat > 0 ? 'counter-clockwise' : 'clockwise'}. Stars close to it never set.`;

  return (
    <div>
      <Svg w={W} h={H} title={meta.title} desc={`A panorama of half the sky facing ${face}, with lines showing the daily paths of stars seen from latitude ${fmtLat(lat)} and dots one hour apart.`}>
        {/* Altitude grid */}
        {[30, 60].map((a) => (
          <g key={a}>
            <line x1={X0} x2={X1} y1={sy(a)} y2={sy(a)} stroke={C.line} strokeDasharray="2 5" />
            <Label x={X0 - 6} y={sy(a) + 4} anchor="end" size="s" color={C.faint}>{`${a}°`}</Label>
          </g>
        ))}
        <Label x={X0 - 6} y={sy(90) + 4} anchor="end" size="s" color={C.faint}>90°</Label>
        <line x1={X0} x2={X1} y1={sy(90)} y2={sy(90)} stroke={C.line} />
        <Label x={(X0 + X1) / 2} y={sy(90) - 8} anchor="middle" size="s" color={C.dim}>overhead (zenith)</Label>
        {tracks.map((t) => (
          <g key={t.dec}>
            <path d={t.d} fill="none" stroke={t.dec === 0 ? C.blue : C.lineStrong} strokeWidth={t.dec === 0 ? 2.4 : 1.3} />
            {t.dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={t.dec === 0 ? 3 : 2.2} fill={t.dec === 0 ? C.blue : C.star} />)}
            {t.arrow && Math.hypot(t.arrow.dx, t.arrow.dy) > 3 && (
              <line x1={t.arrow.x} y1={t.arrow.y} x2={t.arrow.x + t.arrow.dx * 1.6} y2={t.arrow.y + t.arrow.dy * 1.6} stroke={t.dec === 0 ? C.blue : C.star} strokeWidth={1.6} markerEnd="url(#fig-arrow)" />
            )}
          </g>
        ))}
        {(() => {
          const t = tracks.find((k) => k.dec === 0);
          const c = t?.dots.filter(([x, y]) => x > X0 + 30 && x < X1 - 140 && y < Y0 - 30).sort((a, b) => a[1] - b[1])[0];
          if (!c) return null;
          return <Label x={c[0] + 8} y={c[1] - 10} color={C.blue} size="s" weight={600}>celestial equator</Label>;
        })()}
        {poleVisible && (
          <g>
            <circle cx={sx(poleAz)} cy={sy(poleAlt)} r={5} fill="none" stroke={C.amber} strokeWidth={2} />
            <Label x={sx(poleAz) + (sx(poleAz) > W - 180 ? -9 : 9)} y={sy(poleAlt) + 4} anchor={sx(poleAz) > W - 180 ? 'end' : 'start'} size="s" color={C.amber} weight={600}>{lat > 0 ? 'north celestial pole' : 'south celestial pole'}</Label>
          </g>
        )}
        {/* Ground */}
        <rect x={X0 - 40} y={Y0} width={X1 - X0 + 80} height={H - Y0} fill="#141a2e" />
        <line x1={X0 - 40} x2={X1 + 40} y1={Y0} y2={Y0} stroke={C.lineStrong} strokeWidth={1.5} />
        {[-90, -45, 0, 45, 90].map((d) => (
          <Label key={d} x={(X0 + X1) / 2 + d * PX} y={Y0 + 22} anchor="middle" size={d === 0 ? 'm' : 's'} weight={d === 0 ? 700 : 500} color={d === 0 ? C.text : C.dim}>
            {COMPASS[Math.round(((F + d + 360) % 360) / 45) % 8]}
          </Label>
        ))}
        {angle && (
          <g>
            <path d={arcPath(angle.x, angle.y, 46, angle.a0, angle.a1)} fill="none" stroke={C.amber} strokeWidth={2} />
            <Label x={angle.x + (angle.a0 === 0 ? 52 : -52)} y={angle.y - 18} anchor={angle.a0 === 0 ? 'start' : 'end'} color={C.amber} weight={700}>
              {`${slant.toFixed(0)}°`}
            </Label>
          </g>
        )}
      </Svg>
      <Controls>
        <ChoiceControl label="Face" value={face} options={[{ value: 'east', label: 'East' }, { value: 'south', label: 'South' }, { value: 'west', label: 'West' }, { value: 'north', label: 'North' }]} onChange={setFace} />
        <RangeControl label="Latitude" value={lat} min={-90} max={90} step={0.1} onChange={setLat} format={fmtLat} />
        <ChoiceControl label="Go to" value={placeOf(lat, opts)} options={opts.map((o) => ({ value: o.value, label: o.value === 'you' ? placeName(obs) : o.label }))} onChange={(v) => setLat(opts.find((o) => o.value === v)!.lat)} />
      </Controls>
      <Readout>{text}</Readout>
    </div>
  );
}
