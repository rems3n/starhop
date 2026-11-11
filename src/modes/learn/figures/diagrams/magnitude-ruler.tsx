/**
 * The magnitude scale from the Sun to the faintest galaxies Hubble has recorded, then zoomed in on the stars you
 * can see. Values: Sun −26.8, full Moon −12.7 (mean), Venus about −4.2, Sirius −1.46, naked-eye limit +6.5 under the
 * darkest skies, Hubble about +31.5 (Wikipedia, "Apparent magnitude"); star magnitudes from the catalog.
 * The learner picks a Bortle class; the limiting magnitudes match src/types.ts BORTLE (copied here because diagrams
 * import only from the kit, astronomy-engine, the catalog and the settings store). Star counts come from the catalog.
 */
import { useMemo, useState } from 'react';
import { useCatalog } from '@/data/catalog';
import { useSettings } from '@/store/settings';
import { C, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'The magnitude scale, from the Sun to Hubble',
  summary: 'A ruler from the Sun (−27) to Hubble’s faintest galaxies (+31), zoomed in on the naked-eye stars; choose your sky’s Bortle class to see where your limit falls and how many stars you can see.',
  params: { bortle: 'starting Bortle class 1–9 (default: the one in settings)' },
};

/** Limiting magnitude per Bortle class, as in src/types.ts BORTLE. */
const BORTLE_LIMIT = [7.6, 7.3, 6.8, 6.3, 5.8, 5.3, 4.8, 4.3, 3.8];
const BORTLE_LABEL = ['Excellent dark site', 'Truly dark site', 'Rural sky', 'Rural/suburban transition', 'Suburban sky', 'Bright suburban sky', 'Suburban/urban transition', 'City sky', 'Inner-city sky'];

const TOP: { m: number; name: string; up?: boolean }[] = [
  { m: -26.8, name: 'Sun' },
  { m: -12.7, name: 'full Moon' },
  { m: -4.2, name: 'Venus', up: true },
  { m: 6.5, name: 'naked-eye limit', up: true },
  { m: 31.5, name: 'Hubble’s faintest' },
];
const ZOOM: { m: number; name: string; row: number }[] = [
  { m: -2.5, name: 'Jupiter', row: 0 },
  { m: -1.46, name: 'Sirius', row: 1 },
  { m: 0.03, name: 'Vega', row: 0 },
  { m: 0.98, name: 'Spica', row: 1 },
  { m: 1.97, name: 'Polaris', row: 0 },
  { m: 3.32, name: 'Megrez', row: 1 },
];

const TX0 = 40, TX1 = 680, TY = 80;
const tx = (m: number) => TX0 + ((m + 30) / 62) * (TX1 - TX0);
const ZX0 = 40, ZX1 = 680, ZY = 250;
const ZMIN = -3, ZMAX = 8;
const zx = (m: number) => ZX0 + ((m - ZMIN) / (ZMAX - ZMIN)) * (ZX1 - ZX0);

