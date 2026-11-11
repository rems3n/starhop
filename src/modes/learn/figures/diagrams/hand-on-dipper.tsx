/**
 * Calibrate your hand on the Big Dipper. The Dipper is drawn to true angular scale from catalog positions
 * (stereographic, north up, east left as on a sky chart). A hand outline at arm's length, sized in degrees, is laid
 * over a chosen pair of stars: three fingers on the Pointers, a fist on the top of the bowl, a spread hand along the
 * whole Dipper. A slider lets the learner make the hand a little bigger or smaller, like a real person's.
 */
import { useId, useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, rad, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Your hand against the Big Dipper',
  summary: 'The Big Dipper at true scale with a hand outline laid over the Pointers, the top of the bowl or the whole Dipper; resize the hand to calibrate it.',
  params: { measure: '"pointers" | "bowl" | "dipper" (default "pointers")' },
};

type V3 = [number, number, number];
const STARS: Record<string, [number, number, number]> = {
  Dubhe: [165.93233, 61.75103, 1.81], Merak: [165.46016, 56.38243, 2.34], Phecda: [178.45752, 53.69476, 2.41], Megrez: [183.85629, 57.03262, 3.32],
  Alioth: [193.50708, 55.95982, 1.76], Mizar: [200.98121, 54.92536, 2.23], Alkaid: [206.88531, 49.31327, 1.85], Alcor: [201.3062, 54.98796, 3.99],
};
const LINE = ['Alkaid', 'Mizar', 'Alioth', 'Megrez', 'Phecda', 'Merak', 'Dubhe', 'Megrez'];
const vec = (ra: number, dec: number): V3 => [Math.cos(rad(dec)) * Math.cos(rad(ra)), Math.cos(rad(dec)) * Math.sin(rad(ra)), Math.sin(rad(dec))];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sep = (a: string, b: string) => (Math.acos(dot(vec(STARS[a][0], STARS[a][1]), vec(STARS[b][0], STARS[b][1]))) * 180) / Math.PI;

// Projection centred on the middle of the Dipper; north up, east left.
const RA0 = 186, DEC0 = 56;
const PX_PER_DEG = 21;
const S = (PX_PER_DEG * 180) / Math.PI; // stereographic: small angles map 1:1 near the centre
const CX = 372, CY = 196;
const c = vec(RA0, DEC0);
const east: V3 = [-Math.sin(rad(RA0)), Math.cos(rad(RA0)), 0];
const north: V3 = [-Math.sin(rad(DEC0)) * Math.cos(rad(RA0)), -Math.sin(rad(DEC0)) * Math.sin(rad(RA0)), Math.cos(rad(DEC0))];
function project(ra: number, dec: number): [number, number] {
  const p = vec(ra, dec);
  const k = 2 / (1 + dot(p, c));
  return [CX - S * k * dot(p, east), CY - S * k * dot(p, north)];
}
const RAW = Object.fromEntries(Object.entries(STARS).map(([n, [ra, dec]]) => [n, project(ra, dec)])) as Record<string, [number, number]>;
// centre the drawing horizontally and vertically in the frame
const XS = Object.values(RAW).map((p) => p[0]), YS = Object.values(RAW).map((p) => p[1]);
const DX = 360 - (Math.min(...XS) + Math.max(...XS)) / 2, DY = 190 - (Math.min(...YS) + Math.max(...YS)) / 2;
const P = Object.fromEntries(Object.entries(RAW).map(([n, [x, y]]) => [n, [x + DX, y + DY]])) as Record<string, [number, number]>;

type Measure = 'pointers' | 'bowl' | 'dipper';
const M: Record<Measure, { a: string; b: string; hand: 'three' | 'fist' | 'span'; deg: number; tool: string; part: string }> = {
  pointers: { a: 'Merak', b: 'Dubhe', hand: 'three', deg: 5, tool: 'three fingers', part: 'the Pointers, Merak to Dubhe' },
  bowl: { a: 'Dubhe', b: 'Megrez', hand: 'fist', deg: 10, tool: 'one fist', part: 'the top of the bowl, Dubhe to Megrez' },
  dipper: { a: 'Dubhe', b: 'Alkaid', hand: 'span', deg: 22, tool: 'one spread hand', part: 'the whole Dipper, Dubhe to Alkaid' },
};

/** Hand outline in local units: x across the measured width (−0.5…0.5), y along the fingers (negative = fingertips). */
function HandShape({ kind }: { kind: 'three' | 'fist' | 'span' }) {
  const common = { fill: C.amber, fillOpacity: 0.12, stroke: C.amber, strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' as const };
  if (kind === 'three')
    return (
      <g>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={-0.5 + i / 3 + 0.01} y={i === 1 ? -0.75 : -0.65} width={1 / 3 - 0.02} height={i === 1 ? 1.25 : 1.15} rx={0.16} {...common} />
        ))}
      </g>
    );
  if (kind === 'fist')
    return (
      <g>
        <rect x={-0.5} y={-0.42} width={1} height={0.84} rx={0.16} {...common} />
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={-0.5 + t} x2={-0.5 + t} y1={-0.42} y2={-0.12} stroke={C.amber} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    );
  return (
    <path
      transform="translate(0 0.13)"
      d="M -0.5 -0.08 L -0.36 -0.2 L -0.16 0 L -0.14 -0.42 L -0.06 -0.44 L -0.02 -0.06 L 0.02 -0.48 L 0.1 -0.48 L 0.11 -0.06 L 0.2 -0.42 L 0.27 -0.4 L 0.22 0 L 0.45 -0.24 L 0.5 -0.18 L 0.24 0.2 L 0.16 0.36 L -0.14 0.36 L -0.2 0.14 Z"
      {...common}
    />
  );
}

