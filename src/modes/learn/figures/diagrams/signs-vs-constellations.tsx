/**
 * Astrological signs vs zodiac constellations along the ecliptic, around the Sun's position on a chosen date.
 * Top band: the real constellations (unequal widths, IAU boundaries). Bottom band: the twelve equal 30° signs,
 * counted from the March equinox point. A toggle moves the equinox back to where it was 2,000 years ago
 * (precession, 50.29″ per year), when the signs and constellations roughly matched.
 */
import { useState } from 'react';
import { SunPosition, Body } from 'astronomy-engine';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { ZODIAC, dayOf2027, geoEcl, norm180, norm360, zodiacAt, zodiacSpan } from './ecliptic-common';

export const meta: DiagramMeta = {
  title: 'Signs and constellations',
  summary: 'Equal 30° astrological signs against the unequal zodiac constellations around the Sun on a chosen date; switch between today and 2,000 years ago to see precession shift the signs.',
  params: { day: 'starting day of 2027, 0–364 (default 84, March 26)', era: '"now" | "then" (default "now")' },
};

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const CX = 360, S = 5.6, X0 = 14, X1 = 706;
/** Equinox longitude in the J2000 frame for a year (general precession 50.29″/yr). */
const offset = (year: number) => (-(year - 2000) * 50.29) / 3600;

export default function SignsVsConstellations({ params }: DiagramProps) {
  const [day, setDay] = useState(typeof params?.day === 'number' ? (params.day as number) : 84);
  const [era, setEra] = useState<'now' | 'then'>(params?.era === 'then' ? 'then' : 'now');
  const date = dayOf2027(day);
  const tropical = SunPosition(date).elon; // longitude from the equinox of date: what defines the sign
  const off = era === 'now' ? geoEcl(Body.Sun, date).lon - tropical : offset(27);
  const sunJ = norm360(tropical + off);
  const sign = SIGNS[Math.floor(norm360(tropical) / 30)];
  const con = zodiacAt(sunJ);
  const x = (lon: number) => CX - norm180(lon - sunJ) * S;
  const dateLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

  const conBoxes = ZODIAC.map((z, i) => {
    const [a, b] = zodiacSpan(i);
    // draw the copy of the span nearest the Sun
    const ca = sunJ + norm180(a - sunJ);
    const w = b - a;
    const xr = CX - (ca - sunJ) * S; // right edge (west)
    const xl = xr - w * S;
    return { z, xl, xr };
  }).filter((b) => b.xr > X0 && b.xl < X1);
  const signBoxes = SIGNS.map((s, i) => {
    const a = i * 30 + off;
    const ca = sunJ + norm180(a - sunJ);
    const xr = CX - (ca - sunJ) * S;
    return { s, xl: xr - 30 * S, xr, start: ca };
  }).filter((b) => b.xr > X0 && b.xl < X1);
  const eqx = x(off);

  const box = (xl: number, xr: number) => [Math.max(X0, xl), Math.min(X1, xr)] as const;
  return (
    <div>
      <Svg w={720} h={300} title={meta.title} desc={`On ${dateLabel} ${era === 'now' ? 'today' : '2,000 years ago'}, the sign is ${sign} and the Sun is in front of the constellation ${con.name}.`}>
        <defs>
          <clipPath id="svc-clip">
            <rect x={X0} y={0} width={X1 - X0} height={300} />
          </clipPath>
        </defs>
        <Label x={X0} y={22} size="s" color={C.dim}>
          ← east
        </Label>
        <Label x={X1} y={22} anchor="end" size="s" color={C.dim}>
          west →
        </Label>
        <g clipPath="url(#svc-clip)">
          <Label x={X0 + 4} y={88} size="s" color={C.dim}>
            Constellations: real star patterns
          </Label>
          {conBoxes.map(({ z, xl, xr }) => {
            const [l, r] = box(xl, xr);
            const hot = z === con;
            const narrow = xr - xl < 64;
            return (
              <g key={z.abbr}>
                <rect x={xl} y={96} width={xr - xl} height={44} fill={hot ? C.amber : 'rgba(156,176,255,0.12)'} fillOpacity={hot ? 0.3 : 1} stroke={C.lineStrong} />
                <Label x={(l + r) / 2} y={narrow ? 156 : 123} anchor="middle" size={narrow ? 's' : 'm'} color={hot ? C.amber : C.text} weight={hot ? 700 : 500}>
                  {z.name}
                </Label>
              </g>
            );
          })}
          <Label x={X0 + 4} y={190} size="s" color={C.dim}>
            Signs: equal 30° slices from the March equinox
          </Label>
          {signBoxes.map(({ s, xl, xr }) => {
            const [l, r] = box(xl, xr);
            const hot = s === sign;
            return (
              <g key={s}>
                <rect x={xl} y={198} width={xr - xl} height={44} fill={hot ? C.blue : 'rgba(156,176,255,0.06)'} fillOpacity={hot ? 0.28 : 1} stroke={C.line} strokeDasharray="4 3" />
                <Label x={(l + r) / 2} y={225} anchor="middle" color={hot ? C.blue : C.dim} weight={hot ? 700 : 500}>
                  {s}
                </Label>
              </g>
            );
          })}
          {eqx > X0 && eqx < X1 && (
            <g>
              <line x1={eqx} y1={194} x2={eqx} y2={262} stroke={C.good} strokeWidth={2} />
              <Label x={eqx} y={278} anchor="middle" size="s" color={C.good}>
                March equinox point
              </Label>
            </g>
          )}
        </g>
        {/* The Sun today */}
        <line x1={CX} y1={56} x2={CX} y2={246} stroke={C.amber} strokeWidth={1.5} strokeDasharray="5 4" />
        <circle cx={CX} cy={48} r={14} fill="url(#fig-glow)" />
        <circle cx={CX} cy={48} r={7} fill={C.sun} />
        <Label x={CX + 18} y={53} weight={600}>
          {`The Sun on ${dateLabel}`}
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Date" value={day} min={0} max={364} onChange={setDay} format={() => dateLabel} />
        <ChoiceControl
          label="When"
          value={era}
          options={[
            { value: 'now', label: 'Today' },
            { value: 'then', label: '2,000 years ago' },
          ]}
          onChange={setEra}
        />
      </Controls>
      <Readout>
        {era === 'now'
          ? `On ${dateLabel} a horoscope puts the Sun in ${sign}, but it is really in front of the stars of ${con.name}.${con.name.startsWith(sign.slice(0, 4)) ? ' On this date the two happen to agree.' : ''}`
          : `2,000 years ago, on ${dateLabel}, the Sun was in front of ${con.name} and the sign was ${sign}${con.name.startsWith(sign.slice(0, 4)) ? ': sign and constellation matched' : ': close, but the boundaries never lined up exactly'}. Since then the equinox point has slid about 28° west.`}
      </Readout>
    </div>
  );
}