export default function MagnitudeRuler({ params }: DiagramProps) {
  const setting = useSettings((s) => s.bortle);
  const [bortle, setBortle] = useState(typeof params?.bortle === 'number' ? (params.bortle as number) : setting);
  const catalog = useCatalog();
  const limit = BORTLE_LIMIT[bortle - 1];
  const count = useMemo(() => {
    if (!catalog) return null;
    let n = 0;
    for (const s of catalog.stars) if (s.mag <= limit) n++;
    const faintest = catalog.stars.reduce((a, s) => Math.max(a, s.mag), -10);
    return { n, beyond: limit > faintest + 0.05 };
  }, [catalog, limit]);

  return (
    <div>
      <Svg w={720} h={390} title={meta.title} desc="Top: a ruler of magnitudes from the Sun at minus 27 to Hubble's faintest galaxies at plus 31, with the naked-eye stars a narrow band near zero. Bottom: that band enlarged, with Jupiter, Sirius, Vega, Spica, Polaris and Megrez marked, and the part fainter than your sky's limit shaded.">
        {/* top ruler */}
        <Label x={TX0} y={30} size="s" color={C.dim}>
          brighter ←
        </Label>
        <Label x={TX1} y={30} anchor="end" size="s" color={C.dim}>
          → fainter
        </Label>
        <line x1={TX0} x2={TX1} y1={TY} y2={TY} stroke={C.lineStrong} strokeWidth={2} />
        {[-25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30].map((m) => (
          <g key={m}>
            <line x1={tx(m)} x2={tx(m)} y1={TY - 4} y2={TY + 4} stroke={C.lineStrong} />
            <Label x={tx(m)} y={TY + 20} anchor="middle" size="s" color={C.faint}>
              {m < 0 ? `−${-m}` : `${m}`}
            </Label>
          </g>
        ))}
        {/* naked-eye band */}
        <rect x={tx(-1.5)} y={TY - 10} width={tx(6.5) - tx(-1.5)} height={20} fill={C.amber} opacity={0.25} />
        {TOP.map((t) => (
          <g key={t.name}>
            <circle cx={tx(t.m)} cy={TY} r={t.name === 'Sun' ? 8 : 5} fill={t.name === 'Sun' ? C.sun : t.name === 'full Moon' ? C.moon : C.star} />
            <Label x={tx(t.m)} y={t.up ? TY - 16 : TY + 40} anchor={t.m > 30 ? 'end' : t.m < -26 ? 'start' : 'middle'} size="s" color={C.text}>
              {`${t.name} ${t.m < 0 ? '−' : '+'}${Math.abs(t.m)}`}
            </Label>
          </g>
        ))}
        {/* zoom lines */}
        <line x1={tx(-1.5)} y1={TY + 10} x2={zx(ZMIN)} y2={ZY - 60} stroke={C.line} strokeDasharray="4 4" />
        <line x1={tx(6.5)} y1={TY + 10} x2={zx(ZMAX)} y2={ZY - 60} stroke={C.line} strokeDasharray="4 4" />

        {/* zoomed ruler */}
        <rect x={zx(limit)} y={ZY - 56} width={zx(ZMAX) - zx(limit)} height={112} fill={C.bg} opacity={0.9} />
        <rect x={zx(limit)} y={ZY - 56} width={zx(ZMAX) - zx(limit)} height={112} fill={C.bad} opacity={0.08} />
        <line x1={ZX0} x2={ZX1} y1={ZY} y2={ZY} stroke={C.lineStrong} strokeWidth={2} />
        {Array.from({ length: ZMAX - ZMIN + 1 }, (_, i) => ZMIN + i).map((m) => (
          <g key={m}>
            <line x1={zx(m)} x2={zx(m)} y1={ZY - 5} y2={ZY + 5} stroke={C.lineStrong} />
            <Label x={zx(m)} y={ZY + 22} anchor="middle" size="s" color={C.dim}>
              {m < 0 ? `−${-m}` : `${m}`}
            </Label>
          </g>
        ))}
        {ZOOM.map((z) => (
          <g key={z.name}>
            <circle cx={zx(z.m)} cy={ZY} r={Math.max(2.5, 7 - z.m * 1.1)} fill={z.m <= limit ? C.star : C.faint} />
            <Label x={zx(z.m)} y={z.row ? ZY + 44 : ZY - 16} anchor="middle" size="s">
              {z.name}
            </Label>
          </g>
        ))}
        {/* limit marker */}
        <line x1={zx(limit)} x2={zx(limit)} y1={ZY - 58} y2={ZY + 58} stroke={C.amber} strokeWidth={2} />
        <Label x={zx(limit) - 6} y={ZY - 40} anchor="end" color={C.amber} weight={700}>
          {`your limit ${limit.toFixed(1)}`}
        </Label>
        <Label x={Math.min(zx(limit) + 8, ZX1 - 4)} y={ZY + 52} anchor={zx(limit) > ZX1 - 120 ? 'end' : 'start'} size="s" color={C.dim}>
          too faint to see
        </Label>
        {/* common limits */}
        {[
          [3.8, 'inner city'],
          [5.3, 'suburb'],
          [6.5, 'dark site'],
        ].map(([m, t]) => (
          <g key={t as string}>
            <line x1={zx(m as number)} x2={zx(m as number)} y1={ZY + 82} y2={ZY + 92} stroke={C.dim} />
            <Label x={zx(m as number)} y={ZY + 108} anchor="middle" size="s" color={C.dim}>
              {t as string}
            </Label>
          </g>
        ))}
      </Svg>
      <Controls>
        <RangeControl label="Your sky" value={bortle} min={1} max={9} step={1} onChange={setBortle} format={(v) => `Bortle ${v}, ${BORTLE_LABEL[v - 1].toLowerCase()}`} />
      </Controls>
      <Readout>
        {`Bortle ${bortle} (${BORTLE_LABEL[bortle - 1].toLowerCase()}): the faintest stars you can see are about magnitude ${limit.toFixed(1)}. `}
        {count
          ? count.beyond
            ? `That is every one of the ${count.n.toLocaleString('en-US')} stars in Starhop's catalog and thousands more, across the whole sky; about half are above the horizon at any moment.`
            : `The whole sky holds about ${(Math.round(count.n / 10) * 10).toLocaleString('en-US')} stars that bright; about half are above your horizon at any moment.`
          : ''}
      </Readout>
    </div>
  );
}
