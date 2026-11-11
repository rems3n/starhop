/**
 * Side view of the sky along the meridian (south on the left, north on the right) for any latitude.
 * The celestial pole stands at an altitude equal to the latitude; every star's daily circle is seen edge-on
 * as a line parallel to the celestial equator. Shaded: the circumpolar cap (never sets) and the cap that
 * never rises. Follow a real star to see how many hours it is up and how high it climbs.
 */
import { useMemo, useState } from 'react';
import { useCatalog } from '@/data/catalog';
import { C, Callout, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { cosd, culmination, fmtLat, hoursAbove, lowestAlt, placeName, placeOf, placeOptions, sind, useObserver } from './_motion-sky';

export const meta: DiagramMeta = {
  title: 'Never sets, rises and sets, never rises',
  summary: 'Meridian side view with the celestial pole at an altitude equal to the latitude; shaded circumpolar and never-rises zones; follow a real star. Latitude slider and place presets.',
  params: { lat: 'starting latitude (default: the learner’s location)', star: 'star to follow: Polaris | Capella | Vega | Antares | Canopus | Acrux | none (default none)' },
};

const W = 720, H = 410;
const OX = 360, OY = 210, R = 150;
/** Declinations (J2000) used until the catalog loads; the catalog values replace them. */
const STARS: Record<string, number> = { Polaris: 89.26, Capella: 46.0, Vega: 38.78, Antares: -26.43, Canopus: -52.7, Acrux: -63.1 };
type StarName = keyof typeof STARS | 'none';

const pt = (a: number, r = R): [number, number] => [OX + r * cosd(a), OY - r * sind(a)];

export default function SkyZonesLatitude({ params }: DiagramProps) {
  const obs = useObserver();
  const cat = useCatalog();
  const [lat, setLat] = useState<number>(typeof params?.lat === 'number' ? (params.lat as number) : Math.round(obs.lat * 10) / 10);
  const [star, setStar] = useState<StarName>(typeof params?.star === 'string' && (params.star in STARS || params.star === 'none') ? (params.star as StarName) : 'none');
  const opts = placeOptions(obs);

  const decs = useMemo(() => {
    const d = { ...STARS };
    if (cat) for (const k of Object.keys(d)) { const s = cat.stars.find((x) => x.name === k); if (s) d[k] = s.dec; }
    return d;
  }, [cat]);

  const a = Math.abs(lat);
  const north = lat >= 0;
  const aUp = north ? lat : 180 + lat; // angle (from the north horizon, counter-clockwise) of the pole above the horizon
  const limit = 90 - a; // circumpolar declination limit (in the visible pole's direction)
  const seg = (center: number, half: number) => {
    const [x0, y0] = pt(center - half), [x1, y1] = pt(center + half);
    return `M ${x0} ${y0} A ${R} ${R} 0 0 0 ${x1} ${y1} Z`;
  };
  // Daily circle of declination d, edge-on: chord between the two meridian crossings.
  const chord = (d: number): [[number, number], [number, number]] => [pt(lat + 90 - d), pt(lat - 90 + d)];
  const eq = chord(0);
  const ncp = pt(lat), scp = pt(lat + 180);

  const sd = star === 'none' ? null : decs[star];
  let starEl: JSX.Element | null = null;
  let starText = '';
  if (sd !== null) {
    const [A, B] = chord(sd);
    const n = 60;
    const above: string[] = [], below: string[] = [];
    for (let i = 0; i <= n; i++) {
      const x = A[0] + ((B[0] - A[0]) * i) / n, y = A[1] + ((B[1] - A[1]) * i) / n;
      (y <= OY + 0.01 ? above : below).push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const top = culmination(sd, lat);
    const low = lowestAlt(sd, lat);
    const up = A[1] < B[1] ? A : B;
    starEl = (
      <g>
        {below.length > 1 && <polyline points={below.join(' ')} fill="none" stroke={C.amber} strokeWidth={2} strokeDasharray="5 4" opacity={0.6} />}
        {above.length > 1 && <polyline points={above.join(' ')} fill="none" stroke={C.amber} strokeWidth={3} />}
        <circle cx={up[0]} cy={up[1]} r={5.5} fill={C.amber} stroke={C.bg} strokeWidth={1.5} />
        <Label x={up[0] + (up[0] < OX ? -10 : 10)} y={up[1] < OY - R + 30 ? up[1] + 20 : up[1] - 8} anchor={up[0] < OX ? 'end' : 'start'} color={C.amber} weight={700}>{star}</Label>
      </g>
    );
    const name = `${star} (declination ${sd > 0 ? '+' : '−'}${Math.abs(sd).toFixed(1)}°)`;
    if (low > 0) starText = `${name} never sets here: it circles the pole, ${top.alt.toFixed(0)}° up at its highest and still ${low.toFixed(0)}° up at its lowest.`;
    else if (top.alt < 0) {
      const need = sd < 0 ? sd + 90 : sd - 90;
      starText = `${name} never rises here. You would have to go ${sd < 0 ? 'south' : 'north'} of latitude ${fmtLat(need)} to see it.`;
    } else starText = `${name} rises and sets: it is above the horizon about ${hoursAbove(sd, lat).toFixed(1)} hours of every 24 and climbs to ${top.alt.toFixed(0)}° ${top.side === 'overhead' ? '(overhead)' : `in the ${top.side}`}.`;
  }

  const capFrac = (1 - cosd(a)) / 2;
  const zoneText =
    a < 0.5
      ? 'On the equator both poles lie on the horizon: no star is circumpolar and none is hidden for ever. Every star is up for 12 hours a day.'
      : a > 89.5
        ? `At the ${north ? 'North' : 'South'} Pole the celestial pole is overhead: the half of the sky above the horizon never sets and the other half never rises.`
        : `At ${fmtLat(lat)} the ${north ? 'north' : 'south'} celestial pole is ${a.toFixed(1)}° up. Stars within ${a.toFixed(1)}° of it (declination ${north ? 'above +' : 'below −'}${limit.toFixed(1)}°) never set; stars within ${a.toFixed(1)}° of the other pole never rise. Each cap is ${Math.round(capFrac * 100)}% of the sky.`;

  const poleLabelR = R + 14;
  return (
    <div>
      <Svg w={W} h={H} title={meta.title} desc={`Side view of the sky from latitude ${fmtLat(lat)}: a circle cut by the horizon, the celestial pole ${a.toFixed(0)}° above the ${north ? 'north' : 'south'} horizon, the celestial equator perpendicular to the pole’s direction, a shaded cap of stars that never set and an opposite cap of stars that never rise.`}>
        {/* Below the horizon */}
        <path d={`M ${OX - R} ${OY} A ${R} ${R} 0 0 0 ${OX + R} ${OY} Z`} fill="#141a2e" />
        <circle cx={OX} cy={OY} r={R} fill="none" stroke={C.lineStrong} />
        {a > 0.3 && <path d={seg(aUp, a)} fill={C.blue} fillOpacity={0.25} stroke={C.blue} strokeOpacity={0.6} />}
        {a > 0.3 && <path d={seg(aUp + 180, a)} fill={C.bad} fillOpacity={0.16} stroke={C.bad} strokeOpacity={0.4} />}
        {/* Some daily circles, edge-on */}
        {[-60, -30, 30, 60].map((d) => { const [p, q] = chord(d); return <line key={d} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={C.line} strokeDasharray="2 4" />; })}
        <line x1={eq[0][0]} y1={eq[0][1]} x2={eq[1][0]} y2={eq[1][1]} stroke={C.blue} strokeWidth={2} />
        {/* Horizon */}
        <line x1={OX - R - 34} y1={OY} x2={OX + R + 34} y2={OY} stroke={C.good} strokeWidth={2} />
        <Label x={OX + R + 40} y={OY + 5} weight={700}>N</Label>
        <Label x={OX - R - 40} y={OY + 5} anchor="end" weight={700}>S</Label>
        {/* Polar axis */}
        <line x1={scp[0]} y1={scp[1]} x2={ncp[0]} y2={ncp[1]} stroke={C.dim} strokeWidth={1.2} strokeDasharray="6 4" />
        <circle cx={ncp[0]} cy={ncp[1]} r={4.5} fill={north ? C.amber : C.dim} />
        <circle cx={scp[0]} cy={scp[1]} r={4.5} fill={north ? C.dim : C.amber} />
        {/* Latitude angle at the observer */}
        {a > 2 && a < 89 && (() => {
          const r = 44;
          const a0 = north ? 0 : 180, a1 = aUp;
          const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
          const [lx, ly] = pt((a0 + a1) / 2, r + 20);
          return (
            <g>
              <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 ${north ? 0 : 1} ${x1} ${y1}`} fill="none" stroke={C.amber} strokeWidth={2} />
              <Label x={lx} y={ly + 5} anchor="middle" color={C.amber} weight={700}>{`${a.toFixed(1)}°`}</Label>
            </g>
          );
        })()}
        {starEl}
        <circle cx={OX} cy={OY} r={4} fill={C.text} />
        <Label x={OX} y={OY + 22} anchor="middle" size="s" color={C.dim}>you</Label>
        <Label x={OX} y={OY - R - 8} anchor="middle" size="s" color={C.dim}>zenith</Label>
        {/* Pole labels */}
        {[{ ang: lat, text: north ? 'N celestial pole (Polaris)' : 'N celestial pole', on: north }, { ang: lat + 180, text: 'S celestial pole', on: !north }].map((p) => {
          let [x, y] = pt(p.ang, poleLabelR);
          let anchor: 'start' | 'end' = x >= OX ? 'start' : 'end';
          if (Math.abs(y - OY) < 30) {
            // Pole close to the horizon: put the label inside the circle, clear of the N/S letters
            const [px, py] = pt(p.ang);
            anchor = px >= OX ? 'end' : 'start';
            x = px + (px >= OX ? -8 : 8);
            y = py <= OY ? Math.min(py, OY) - 12 : py + 22;
          } else {
            x += x >= OX ? 6 : -6;
            y += y < OY ? -2 : 12;
          }
          return <Label key={p.text} x={x} y={y} anchor={anchor} size="s" color={p.on ? C.amber : C.dim} weight={600}>{p.text}</Label>;
        })}
        {/* Zone callouts */}
        {a > 4 && (() => {
          const c = pt(aUp, R * 0.82);
          const right = c[0] >= OX;
          return <Callout from={c} to={[right ? W - 190 : 16, 44]} label="Never sets" note={`declination ${north ? 'above +' : 'below −'}${limit.toFixed(1)}°`} color={C.blue} />;
        })()}
        {a > 4 && (() => {
          const c = pt(aUp + 180, R * 0.82);
          const right = c[0] >= OX;
          return <Callout from={c} to={[right ? W - 190 : 16, H - 40]} label="Never rises" note={`declination ${north ? 'below −' : 'above +'}${limit.toFixed(1)}°`} color={C.bad} />;
        })()}
        {a < 86 && (() => {
          const [p, q] = chord(north ? -10 : 10);
          const m: [number, number] = [p[0] + (q[0] - p[0]) * 0.3, p[1] + (q[1] - p[1]) * 0.3];
          const left = north;
          return <Callout from={m} to={[left ? 16 : W - 190, 120]} label="Rises and sets" note="up for part of each day" />;
        })()}
        {(() => { const [x, y] = pt(lat - 90 + 14, R - 22); return <Label x={x} y={y} anchor="middle" size="s" color={C.blue}>celestial equator</Label>; })()}
      </Svg>
      <Controls>
        <RangeControl label="Latitude" value={lat} min={-90} max={90} step={0.1} onChange={setLat} format={fmtLat} />
        <ChoiceControl label="Go to" value={placeOf(lat, opts)} options={opts.map((o) => ({ value: o.value, label: o.value === 'you' ? placeName(obs) : o.label }))} onChange={(v) => setLat(opts.find((o) => o.value === v)!.lat)} />
        <ChoiceControl<StarName> label="Follow a star" value={star} options={[{ value: 'none', label: 'None' }, ...Object.keys(STARS).map((k) => ({ value: k as StarName, label: k }))]} onChange={setStar} />
      </Controls>
      <Readout>{`${zoneText}${starText ? ` ${starText}` : ''}`}</Readout>
    </div>
  );
}
