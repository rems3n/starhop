/**
 * Why eclipses don't happen every month. Earth's orbit in perspective with the Moon's orbit around Earth
 * (orbit enlarged, its 5.1° tilt exaggerated ×3). The line of nodes, where the Moon's orbit crosses the plane
 * of Earth's orbit, keeps (nearly) the same direction in space, so it points at the Sun only twice a year:
 * the eclipse seasons. Dates, the Moon's position and the 2027 eclipses come from astronomy-engine; the node
 * direction is the 10 January 2027 ascending-node longitude (320.3°) regressing 19.34° per year.
 */
import { useEffect, useMemo, useState } from 'react';
import { Body, NextGlobalSolarEclipse, NextLunarEclipse, SearchGlobalSolarEclipse, SearchLunarEclipse, SearchMoonPhase } from 'astronomy-engine';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, rad, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';
import { dayOf2027, geoEcl, norm180, norm360 } from './ecliptic-common';

export const meta: DiagramMeta = {
  title: 'Eclipse seasons',
  summary: 'Earth carries the Moon’s tilted orbit round the Sun through 2027; eclipses happen only when the line of nodes points at the Sun, about every six months.',
  params: { day: 'starting day of 2027, 0–364 (default 214, 2 August)' },
};

const CX = 340, CY = 206, RO = 210, E = rad(28), RM = 66, TILT = rad(5.145 * 3);
const OM0 = 320.3, OM_T0 = Date.UTC(2027, 0, 10, 16);
const omega = (d: Date) => norm360(OM0 - (19.34 * (d.getTime() - OM_T0)) / (365.25 * 86400000));
const proj = (x: number, y: number, z: number): [number, number] => [CX + x, CY - y * Math.sin(E) - z * Math.cos(E)];
const dir = (lon: number): [number, number] => [Math.cos(rad(lon - 90)), Math.sin(rad(lon - 90))];
const KIND: Record<string, string> = { penumbral: 'penumbral lunar', partial: 'partial', total: 'total', annular: 'annular solar' };