export default function HandOnDipper({ params }: DiagramProps) {
  const [m, setM] = useState<Measure>(params?.measure === 'bowl' || params?.measure === 'dipper' ? (params.measure as Measure) : 'pointers');
  const [scale, setScale] = useState(100);
  const clip = useId().replace(/:/g, '');
  const cfg = M[m];
  const real = sep(cfg.a, cfg.b);
  const handDeg = (cfg.deg * scale) / 100;
  const [ax, ay] = P[cfg.a], [bx, by] = P[cfg.b];
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  let rot = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  if (rot > 90) rot -= 180;
  if (rot < -90) rot += 180;
  const w = handDeg * PX_PER_DEG;
  const diff = handDeg - real;
  const fit = Math.abs(diff) < 0.06 * real ? 'covers it almost exactly' : diff < 0 ? `falls short by ${(-diff).toFixed(1)}°` : `overshoots by ${diff.toFixed(1)}°`;

  return (
    <div>
      <Svg w={720} h={390} title={meta.title} desc="The seven stars of the Big Dipper drawn to scale, with the outline of a hand at arm's length laid over two of its stars to show how many fingers, fists or hand spans they are apart.">
        <defs>
          <clipPath id={clip}>
            <rect x={1} y={1} width={718} height={388} rx={10} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <g transform={`translate(${mx} ${my}) rotate(${rot}) scale(${w})`}>
            <HandShape kind={cfg.hand} />
          </g>
        </g>
        <polyline points={LINE.map((n) => P[n].join(',')).join(' ')} fill="none" stroke={C.lineStrong} strokeWidth={1.2} />
        {Object.entries(STARS).map(([n, [, , mag]]) => (
          <circle key={n} cx={P[n][0]} cy={P[n][1]} r={Math.max(1.8, 6.4 - mag * 1.1)} fill={C.star} />
        ))}
        {/* measured pair */}
        <line x1={ax} y1={ay} x2={bx} y2={by} stroke={C.amber} strokeWidth={1.5} strokeDasharray="5 4" />
        {Object.keys(STARS)
          .filter((n) => n !== 'Alcor')
          .map((n) => {
            const [x, y] = P[n];
            const below = n === 'Merak' || n === 'Phecda' || n === 'Alkaid' || n === 'Mizar';
            const on = n === cfg.a || n === cfg.b;
            return (
              <Label key={n} x={x + (n === 'Dubhe' || n === 'Merak' ? 12 : 0)} y={y + (below ? 22 : -12)} anchor={n === 'Dubhe' || n === 'Merak' ? 'start' : 'middle'} size={on ? 'm' : 's'} color={on ? C.text : C.dim} weight={on ? 600 : 400}>
                {n}
              </Label>
            );
          })}
        <Label x={20} y={30} size="s" color={C.dim}>
          drawn to scale, north up, east left
        </Label>
        {/* scale bar */}
        <line x1={20} x2={20 + 10 * PX_PER_DEG} y1={370} y2={370} stroke={C.lineStrong} strokeWidth={2} />
        <line x1={20} x2={20} y1={364} y2={376} stroke={C.lineStrong} strokeWidth={2} />
        <line x1={20 + 10 * PX_PER_DEG} x2={20 + 10 * PX_PER_DEG} y1={364} y2={376} stroke={C.lineStrong} strokeWidth={2} />
        <Label x={20 + 5 * PX_PER_DEG} y={360} anchor="middle" size="s" color={C.dim}>
          10°
        </Label>
        <Label x={700} y={372} anchor="end" size="s" color={C.amber}>
          {`${cfg.part}: ${real.toFixed(1)}°`}
        </Label>
      </Svg>
      <Controls>
        <ChoiceControl
          label="Measure"
          value={m}
          options={[
            { value: 'pointers', label: 'Pointers' },
            { value: 'bowl', label: 'Top of bowl' },
            { value: 'dipper', label: 'Whole Dipper' },
          ]}
          onChange={setM}
        />
        <RangeControl label="Your hand" value={scale} min={80} max={120} step={5} onChange={setScale} format={(v) => (v === 100 ? 'typical' : v < 100 ? `${100 - v}% smaller` : `${v - 100}% bigger`)} />
      </Controls>
      <Readout>
        {`${cfg.part[0].toUpperCase()}${cfg.part.slice(1)} is ${real.toFixed(1)}°. ${cfg.tool[0].toUpperCase()}${cfg.tool.slice(1)} at arm's length ${scale === 100 ? `covers about ${cfg.deg}°, so it ${fit}` : `on your hand covers about ${handDeg.toFixed(1)}° and ${fit}`}. `}
        {scale === 100 ? 'Hands vary: resize the outline to see what a slightly bigger or smaller hand would show.' : 'Whatever your hand shows on the Dipper is your personal correction for every other measurement.'}
      </Readout>
    </div>
  );
}
