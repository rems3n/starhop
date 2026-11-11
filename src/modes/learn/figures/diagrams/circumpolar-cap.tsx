/**
 * The circumpolar cap for the learner's latitude: a view toward the visible celestial pole with real
 * constellation figures (catalog), the "never sets" circle (radius = latitude) touching the horizon, and a
 * month slider showing the sky at 9 pm local time on the 15th. Circumpolar figures only change position.
 */
import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '@/data/catalog';
import { C, Callout, Controls, Label, PlayButton, RangeControl, Readout, Svg, useAnimatedValue, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';
import { altAzToHaDec, clampN, cosd, fmtLat, hemi, localDate, lowestAlt, lstDeg, placeName, polyPath, precessor, sind, tand, useObserver, wrap180, wrap360 } from './_motion-sky';

export const meta: DiagramMeta = {
  title: 'The sky that never sets',
  summary: 'View toward the celestial pole with real constellation figures and the never-sets circle for the learner’s latitude; a month slider turns the 9 pm sky through the year.',
  params: { month: 'starting month 1–12 (default 10, October)' },
};

const W = 720, H = 420, CX = 360, K = 200;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const NORTH = ['UMi', 'UMa', 'Cas', 'Cep', 'Dra', 'Cam', 'Per', 'Aur', 'Lyr', 'Cyg', 'Lyn', 'CVn'];
const SOUTH = ['Cru', 'Cen', 'Car', 'Oct', 'Hyi', 'Tuc', 'Pav', 'Mus', 'Vol', 'Dor', 'TrA', 'Ara', 'Vel'];
const DISPLAY: Record<string, string> = { UMa: 'Ursa Major', UMi: 'Little Dipper', Cru: 'Southern Cross' };
const rOf = (p: number) => 2 * K * tand(Math.min(p, 170) / 2);

export default function CircumpolarCap({ params }: DiagramProps) {
  const obs = useObserver();
  const cat = useCatalog();
  const reduced = usePrefersReducedMotion();
  const lat = obs.lat;
  const sgn = hemi(lat);
  const a = Math.abs(lat);
  const [playing, setPlaying] = useState(false);
  const [m, setM] = useAnimatedValue(typeof params?.month === 'number' ? (params.month as number) : 10, playing, reduced ? 1 : 0.8, [1, 13]);
  const month = Math.floor(m);
  useEffect(() => { if (!playing) setM(Math.round(m) > 12 ? 1 : Math.round(m)); }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const CY = clampN(H - 60 - rOf(a), 120, 330);
  const xy = (p: number, h: number): [number, number] => [CX - sgn * rOf(p) * sind(h), CY - rOf(p) * cosd(h)];

  // 9 pm local time on the 15th; fractional month moves smoothly while playing.
  const date = useMemo(() => {
    const d0 = localDate(2026, month > 12 ? 1 : month, 15, 21, obs.tz).getTime();
    return new Date(d0 + (m - month) * 30.44 * 86400000);
  }, [m, month, obs.tz]);
  const lst = lstDeg(date, obs.lon);
  const pre = useMemo(() => precessor(new Date(Date.UTC(2026, 6, 1))), []);

  const data = useMemo(() => {
    if (!cat) return null;
    const ids = sgn > 0 ? NORTH : SOUTH;
    const cons = cat.constellations
      .filter((c) => sgn * c.dec > -10)
      .map((c) => {
        const figs = c.figureStars.map((id) => cat.starById.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
        const inside = figs.filter((s) => sgn * s.dec > 90 - a).length / Math.max(1, figs.length);
        return { id: c.id, name: c.name, ra: c.ra, dec: c.dec, lines: c.lines.map((l) => l.map(([ra, dec]) => pre(ra, dec))), inside, named: ids.includes(c.id) };
      });
    const stars = cat.stars.filter((s) => s.mag < 4.6 && sgn * s.dec > -15).map((s) => ({ ...pre(s.ra, s.dec), mag: s.mag, id: s.id, name: s.name }));
    return { cons, stars };
  }, [cat, sgn, a, pre]);

  const ha = (ra: number) => wrap360(lst - ra);
  const P = (q: { ra: number; dec: number }) => xy(90 - sgn * q.dec, ha(q.ra));
  const horizon = useMemo(() => {
    const pts: [number, number][] = [];
    for (let t = -130; t <= 130; t += 2) {
      const { ha: h, dec } = altAzToHaDec(sgn > 0 ? t : 180 + t, 0, lat);
      pts.push([CX - sgn * rOf(90 - sgn * dec) * sind(h), CY - rOf(90 - sgn * dec) * cosd(h)]);
    }
    return pts;
  }, [lat, sgn, CY]);

  // Reference figure: the Big Dipper (Megrez) in the north, the Southern Cross in the south.
  const ref = sgn > 0 ? { ra: 183.86, dec: 57.03, name: 'the Big Dipper', pole: 'Polaris' } : { ra: 186.8, dec: -60.0, name: 'the Southern Cross', pole: 'the south celestial pole' };
  const h = wrap180(ha(ref.ra));
  const sideW = sgn > 0 ? 'left' : 'right'; // west side of the picture
  const pos = Math.abs(h) < 30 ? `high above ${ref.pole}` : Math.abs(h) > 150 ? `low, below ${ref.pole}` : h > 0 ? `to the ${sideW} of ${ref.pole} (west), heading down` : `to the ${sideW === 'left' ? 'right' : 'left'} of ${ref.pole} (east), climbing`;
  const circ = data?.cons.filter((c) => c.named && c.inside >= 0.999).map((c) => DISPLAY[c.id] ?? c.name) ?? [];
  const partly = data?.cons.filter((c) => c.named && c.inside >= 0.5 && c.inside < 0.999).map((c) => DISPLAY[c.id] ?? c.name) ?? [];
  const alkaid = data?.stars.find((s) => s.name === 'Alkaid');

  return (
    <div>
      <Svg w={W} h={H} title={meta.title} desc={`View toward the ${sgn > 0 ? 'north' : 'south'} celestial pole from ${placeName(obs)} at 9 pm in ${MONTHS[(month - 1) % 12]}, with constellation figures and a dashed circle around the pole that touches the horizon: everything inside it never sets.`}>
        <defs><clipPath id="cc-clip"><rect x={0} y={0} width={W} height={H} rx={10} /></clipPath></defs>
        <g clipPath="url(#cc-clip)">
          <rect x={0} y={0} width={W} height={H} fill="#0b1030" />
          {a > 1 && <circle cx={CX} cy={CY} r={rOf(a)} fill={C.blue} fillOpacity={0.08} stroke={C.blue} strokeWidth={1.6} strokeDasharray="7 5" />}
          {data?.cons.map((c) => (
            <g key={c.id} opacity={c.inside >= 0.5 ? 1 : 0.45}>
              {c.lines.map((l, i) => <path key={i} d={polyPath(l.map((q) => (90 - sgn * q.dec < 120 ? P(q) : null)), 160)} fill="none" stroke={c.inside >= 0.999 ? C.blue : C.lineStrong} strokeWidth={c.inside >= 0.5 ? 1.5 : 1} />)}
            </g>
          ))}
          {data?.stars.map((s) => { const [x, y] = P(s); return <circle key={s.id} cx={x} cy={y} r={Math.max(0.8, 3.3 - 0.6 * s.mag)} fill={C.star} />; })}
          {data?.cons.filter((c) => c.named).map((c) => {
            const [x, y] = P(c);
            if (x < 40 || x > W - 40 || y < 16 || y > H - 20) return null;
            return <Label key={c.id} x={x} y={y + 18} anchor="middle" size="s" color={c.inside >= 0.999 ? C.text : C.dim} weight={c.inside >= 0.999 ? 600 : 400}>{DISPLAY[c.id] ?? c.name}</Label>;
          })}
          <path d={`${polyPath(horizon, 999)} L ${W + 20} ${H + 20} L -20 ${H + 20} Z`} fill="#141a2e" fillOpacity={0.94} stroke={C.good} strokeWidth={1.5} />
          {(() => { const [x, y] = horizon[Math.floor(horizon.length / 2)]; return <Label x={x} y={Math.min(H - 10, y + 22)} anchor="middle" weight={700}>{sgn > 0 ? 'N' : 'S'}</Label>; })()}
        </g>
        <circle cx={CX} cy={CY} r={4} fill={C.amber} />
        {a > 1 && <Callout from={[CX + rOf(a) * 0.707, CY - rOf(a) * 0.707]} to={[W - 196, 30]} label="Never-sets circle" note={`radius ${a.toFixed(1)}° = your latitude`} color={C.blue} />}
        {sgn > 0 && alkaid && (() => { const [x, y] = P(alkaid); return x > 0 && x < W && y < H - 20 ? <Callout from={[x, y]} to={[x < CX ? 16 : W - 150, y > CY ? H - 60 : 70]} label="Alkaid" note="end of the handle" /> : null; })()}
        <Label x={16} y={26} size="s" color={C.dim}>{`9 pm, 15 ${MONTHS[(month - 1) % 12]}, ${placeName(obs)}`}</Label>
      </Svg>
      <Controls>
        <RangeControl label="Month" value={Math.min(12, Math.round(m))} min={1} max={12} step={1} onChange={(v) => { setPlaying(false); setM(v); }} format={(v) => MONTHS[v - 1]} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} label="Play the year" />
      </Controls>
      <Readout>
        {a < 1
          ? 'On the equator nothing is circumpolar: every constellation spends part of each day below the horizon.'
          : `From ${fmtLat(lat)}, ${circ.length ? `${circ.join(', ')} ${circ.length > 1 ? 'are' : 'is'} entirely inside the circle` : 'none of the labelled figures is entirely inside the circle'}${partly.length ? `; ${partly.join(', ')} ${partly.length > 1 ? 'are' : 'is'} mostly inside` : ''}. At 9 pm in ${MONTHS[(month - 1) % 12]} ${ref.name} is ${pos}.` +
            (sgn > 0 && alkaid ? ` Alkaid, at the end of its handle, dips to ${lowestAlt(alkaid.dec, lat).toFixed(1)}° at its lowest${lowestAlt(alkaid.dec, lat) < 1 && lowestAlt(alkaid.dec, lat) > -1 ? ': it just grazes the horizon' : ''}.` : '')}
      </Readout>
    </div>
  );
}