export default function EclipseNodes({ params }: DiagramProps) {
  const [day, setDay] = useState(typeof params?.day === 'number' ? (params.day as number) : 214);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setDay((d) => (d + (reduced ? 7 : 1)) % 365), reduced ? 500 : 90);
    return () => clearInterval(id);
  }, [playing, reduced]);

  const eclipses = useMemo(() => {
    const out: { date: Date; label: string; solar: boolean }[] = [];
    const start = new Date(Date.UTC(2027, 0, 1)), end = new Date(Date.UTC(2028, 0, 1));
    for (let e = SearchLunarEclipse(start); e.peak.date < end; e = NextLunarEclipse(e.peak)) out.push({ date: e.peak.date, label: `${KIND[e.kind] ?? e.kind}${e.kind === 'penumbral' ? '' : ' lunar'}`, solar: false });
    for (let e = SearchGlobalSolarEclipse(start); e.peak.date < end; e = NextGlobalSolarEclipse(e.peak)) out.push({ date: e.peak.date, label: `${KIND[e.kind] ?? e.kind}${e.kind === 'annular' ? '' : ' solar'}`, solar: true });
    return out.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, []);
  const orbitPath = useMemo(() => {
    const pts: string[] = [];
    for (let d = 0; d <= 365; d += 5) {
      const s = geoEcl(Body.Sun, dayOf2027(d));
      const [x, y] = dir(s.lon + 180);
      const p = proj(RO * s.dist * x, RO * s.dist * y, 0);
      pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    }
    return `M ${pts.join(' L ')} Z`;
  }, []);

  const date = dayOf2027(day);
  const sun = geoEcl(Body.Sun, date);
  const [ex0, ey0] = dir(sun.lon + 180);
  const ew: [number, number, number] = [RO * sun.dist * ex0, RO * sun.dist * ey0, 0];
  const [EX, EY] = proj(...ew);
  const om = omega(date);
  const [nx, ny] = dir(om);
  const nperp: [number, number] = [-ny, nx];
  const moonPt = (u: number): [number, number, number] => {
    const c = Math.cos(rad(u)), s = Math.sin(rad(u));
    return [ew[0] + RM * (c * nx + s * Math.cos(TILT) * nperp[0]), ew[1] + RM * (c * ny + s * Math.cos(TILT) * nperp[1]), RM * s * Math.sin(TILT)];
  };
  const above: string[] = [], below: string[] = [];
  for (let u = 0; u <= 360; u += 6) {
    const p = proj(...moonPt(u));
    (u <= 180 ? above : below).push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
  }
  const moon = geoEcl(Body.Moon, date);
  const [MX, MY] = proj(...moonPt(moon.lon - om));
  const nodeA = proj(...moonPt(0)), nodeD = proj(...moonPt(180));
  const nodeOff = Math.min(Math.abs(norm180(om - sun.lon)), Math.abs(norm180(om + 180 - sun.lon)));
  const season = nodeOff < 17;
  // Nearest new and full Moons, with the Moon's distance from the ecliptic then
  const next = (target: number) => {
    const t = SearchMoonPhase(target, new Date(date.getTime() - 15 * 86400000), 40);
    return t ? { d: t.date, lat: geoEcl(Body.Moon, t.date).lat } : null;
  };
  const nm = next(0), fm = next(180);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const dateLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  const near = eclipses.filter((e) => Math.abs(e.date.getTime() - date.getTime()) < 20 * 86400000);

  // Group eclipses into seasons for labels on the orbit
  const groups: { date: Date; items: typeof eclipses }[] = [];
  eclipses.forEach((e) => {
    const g = groups.find((x) => Math.abs(x.date.getTime() - e.date.getTime()) < 40 * 86400000);
    if (g) g.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  });

  return (
    <div>
      <Svg w={720} h={392} title={meta.title} desc={`${dateLabel} 2027: the Moon's line of nodes is ${Math.round(nodeOff)} degrees from the direction of the Sun${season ? ', so this is an eclipse season' : ', so no eclipse is possible this month'}.`}>
        <path d={orbitPath} fill="none" stroke={C.lineStrong} strokeDasharray="3 4" />
        {groups.map((g, i) => {
          const s = geoEcl(Body.Sun, g.items[0].date);
          const [x, y] = dir(s.lon + 180);
          const p = proj(RO * s.dist * x, RO * s.dist * y, 0);
          const right = p[0] > CX, below = p[1] > CY;
          const n = g.items.length;
          return (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r={5} fill="none" stroke={C.amber} strokeWidth={2} />
              {g.items.map((e, j) => (
                <Label key={j} x={p[0] + (right ? 10 : -10)} y={below ? p[1] + 70 + j * 15 : p[1] - 64 - (n - 1 - j) * 15} anchor={right ? 'start' : 'end'} size="s" color={C.amber}>
                  {`${fmt(e.date)} ${e.label}`}
                </Label>
              ))}
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={30} fill="url(#fig-glow)" />
        <circle cx={CX} cy={CY} r={13} fill={C.sun} />
        {/* Sun direction from Earth */}
        <line x1={EX} y1={EY} x2={CX} y2={CY} stroke={C.amber} strokeOpacity={0.6} />
        {/* Moon's orbit: solid above the plane, dashed below */}
        <polyline points={above.join(' ')} fill="none" stroke={C.moon} strokeWidth={1.6} />
        <polyline points={below.join(' ')} fill="none" stroke={C.moon} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.7} />
        {/* Line of nodes */}
        <line x1={nodeA[0] + (nodeA[0] - EX) * 0.5} y1={nodeA[1] + (nodeA[1] - EY) * 0.5} x2={nodeD[0] + (nodeD[0] - EX) * 0.5} y2={nodeD[1] + (nodeD[1] - EY) * 0.5} stroke={season ? C.good : C.blue} strokeWidth={1.6} />
        <circle cx={nodeA[0]} cy={nodeA[1]} r={3.5} fill={season ? C.good : C.blue} />
        <circle cx={nodeD[0]} cy={nodeD[1]} r={3.5} fill={season ? C.good : C.blue} />
        <circle cx={EX} cy={EY} r={9} fill={C.earth} />
        <circle cx={MX} cy={MY} r={5} fill={C.moon} stroke={C.bg} strokeWidth={1.5} />
        <Label x={EX + 14} y={EY - 14} weight={600}>
          Earth
        </Label>
        <Label x={14} y={24} size="s" color={C.dim}>
          Moon's orbit: solid above the plane of Earth's orbit, dashed below
        </Label>
        <Label x={14} y={42} size="s" color={season ? C.good : C.blue}>
          {season ? 'line of nodes points at the Sun: eclipse season' : 'line of nodes (where the Moon crosses the plane)'}
        </Label>
        <Label x={706} y={378} anchor="end" size="s" color={C.faint}>
          Moon's orbit enlarged · tilt exaggerated ×3 · 2027
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Date in 2027" value={day} min={0} max={364} onChange={(v) => { setPlaying(false); setDay(v); }} format={() => dateLabel} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} label="Play the year" />
      </Controls>
      <Readout>
        {nm && fm
          ? `New Moon ${fmt(nm.d)}: the Moon passes ${Math.abs(nm.lat).toFixed(1)}° ${nm.lat >= 0 ? 'north' : 'south'} of the Sun's line. Full Moon ${fmt(fm.d)}: ${Math.abs(fm.lat).toFixed(1)}° ${fm.lat >= 0 ? 'north' : 'south'}. `
          : ''}
        {season
          ? `The nodes line up with the Sun, so new and full Moons fall close to the ecliptic${near.length ? `: ${near.map((e) => `${e.label} eclipse on ${fmt(e.date)}`).join(', ')}` : ''}.`
          : 'Both pass well above or below, so there is no eclipse this month: the Moon’s shadow misses Earth and Earth’s shadow misses the Moon.'}
      </Readout>
    </div>
  );
}
