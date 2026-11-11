/**
 * Venus's phases and changing size, computed with astronomy-engine for one real cycle (superior conjunction to
 * superior conjunction around the 2026 inferior conjunction). Left: top-down view in a frame that keeps the Earth at
 * the bottom. Right: Venus as seen in a small telescope, at the true relative size and phase. The lit side is drawn
 * as seen from the learner's hemisphere (settings observer latitude).
 */
import { useEffect, useMemo, useState } from 'react';
import { Body, EclipticLongitude, Elongation, HelioDistance, Illumination, SearchRelativeLongitude } from 'astronomy-engine';
import { useSettings } from '@/store/settings';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, rad, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'The phases of Venus',
  summary: 'Step through one real cycle of Venus: its place relative to Earth and Sun, and its phase and size as seen in a small telescope.',
  params: { day: 'starting day of the cycle, 0–584 (default 120)' },
};

const DAY = 86400e3;
const VENUS_R = 6051.8, AU = 1.495978707e8;

export default function VenusPhases({ params }: DiagramProps) {
  const lat = useSettings((s) => s.observer.lat);
  const reduced = usePrefersReducedMotion();
  const cycle = useMemo(() => {
    const inf = SearchRelativeLongitude(Body.Venus, 0, new Date(Date.UTC(2026, 0, 1))).date;
    const sup = SearchRelativeLongitude(Body.Venus, 180, new Date(inf.getTime() - 400 * DAY)).date;
    const sup2 = SearchRelativeLongitude(Body.Venus, 180, new Date(inf.getTime() + 10 * DAY)).date;
    return { start: sup, inf, days: Math.round((sup2.getTime() - sup.getTime()) / DAY) };
  }, []);
  const [d, setD] = useState(typeof params?.day === 'number' ? Math.min(cycle.days, Math.max(0, params.day as number)) : 120);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setD((v) => { const n = v + (reduced ? 30 : 3); if (n >= cycle.days) { setPlaying(false); return cycle.days; } return n; }), reduced ? 500 : 60);
    return () => clearInterval(id);
  }, [playing, reduced, cycle.days]);

  const date = new Date(cycle.start.getTime() + d * DAY);
  const ill = Illumination(Body.Venus, date);
  const el = Elongation(Body.Venus, date);
  const k = ill.phase_fraction;
  const diam = (2 * Math.atan(VENUS_R / (ill.geo_dist * AU)) * 180 * 3600) / Math.PI; // arcsec
  const lv = EclipticLongitude(Body.Venus, date), le = EclipticLongitude(Body.Earth, date);
  const rv = HelioDistance(Body.Venus, date);

  // top-down, rotating frame: Earth fixed at the bottom
  const SX = 170, SY = 190, S = 130;
  const ang = rad(lv - le);
  // Earth at angle 0 (down); positive relative longitude = anticlockwise seen from the north = towards screen right
  const vx = SX + Math.sin(ang) * rv * S, vy = SY + Math.cos(ang) * rv * S;
  const ex = SX, ey = SY + S;

  // telescope view
  const TX = 530, TY = 190, PX = 1.25; // px per arcsec
  const R = (diam / 2) * PX;
  const rx = R * Math.abs(2 * k - 1);
  const evening = el.visibility === 'evening';
  const litRight = lat >= 0 ? evening : !evening;
  const lit = `M ${TX} ${TY - R} A ${R} ${R} 0 0 1 ${TX} ${TY + R} A ${rx} ${R} 0 0 ${k > 0.5 ? 1 : 0} ${TX} ${TY - R} Z`;
  const fmtDate = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  return (
    <div>
      <Svg w={720} h={380} title={meta.title} desc="Left: the Sun at the centre, Venus's orbit inside the Earth's, with the Earth fixed at the bottom and Venus at its position on the chosen date. Right: Venus as seen in a small telescope at that date, from a small nearly full disc far away to a large thin crescent when close.">
        <Label x={SX} y={26} anchor="middle" weight={700}>From above (Earth kept at the bottom)</Label>
        <circle cx={SX} cy={SY} r={S} fill="none" stroke={C.line} strokeDasharray="4 4" />
        <circle cx={SX} cy={SY} r={0.723 * S} fill="none" stroke={C.line} strokeDasharray="4 4" />
        <circle cx={SX} cy={SY} r={14} fill="url(#fig-glow)" />
        <circle cx={SX} cy={SY} r={8} fill={C.sun} />
        <line x1={ex} y1={ey} x2={vx} y2={vy} stroke={C.amber} strokeOpacity={0.6} />
        <circle cx={vx} cy={vy} r={6} fill="#efe0b8" />
        <circle cx={ex} cy={ey} r={6} fill={C.earth} />
        <Label x={vx + 10} y={vy - 8} size="s" weight={700}>Venus</Label>
        <Label x={ex + 10} y={ey + 18} size="s" weight={700}>Earth</Label>
        <Label x={SX + 12} y={SY - 10} size="s" color={C.dim}>Sun</Label>

        <Label x={TX} y={26} anchor="middle" weight={700}>In a small telescope, {fmtDate}</Label>
        <Label x={TX} y={44} anchor="middle" size="s" color={C.dim}>true relative size and phase</Label>
        <circle cx={TX} cy={TY} r={Math.max(R, 2)} fill="#2a2f45" />
        <path d={lit} fill="#f4ecd2" transform={litRight ? undefined : `translate(${2 * TX} 0) scale(-1 1)`} />
        <Label x={TX} y={TY + 100} anchor="middle" weight={600}>{Math.round(k * 100)}% lit · {Math.round(diam)}″ across</Label>
        <Label x={TX} y={TY + 118} anchor="middle" size="s" color={C.dim}>{el.elongation < 6 ? 'too close to the Sun to see' : `${evening ? 'evening' : 'morning'} star, ${Math.round(el.elongation)}° from the Sun`}</Label>
        <Label x={360} y={366} anchor="middle" size="s" color={C.dim}>Lit side drawn as seen with the naked eye or binoculars from the {lat >= 0 ? 'northern' : 'southern'} hemisphere.</Label>
      </Svg>
      <Controls>
        <RangeControl label="Date" value={d} min={0} max={cycle.days} onChange={(v) => { setPlaying(false); setD(v); }} format={() => fmtDate} />
        <PlayButton playing={playing} onToggle={() => { if (d >= cycle.days) setD(0); setPlaying((p) => !p); }} label="Play one cycle" />
      </Controls>
      <Readout>
        {el.elongation < 6
          ? `Venus is lined up with the Sun (${k > 0.5 ? 'on the far side, small and full' : 'between us and the Sun, large but unlit'}) and lost in its glare.`
          : `Venus is ${(ill.geo_dist).toFixed(2)} AU away (1 AU is the Sun–Earth distance), ${Math.round(k * 100)}% lit and ${Math.round(diam)} arcseconds across: ${k > 0.6 ? 'far from us, towards the far side of the Sun, so small and nearly full' : k > 0.35 ? 'about half lit, near its greatest distance from the Sun in the sky' : 'swinging close to Earth, so large but a thin crescent'}.`}
      </Readout>
    </div>
  );
}
