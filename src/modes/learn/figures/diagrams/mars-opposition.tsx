/**
 * Mars near and far. A date slider (2025–2036) moves Earth and Mars on their orbits (heliocentric ecliptic positions
 * from astronomy-engine); beside it Mars is drawn at its true relative apparent size, with its magnitude. A strip
 * of the oppositions in that span shows how close (and so how big) Mars gets at each one.
 */
import { useEffect, useMemo, useState } from 'react';
import { Body, EclipticLongitude, HelioDistance, Illumination, SearchRelativeLongitude } from 'astronomy-engine';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, rad, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';
import { fmt } from './_objects-lib';

export const meta: DiagramMeta = {
  title: 'Mars near and far',
  summary: 'Slide through 2025–2035 to see Earth overtake Mars every 26 months, and Mars’s apparent size and brightness swell at each opposition.',
  params: { start: 'starting date as YYYY-MM (default the next opposition)' },
};

const DAY = 86400e3;
const T0 = Date.UTC(2025, 0, 1), T1 = Date.UTC(2036, 0, 1);
const MARS_R = 3389.5, AU = 1.495978707e8;
const arcsec = (au: number) => (2 * Math.atan(MARS_R / (au * AU)) * 180 * 3600) / Math.PI;

export default function MarsOpposition({ params }: DiagramProps) {
  const reduced = usePrefersReducedMotion();
  const opps = useMemo(() => {
    const out: { date: Date; dist: number; mag: number }[] = [];
    let t = new Date(T0);
    for (let i = 0; i < 8; i++) {
      const o = SearchRelativeLongitude(Body.Mars, 0, t).date;
      if (o.getTime() > T1) break;
      const il = Illumination(Body.Mars, o);
      out.push({ date: o, dist: il.geo_dist, mag: il.mag });
      t = new Date(o.getTime() + 60 * DAY);
    }
    return out;
  }, []);
  const startDay = (() => {
    const m = typeof params?.start === 'string' ? /^(\d{4})-(\d{2})$/.exec(params.start as string) : null;
    if (m) return Math.round((Date.UTC(+m[1], +m[2] - 1, 1) - T0) / DAY);
    const next = opps.find((o) => o.date.getTime() > Date.now()) ?? opps[0];
    return Math.round((next.date.getTime() - T0) / DAY);
  })();
  const span = Math.round((T1 - T0) / DAY);
  const [d, setD] = useState(Math.min(span, Math.max(0, startDay)));
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setD((v) => { const n = v + (reduced ? 60 : 6); if (n >= span) { setPlaying(false); return span; } return n; }), reduced ? 500 : 50);
    return () => clearInterval(id);
  }, [playing, reduced, span]);

  const date = new Date(T0 + d * DAY);
  const il = Illumination(Body.Mars, date);
  const size = arcsec(il.geo_dist);
  const lm = rad(EclipticLongitude(Body.Mars, date)), le = rad(EclipticLongitude(Body.Earth, date));
  const rm = HelioDistance(Body.Mars, date), re = HelioDistance(Body.Earth, date);
  const SX = 160, SY = 196, S = 90;
  const m: [number, number] = [SX + Math.cos(lm) * rm * S, SY - Math.sin(lm) * rm * S];
  const e: [number, number] = [SX + Math.cos(le) * re * S, SY - Math.sin(le) * re * S];
  const orbit = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 687; i += 7) {
      const t = new Date(T0 + i * DAY);
      const l = rad(EclipticLongitude(Body.Mars, t)), r = HelioDistance(Body.Mars, t);
      pts.push(`${(SX + Math.cos(l) * r * S).toFixed(1)},${(SY - Math.sin(l) * r * S).toFixed(1)}`);
    }
    return `M ${pts.join(' L ')} Z`;
  }, []);
  const PX = 2.6; // px per arcsec in the eyepiece panel
  const fmtDate = (t: Date) => t.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const nearOpp = opps.find((o) => Math.abs(o.date.getTime() - date.getTime()) < 45 * DAY);
  const brightest = opps.reduce((a, o) => (o.mag < a.mag ? o : a), opps[0]);
  const faint = Math.pow(10, (il.mag - brightest.mag) / 2.5);

  return (
    <div>
      <Svg w={720} h={390} title={meta.title} desc="Left: the orbits of Earth and Mars around the Sun seen from above, with both planets at their positions on the chosen date and a line between them. Right: Mars drawn at its apparent size as seen in a telescope, and a row of small discs showing its size at each opposition from 2025 to 2035.">
        <Label x={SX} y={24} anchor="middle" weight={700}>From above, {fmtDate(date)}</Label>
        <path d={orbit} fill="none" stroke={C.line} strokeDasharray="4 4" />
        <circle cx={SX} cy={SY} r={S} fill="none" stroke={C.line} strokeDasharray="4 4" />
        <circle cx={SX} cy={SY} r={12} fill="url(#fig-glow)" />
        <circle cx={SX} cy={SY} r={7} fill={C.sun} />
        <line x1={e[0]} y1={e[1]} x2={m[0]} y2={m[1]} stroke={C.amber} strokeOpacity={0.7} />
        <circle cx={e[0]} cy={e[1]} r={6} fill={C.earth} />
        <circle cx={m[0]} cy={m[1]} r={5} fill="#d0714a" />
        <Label x={e[0] + 9} y={e[1] + 4} size="s" weight={700}>Earth</Label>
        <Label x={m[0] + 9} y={m[1] + 4} size="s" weight={700}>Mars</Label>
        <Label x={SX} y={372} anchor="middle" size="s" color={C.dim}>Earth–Mars: {il.geo_dist.toFixed(2)} AU ({fmt(Math.round((il.geo_dist * AU) / 1e6))} million km)</Label>

        <Label x={520} y={24} anchor="middle" weight={700}>Mars in a telescope</Label>
        <Label x={520} y={42} anchor="middle" size="s" color={C.dim}>true relative size · same scale as the row below</Label>
        <circle cx={520} cy={120} r={(size / 2) * PX} fill="#d0714a" />
        <Label x={520} y={196} anchor="middle" weight={600}>{size.toFixed(1)}″ across · magnitude {il.mag.toFixed(1)}</Label>
        <Label x={340} y={240} weight={700}>Oppositions, 2025–2035</Label>
        <Label x={340} y={256} size="s" color={C.dim}>Earth overtakes Mars about every 26 months</Label>
        {opps.map((o, i) => {
          const x = 360 + i * 64;
          const on = nearOpp === o;
          return (
            <g key={i} onClick={() => setD(Math.round((o.date.getTime() - T0) / DAY))} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={306} r={(arcsec(o.dist) / 2) * PX} fill="#d0714a" stroke={on ? C.amber : 'none'} strokeWidth={2} />
              <Label x={x} y={352} anchor="middle" size="s" weight={on ? 700 : 500} color={on ? C.amber : C.text}>{fmtDate(o.date)}</Label>
              <Label x={x} y={368} anchor="middle" size="s" color={C.dim}>{arcsec(o.dist).toFixed(0)}″</Label>
            </g>
          );
        })}
      </Svg>
      <Controls>
        <RangeControl label="Date" value={d} min={0} max={span} step={5} onChange={(v) => { setPlaying(false); setD(v); }} format={() => fmtDate(date)} />
        <PlayButton playing={playing} onToggle={() => { if (d >= span) setD(0); setPlaying((p) => !p); }} label="Play" />
      </Controls>
      <Readout>
        {nearOpp
          ? `Opposition, ${fmtDate(nearOpp.date)}: Earth is passing Mars, so Mars is close, opposite the Sun and up all night, ${size.toFixed(0)} arcseconds across. ${nearOpp === brightest ? 'This is the closest of these oppositions.' : `Oppositions vary: the ${fmtDate(brightest.date)} one brings Mars much closer.`}`
          : `Mars is ${il.geo_dist.toFixed(1)} AU away and only ${size.toFixed(0)} arcseconds across${faint > 3 ? `, about ${fmt(Math.round(faint))} times fainter than at its best opposition here` : ''}. A small telescope shows little but an orange dot.`}
      </Readout>
    </div>
  );
}
