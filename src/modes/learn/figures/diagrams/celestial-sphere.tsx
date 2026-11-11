/**
 * Earth spinning inside the celestial sphere. Real bright stars (J2000, from the catalog) sit on a big sphere;
 * a small Earth turns inside it with an observer at the learner's location (settings). The observer's horizon, extended out to the
 * sky, is drawn as a great circle: stars above it are up, stars below it are down. Sliding the time turns
 * Earth (15° an hour); the stars stay put and the horizon sweeps across them.
 */
import { useMemo, useState } from 'react';
import { useCatalog } from '@/data/catalog';
import { C, Callout, Controls, Label, PlayButton, RangeControl, Readout, Svg, useAnimatedValue, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';
import { compass, cosd, hadecToAltAz, hemi, localDate, lstDeg, placeName, polyPath, sind, useObserver, wrap360 } from './_motion-sky';

export const meta: DiagramMeta = {
  title: 'Earth turning inside the sky',
  summary: 'A small Earth spins inside a sphere of real stars; the observer’s horizon sweeps across them. Slide or play the hours.',
  params: { hours: 'starting hours after 7 pm on 15 January, 0–24 (default 0)', lat: 'observer latitude (default: the learner’s location from settings)' },
};

type V3 = [number, number, number];
const W = 720, H = 430;
const CX = 360, CY = 222, R = 168, RE = 44;

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const radec = (ra: number, dec: number): V3 => [cosd(dec) * cosd(ra), cosd(dec) * sind(ra), sind(dec)];
const ORION = { ra: 84.05, dec: -1.2 }; // Alnilam, the middle of the Belt
const DIPPER = { ra: 183.86, dec: 57.03, name: 'the Big Dipper' }; // Megrez, where the handle meets the bowl
const CROSS = { ra: 186.8, dec: -60.0, name: 'the Southern Cross' }; // middle of Crux

function clock(h: number) {
  const t = (19 + h) % 24;
  const hh = Math.floor(t), mm = Math.round((t - hh) * 60) % 60;
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
}

export default function CelestialSphere({ params }: DiagramProps) {
  const obs0 = useObserver();
  const lat = typeof params?.lat === 'number' ? (params.lat as number) : obs0.lat;
  const sgn = hemi(lat);
  const ELEV = 18 * sgn; // camera a little above (north) or below (south) the celestial equator, on the observer's side
  const T0 = useMemo(() => localDate(2026, 1, 15, 19, obs0.tz).getTime(), [obs0.tz]); // 7 pm local time, 15 January
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [hours, setHours] = useAnimatedValue(typeof params?.hours === 'number' ? (params.hours as number) : 0, playing, reduced ? 1 : 2, [0, 24]);
  const cat = useCatalog();

  const theta0 = useMemo(() => lstDeg(new Date(T0), obs0.lon), [T0, obs0.lon]);
  // Camera: looking at the sphere from a little above the celestial equator, turned so the observer starts front-left.
  const camAz = theta0 + 55;
  const cam: V3 = [cosd(ELEV) * cosd(camAz), cosd(ELEV) * sind(camAz), sind(ELEV)];
  const right: V3 = [-sind(camAz), cosd(camAz), 0];
  const up: V3 = [-sind(ELEV) * cosd(camAz), -sind(ELEV) * sind(camAz), cosd(ELEV)];
  const P = (v: V3, r = R): [number, number] => [CX + r * dot(v, right), CY - r * dot(v, up)];

  const stars = useMemo(() => {
    if (!cat) return [];
    return cat.stars.filter((s) => s.mag < 2.6).map((s) => ({ v: radec(s.ra, s.dec), mag: s.mag, id: s.id }));
  }, [cat]);
  const figures = useMemo(() => {
    if (!cat) return [];
    return (sgn > 0 ? ['Ori', 'UMa', 'Cas'] : ['Ori', 'Cru', 'Sco']).flatMap((id) => cat.constellations.find((c) => c.id === id)?.lines.map((l) => l.map(([ra, dec]) => radec(ra, dec))) ?? []);
  }, [cat, sgn]);

  const theta = theta0 + 15.041 * hours; // sidereal rate
  const n: V3 = [cosd(lat) * cosd(theta), cosd(lat) * sind(theta), sind(lat)]; // observer's zenith
  const east: V3 = [-sind(theta), cosd(theta), 0];
  const north: V3 = [-sind(lat) * cosd(theta), -sind(lat) * sind(theta), cosd(lat)];
  const ring = (f: (s: number) => V3, front: boolean) =>
    polyPath(Array.from({ length: 145 }, (_, i) => { const v = f((i * 360) / 144); return (dot(v, cam) >= 0) === front ? P(v) : null; }), 30);
  const horizon = (s: number): V3 => [cosd(s) * east[0] + sind(s) * north[0], cosd(s) * east[1] + sind(s) * north[1], cosd(s) * east[2] + sind(s) * north[2]];
  const equator = (s: number): V3 => [cosd(s), sind(s), 0];

  const obsFront = dot(n, cam) > 0;
  const obs = P(n, RE);
  // Small patch of ground at the observer (tangent plane)
  const patch = polyPath(Array.from({ length: 41 }, (_, i) => {
    const s = (i * 360) / 40;
    const v: V3 = [n[0] * RE + 26 * (cosd(s) * east[0] + sind(s) * north[0]), n[1] * RE + 26 * (cosd(s) * east[1] + sind(s) * north[1]), n[2] * RE + 26 * (cosd(s) * east[2] + sind(s) * north[2])];
    return P(v, 1);
  }), 200);
  const zen = P([n[0] * (RE + 36), n[1] * (RE + 36), n[2] * (RE + 36)], 1);

  const ncp = P([0, 0, 1]);
  const scp = P([0, 0, -1]);
  const earthTop = P([0, 0, 1], RE), earthBot = P([0, 0, -1], RE);

  const ha = (ra: number) => wrap360(theta - ra);
  const ori = hadecToAltAz(ha(ORION.ra), ORION.dec, lat);
  const T2 = sgn > 0 ? DIPPER : CROSS;
  const dip = hadecToAltAz(ha(T2.ra), T2.dec, lat);
  const where = (p: { alt: number; az: number }) => (p.alt > 0 ? `${Math.round(p.alt)}° up in the ${compass(p.az)}` : 'below your horizon');
  const oriP = P(radec(ORION.ra, ORION.dec));
  const dipP = P(radec(T2.ra, T2.dec));

  const starEl = (front: boolean) =>
    stars.filter((s) => (dot(s.v, cam) >= 0) === front).map((s) => {
      const up = dot(s.v, n) > 0;
      const [x, y] = P(s.v);
      const r = Math.max(1.1, 3.4 - 0.75 * s.mag) * (front ? 1 : 0.8);
      return <circle key={s.id} cx={x} cy={y} r={r} fill={up ? C.star : C.faint} opacity={up ? 1 : front ? 0.45 : 0.3} />;
    });

  return (
    <div>
      <Svg w={W} h={H} title={meta.title} desc="A large sphere dotted with real bright stars, with a small Earth at its centre turning on an axis that points to the north and south celestial poles. A green circle marks the observer’s horizon extended out to the sky; stars above it are drawn bright and stars below it dim.">
        {/* Back half: sphere edge, far stars and far halves of the circles */}
        <circle cx={CX} cy={CY} r={R} fill="rgba(120,140,220,0.05)" stroke={C.lineStrong} strokeWidth={1.2} />
        <g>{starEl(false)}</g>
        <path d={ring(equator, false)} fill="none" stroke={C.blue} strokeWidth={1.2} strokeDasharray="3 5" opacity={0.6} />
        <path d={ring(horizon, false)} fill="none" stroke={C.good} strokeWidth={1.6} strokeDasharray="3 5" opacity={0.6} />
        {/* Axis behind Earth */}
        <line x1={scp[0]} y1={scp[1]} x2={earthBot[0]} y2={earthBot[1]} stroke={C.dim} strokeWidth={1.2} strokeDasharray="5 4" />
        {/* Earth */}
        <circle cx={CX} cy={CY} r={RE} fill={C.earth} stroke={C.lineStrong} />
        <path d={polyPath(Array.from({ length: 73 }, (_, i) => { const v = equator(i * 5); return dot(v, cam) >= 0 ? P(v, RE) : null; }), 30)} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
        {/* Observer and their patch of ground */}
        <path d={patch} fill={C.land} fillOpacity={obsFront ? 0.85 : 0.35} stroke={C.good} strokeOpacity={obsFront ? 1 : 0.4} />
        <line x1={obs[0]} y1={obs[1]} x2={zen[0]} y2={zen[1]} stroke={C.amber} strokeWidth={1.6} opacity={obsFront ? 1 : 0.45} markerEnd="url(#fig-arrow)" />
        <circle cx={obs[0]} cy={obs[1]} r={4} fill={C.amber} opacity={obsFront ? 1 : 0.5} />
        {/* Axis in front */}
        <line x1={earthTop[0]} y1={earthTop[1]} x2={ncp[0]} y2={ncp[1]} stroke={C.text} strokeWidth={1.4} />
        <circle cx={ncp[0]} cy={ncp[1]} r={4} fill={C.amber} />
        <circle cx={scp[0]} cy={scp[1]} r={3} fill={C.dim} />
        {/* Spin arrow around the axis above Earth */}
        <path d={polyPath(Array.from({ length: 31 }, (_, i) => { const s = camAz - 150 + i * 6; return P([0.28 * cosd(s), 0.28 * sind(s), 0.36], R); }), 50)} fill="none" stroke={C.amber} strokeWidth={1.6} markerEnd="url(#fig-arrow)" />
        {/* Front half */}
        <path d={ring(equator, true)} fill="none" stroke={C.blue} strokeWidth={1.4} />
        <path d={ring(horizon, true)} fill="none" stroke={C.good} strokeWidth={2.2} />
        {figures.map((l, i) => {
          const pts = l.filter((v) => dot(v, cam) >= 0);
          if (pts.length < 2) return null;
          return <path key={i} d={polyPath(pts.map((v) => P(v)), 120)} fill="none" stroke={C.blue} strokeWidth={1} opacity={0.6} />;
        })}
        <g>{starEl(true)}</g>
        {dot(radec(ORION.ra, ORION.dec), cam) > 0 && <Label x={oriP[0] + 10} y={oriP[1] + 22} size="s" color={ori.alt > 0 ? C.text : C.dim}>Orion</Label>}
        {dot(radec(T2.ra, T2.dec), cam) > 0 && <Label x={dipP[0] + 10} y={dipP[1] - 10} size="s" color={dip.alt > 0 ? C.text : C.dim}>{sgn > 0 ? 'Big Dipper' : 'Southern Cross'}</Label>}

        <Callout from={ncp} to={[ncp[0] + 70, 26]} label="North celestial pole" note="Polaris sits less than 1° from it" color={C.amber} />
        <Callout from={scp} to={[scp[0] + 60, H - 36]} label="South celestial pole" note={sgn < 0 ? 'no bright star marks it' : undefined} />
        {(() => { const z = P(n); if (dot(n, cam) < -0.1 || Math.hypot(z[0] - CX, z[1] - CY) < RE + 50) return null; return <g><circle cx={z[0]} cy={z[1]} r={6} fill="none" stroke={C.amber} strokeWidth={1.5} /><Label x={z[0] + 9} y={z[1] - 7} size="s" color={C.amber}>your zenith</Label></g>; })()}
        <Callout from={P(equator(camAz - 70))} to={[18, 300]} label="Celestial equator" note="above Earth’s equator" color={C.blue} />
        <Callout from={P(horizon(obsFront ? 200 : 20))} to={[W - 200, 300]} label="Your horizon, extended" note="stars above it are up (bright)" color={C.good} />
        <Callout from={[obs[0], obs[1]]} to={[18, 120]} label={`You, in ${placeName(obs0)}`} note={obsFront ? 'arrow points to your zenith' : 'now on the far side of Earth'} color={C.amber} />
        <Label x={CX + 64} y={CY - 76} size="s" color={C.amber}>Earth spins west → east</Label>
        <Label x={12} y={H - 10} size="s" color={C.faint}>Not to scale: the stars are vastly farther away</Label>
      </Svg>
      <Controls>
        <RangeControl label="Time" value={hours} min={0} max={24} step={0.25} onChange={(v) => { setPlaying(false); setHours(v); }} format={clock} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} label="Spin Earth" />
      </Controls>
      <Readout>
        {`${clock(hours)}: Earth has turned ${Math.round(hours * 15)}° since 7 pm. Orion is ${where(ori)}; ${T2.name} is ${where(dip)}. `}
        {hours < 0.3 ? 'Press Spin Earth: the stars stay where they are and your horizon tips across them.' : 'The stars have not moved at all: your horizon has.'}
      </Readout>
    </div>
  );
}
