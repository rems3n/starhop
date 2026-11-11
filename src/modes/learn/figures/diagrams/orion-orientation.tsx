/**
 * The same constellation from the two hemispheres. Two panels show Orion (real stick figure from the catalog)
 * above the horizon, facing the way you must face to see it: from the learner's place and from a place in
 * the other hemisphere (Sydney, or London for southern learners). A slider moves time either side of the
 * moment Orion is highest, showing the opposite drift (left-to-right in the north, right-to-left in the south).
 */
import { useMemo, useState } from 'react';
import { useCatalog } from '@/data/catalog';
import { C, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { culmination, fmtLat, hadecToEnu, makeStereo, placeName, polyPath, useObserver, wrap360 } from './_motion-sky';

export const meta: DiagramMeta = {
  title: 'Orion from both hemispheres',
  summary: 'Orion drawn from real positions as seen from the learner’s place and from the other hemisphere, side by side; a time slider shows the drift in opposite directions.',
  params: { hours: 'hours from when Orion is highest, −5 to 5 (default 0)' },
};

const W = 720, H = 400, PW = 350, K = 270;
const ORI_RA = 83.8; // centre of the figure (J2000), between the Belt and Betelgeuse

export default function OrionOrientation({ params }: DiagramProps) {
  const obs = useObserver();
  const cat = useCatalog();
  const [hours, setHours] = useState<number>(typeof params?.hours === 'number' ? (params.hours as number) : 0);
  const other = obs.lat >= 0 ? { name: 'Sydney', lat: -33.9 } : { name: 'London', lat: 51.5 };
  const sites = [{ name: placeName(obs), lat: obs.lat }, other];

  const fig = useMemo(() => {
    if (!cat) return null;
    const ori = cat.constellations.find((c) => c.id === 'Ori');
    const named = ['Betelgeuse', 'Rigel', 'Bellatrix', 'Saiph', 'Alnitak', 'Alnilam', 'Mintaka', 'Meissa'].map((n) => cat.stars.find((s) => s.name === n)).filter((s): s is NonNullable<typeof s> => !!s);
    return { lines: ori?.lines ?? [], stars: named };
  }, [cat]);

  const panel = (site: { name: string; lat: number }, i: number) => {
    const ox = i * (PW + 20);
    const faceSouth = site.lat > 0; // Orion (declination about 0°) is highest due south from the north, due north from the south
    const azF = faceSouth ? 180 : 0;
    // The view follows Orion along the horizon so the figure stays in frame; the compass labels show where you face.
    const cen = hadecToEnu(wrap360(hours * 15.041), 0, site.lat);
    const azC = (Math.atan2(cen[0], cen[1]) * 180) / Math.PI;
    const proj = makeStereo(azC, 40, K, ox + PW / 2, 175);
    const P = (ra: number, dec: number): [number, number] | null => {
      const v = hadecToEnu(wrap360(hours * 15.041 + ORI_RA - ra), dec, site.lat);
      if (v[2] < -0.02) return null;
      const [x, y, d] = proj(v);
      return d > 0 ? [x, y] : null;
    };
    const horizon = Array.from({ length: 121 }, (_, k) => { const az = azC - 90 + k * 1.5; const [x, y, d] = proj([Math.sin((az * Math.PI) / 180), Math.cos((az * Math.PI) / 180), 0]); return d > 0 ? ([x, y] as [number, number]) : null; });
    const top = culmination(0, site.lat);
    const lab = (dAz: number, t: string) => { const az = azF + dAz; const [x, y] = proj([Math.sin((az * Math.PI) / 180), Math.cos((az * Math.PI) / 180), 0]); return <Label key={t} x={x} y={Math.min(H - 8, y + 20)} anchor="middle" size={dAz === 0 ? 'm' : 's'} weight={dAz === 0 ? 700 : 500} color={dAz === 0 ? C.text : C.dim}>{t}</Label>; };
    const westRight = faceSouth;
    return (
      <g key={i}>
        <defs><clipPath id={`oo-clip-${i}`}><rect x={ox} y={0} width={PW} height={H} rx={10} /></clipPath></defs>
        <g clipPath={`url(#oo-clip-${i})`}>
          <rect x={ox} y={0} width={PW} height={H} fill="#0b1030" />
          {fig?.lines.map((l, j) => <path key={j} d={polyPath(l.map(([ra, dec]) => P(ra, dec)), 200)} fill="none" stroke={C.blue} strokeWidth={1.6} opacity={0.8} />)}
          {fig?.stars.map((s) => {
            const p = P(s.ra, s.dec);
            if (!p) return null;
            const big = s.name === 'Betelgeuse' || s.name === 'Rigel';
            return (
              <g key={s.id}>
                <circle cx={p[0]} cy={p[1]} r={Math.max(2, 5 - s.mag * 1.2)} fill={s.name === 'Betelgeuse' ? '#ffb27a' : s.name === 'Rigel' ? '#cfe0ff' : C.star} />
                {big && <Label x={p[0] + 9} y={p[1] + 4} size="s" weight={600}>{s.name}</Label>}
                {s.name === 'Meissa' && <Label x={p[0] - 8} y={p[1] + 4} anchor="end" size="s" color={C.dim}>head</Label>}
              </g>
            );
          })}
          <path d={`${polyPath(horizon, 400)} L ${ox + PW + 10} ${H + 10} L ${ox - 10} ${H + 10} Z`} fill="#141a2e" stroke={C.good} strokeWidth={1.5} />
          {lab(0, faceSouth ? 'S' : 'N')}
          {lab(-45, faceSouth ? 'SE' : 'NW')}
          {lab(45, faceSouth ? 'SW' : 'NE')}
          {lab(-90, faceSouth ? 'E' : 'W')}
          {lab(90, faceSouth ? 'W' : 'E')}
        </g>
        <rect x={ox} y={0} width={PW} height={H} rx={10} fill="none" stroke={C.line} />
        <Label x={ox + 14} y={24} weight={700}>{`${site.name} (${fmtLat(site.lat)})`}</Label>
        <Label x={ox + 14} y={42} size="s" color={C.dim}>{`facing ${faceSouth ? 'south' : 'north'}; Orion peaks ${top.alt.toFixed(0)}° up`}</Label>
        <line x1={ox + PW / 2 + (westRight ? -30 : 30)} x2={ox + PW / 2 + (westRight ? 30 : -30)} y1={H - 92} y2={H - 92} stroke={C.amber} strokeWidth={1.8} markerEnd="url(#fig-arrow)" />
        <Label x={ox + PW / 2} y={H - 74} anchor="middle" size="s" color={C.amber}>{`drifts ${westRight ? 'left to right' : 'right to left'}`}</Label>
      </g>
    );
  };

  const t = Math.abs(hours) < 0.01 ? 'at its highest' : `${Math.abs(hours).toFixed(1).replace(/\.0$/, '')} h ${hours < 0 ? 'before' : 'after'} its highest`;
  return (
    <div>
      <Svg w={W} h={H} title={meta.title} desc={`Two views of Orion ${t}: from ${sites[0].name} and from ${sites[1].name}. From the northern hemisphere you face south and Orion stands with his head (Betelgeuse side) up; from the southern hemisphere you face north and he appears upside down.`}>
        {sites.map(panel)}
      </Svg>
      <Controls>
        <RangeControl label="Time" value={hours} min={-4} max={4} step={0.25} onChange={setHours} format={(v) => (Math.abs(v) < 0.01 ? 'Orion at its highest' : `${Math.abs(v)} h ${v < 0 ? 'before' : 'after'}`)} />
      </Controls>
      <Readout>
        {`Orion ${t}. In the northern hemisphere you face south to see him: his head and Betelgeuse are at the top, Rigel at the bottom, and he drifts left to right. In the southern hemisphere you face north: you are standing the other way up on the globe, so he appears upside down, Rigel on top, drifting right to left. The stars are the same; only your footing changed.`}
      </Readout>
    </div>
  );
}
