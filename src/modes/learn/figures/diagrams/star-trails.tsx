/**
 * "Hours of exposure": what a camera pointed at the visible celestial pole records with its shutter open,
 * from the learner's location (settings). Real stars (catalog, precessed to 2026) leave arcs around the pole;
 * every arc spans 15° per hour of exposure, whatever its size. Stereographic view centred on the pole.
 * Northern hemisphere: facing north, Polaris near the centre, counter-clockwise. Southern: facing south, no pole star, clockwise.
 */
import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '@/data/catalog';
import { C, Callout, Controls, Label, PlayButton, RangeControl, Readout, Svg, useAnimatedValue, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';
import { altAzToHaDec, clampN, cosd, hemi, localDate, lstDeg, placeName, polyPath, precessor, sind, tand, useObserver, wrap360 } from './_motion-sky';

export const meta: DiagramMeta = {
  title: 'Star trails: 15° an hour',
  summary: 'A long exposure aimed at the celestial pole from the learner’s location, drawn from real star positions; slide the exposure time and every trail grows by 15° per hour.',
  params: { hours: 'starting exposure in hours, 0–12 (default 4)', lat: 'observer latitude (default: settings)' },
};

const W = 720, H = 400;
const CX = 360, K = 240;
const SID = 15.041; // degrees per hour of clock time

/** Screen position of a point at polar distance p (deg from the visible pole) and hour angle h (deg, west +). */
const rOf = (p: number) => 2 * K * tand(p / 2);

export default function StarTrails({ params }: DiagramProps) {
  const reduced = usePrefersReducedMotion();
  const obs = useObserver();
  const lat = typeof params?.lat === 'number' ? (params.lat as number) : obs.lat;
  const sgn = hemi(lat);
  const [playing, setPlaying] = useState(false);
  const [hours, setHours] = useAnimatedValue(typeof params?.hours === 'number' ? (params.hours as number) : 4, playing, reduced ? 2 : 1.2);
  useEffect(() => { if (playing && hours >= 12) { setPlaying(false); setHours(12); } }, [playing, hours, setHours]);
  const cat = useCatalog();

  // Put the horizon near the bottom whatever the latitude.
  const CY = clampN(H - 50 - rOf(Math.abs(lat)), 150, 330);
  // Facing north, west is on the left; facing south, west is on the right.
  const xy = (p: number, h: number): [number, number] => [CX - sgn * rOf(p) * sind(h), CY - rOf(p) * cosd(h)];
  const arc = (p: number, h0: number, span: number): string => {
    const r = rOf(p);
    if (span >= 359.5) return `M ${CX - r} ${CY} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
    const [x0, y0] = xy(p, h0);
    const [x1, y1] = xy(p, h0 + span);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${span > 180 ? 1 : 0} ${sgn > 0 ? 0 : 1} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };

  const start = useMemo(() => localDate(2026, 1, 15, 21, obs.tz), [obs.tz]); // 9 pm local, 15 January
  const lst0 = useMemo(() => lstDeg(start, obs.lon), [start, obs.lon]);
  const stars = useMemo(() => {
    if (!cat) return [];
    const pre = precessor(start);
    return cat.stars
      .filter((s) => s.mag < 4.3 && sgn * s.dec > -30)
      .map((s) => {
        const q = pre(s.ra, s.dec);
        return { id: s.id, p: 90 - sgn * q.dec, h0: wrap360(lst0 - q.ra), mag: s.mag, bv: s.bv ?? 0.6, name: s.name };
      })
      .filter((s) => rOf(s.p) < 560);
  }, [cat, lst0, start, sgn]);

  const span = Math.min(12, Math.max(0, hours)) * SID;
  const horizon = useMemo(() => {
    const pts: [number, number][] = [];
    for (let a = -120; a <= 120; a += 2) {
      const { ha, dec } = altAzToHaDec(sgn > 0 ? a : 180 + a, 0, lat);
      pts.push(xy(90 - sgn * dec, ha));
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, CY]);
  const ground = `${polyPath(horizon, 999)} L ${W + 20} ${H + 20} L -20 ${H + 20} Z`;

  const dubhe = stars.find((s) => s.name === (sgn > 0 ? 'Dubhe' : 'Acrux')) ?? stars.find((s) => s.p > 15 && s.p < 40);
  const polaris = sgn > 0 ? stars.find((s) => s.name === 'Polaris') : undefined;
  const colour = (bv: number) => (bv < 0.15 ? '#cfe0ff' : bv > 1.1 ? '#ffc78a' : C.star);

  return (
    <div>
      <Svg w={W} h={H} title={meta.title} desc={`A camera view facing ${sgn > 0 ? 'north' : 'south'} from ${placeName(obs)}, aimed at the celestial pole. Every star has drawn an arc around that point, all arcs spanning the same angle.`}>
        <defs>
          <clipPath id="st-clip"><rect x={0} y={0} width={W} height={H} rx={10} /></clipPath>
        </defs>
        <g clipPath="url(#st-clip)">
          <rect x={0} y={0} width={W} height={H} fill="#0b1030" />
          {stars.map((s) => {
            const w = Math.max(0.6, 2.4 - 0.45 * s.mag);
            const op = Math.min(1, Math.max(0.35, 1.15 - 0.17 * s.mag));
            const [x, y] = xy(s.p, s.h0 + span);
            return (
              <g key={s.id}>
                {span > 0.2 && <path d={arc(s.p, s.h0, span)} fill="none" stroke={colour(s.bv)} strokeWidth={w} strokeOpacity={op * 0.85} strokeLinecap="round" />}
                <circle cx={x} cy={y} r={w * 0.9 + 0.4} fill={colour(s.bv)} opacity={op} />
              </g>
            );
          })}
          {/* The angle every trail sweeps, shown on Dubhe */}
          {dubhe && span > 4 && (() => {
            const a = xy(dubhe.p, dubhe.h0), b = xy(dubhe.p, dubhe.h0 + span);
            const r = 46;
            const pOf = (px: number) => (2 * Math.atan(px / (2 * K)) * 180) / Math.PI;
            const s0 = xy(pOf(r), dubhe.h0);
            const s1 = xy(pOf(r), dubhe.h0 + span);
            const mid = xy(pOf(r + 22), dubhe.h0 + span / 2);
            return (
              <g>
                <line x1={CX} y1={CY} x2={a[0]} y2={a[1]} stroke={C.amber} strokeDasharray="4 4" strokeWidth={1.2} />
                <line x1={CX} y1={CY} x2={b[0]} y2={b[1]} stroke={C.amber} strokeDasharray="4 4" strokeWidth={1.2} />
                <path d={`M ${s0[0]} ${s0[1]} A ${r} ${r} 0 ${span > 180 ? 1 : 0} ${sgn > 0 ? 0 : 1} ${s1[0]} ${s1[1]}`} fill="none" stroke={C.amber} strokeWidth={2} />
                <Label x={mid[0]} y={mid[1] + 5} anchor="middle" color={C.amber} weight={700}>{`${Math.round(span)}°`}</Label>
              </g>
            );
          })()}
          <path d={ground} fill="#141a2e" stroke={C.lineStrong} strokeWidth={1} />
          {(sgn > 0 ? [[-45, 'NW'], [0, 'N'], [45, 'NE']] : [[135, 'SE'], [180, 'S'], [225, 'SW']]).map(([az, name]) => {
            const { ha, dec } = altAzToHaDec(az as number, 0, lat);
            const [x, y] = xy(90 - sgn * dec, ha);
            return x > 20 && x < W - 20 && y < H - 8 ? <Label key={name} x={x} y={Math.min(H - 10, y + 22)} anchor="middle" size="s" color={C.dim}>{name}</Label> : null;
          })}
        </g>
        {polaris ? <Callout from={[CX, CY]} to={[CX + 120, 34]} label="Polaris" note={`a tiny arc: it is ${polaris.p.toFixed(1)}° from the pole`} color={C.amber} />
          : <Callout from={[CX, CY]} to={[CX + 120, 34]} label="South celestial pole" note="no bright star marks it" color={C.amber} />}
        {dubhe && (() => { const d = xy(dubhe.p, dubhe.h0 + span); return <Callout from={d} to={[d[0] < CX ? 16 : W - 150, d[1] < 120 ? 150 : 70]} label={dubhe.name ?? 'A bright star'} note={dubhe.name === 'Dubhe' ? 'Big Dipper’s pointer' : dubhe.name === 'Acrux' ? 'foot of the Southern Cross' : undefined} />; })()}
        <Label x={W - 12} y={H - 12} anchor="end" size="s" color={C.dim}>{`Facing ${sgn > 0 ? 'north' : 'south'} from ${placeName(obs)}, from 9 pm, 15 Jan`}</Label>
      </Svg>
      <Controls>
        <RangeControl label="Exposure" value={hours} min={0} max={12} step={0.25} onChange={(v) => { setPlaying(false); setHours(v); }} format={(v) => (v === 0 ? 'shutter closed' : `${+v.toFixed(2)} h`)} />
        <PlayButton playing={playing} onToggle={() => { if (hours >= 12) setHours(0); setPlaying((p) => !p); }} label="Open the shutter" />
      </Controls>
      <Readout>
        {hours < 0.1
          ? 'Shutter closed: the stars are points. Open it and watch every star draw an arc around the same spot.'
          : `${+hours.toFixed(2)} hour${hours === 1 ? '' : 's'} of exposure: every trail is an arc of about ${Math.round(span)}° around the celestial pole, 15° for each hour. ` +
            (hours >= 11.9 ? 'Half a day: the sky has turned halfway round. In reality dawn would end the exposure first.' : 'Trails near the pole are short and tight; trails far out are long, but they all span the same angle.')}
      </Readout>
    </div>
  );
}
