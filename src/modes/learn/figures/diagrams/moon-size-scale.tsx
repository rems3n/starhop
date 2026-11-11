/**
 * How big the Moon really looks: about half a degree. Three comparisons at true angular scale:
 * the Moon beside a little finger at arm's length (1°), a row of Moons across the Big Dipper's Pointers,
 * and the Moon low over rooftops versus high in the sky (the same size: the "Moon illusion").
 * Tonight's apparent diameter is computed from the Moon's distance (astronomy-engine), with the yearly range from
 * perigee (≈356,400 km) to apogee (≈406,700 km). Moon radius 1,737.4 km.
 */
import { useMemo, useState } from 'react';
import { GeoMoon } from 'astronomy-engine';
import { C, ChoiceControl, Controls, Label, Readout, Svg, rad, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'How big the Moon looks',
  summary: 'The Moon at true angular scale beside a little finger, lined up across the Big Dipper’s Pointers, and low versus high in the sky.',
  params: { view: '"finger" | "pointers" | "illusion" (default "finger")' },
};

const R_MOON = 1737.4;
const KM_PER_AU = 149597870.7;
const diam = (km: number) => (2 * Math.atan(R_MOON / km) * 180) / Math.PI;
const POINTERS_DEG = 5.4; // Merak–Dubhe, from catalog positions

type View = 'finger' | 'pointers' | 'illusion';

function MoonDisc({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={C.moon} />
      <circle cx={x - r * 0.3} cy={y - r * 0.2} r={r * 0.22} fill="#b4af9c" opacity={0.7} />
      <circle cx={x + r * 0.25} cy={y + r * 0.3} r={r * 0.15} fill="#b4af9c" opacity={0.6} />
      <circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.1} fill="#b4af9c" opacity={0.6} />
    </g>
  );
}

export default function MoonSizeScale({ params }: DiagramProps) {
  const [view, setView] = useState<View>(params?.view === 'pointers' || params?.view === 'illusion' ? (params.view as View) : 'finger');
  const tonight = useMemo(() => {
    const v = GeoMoon(new Date());
    const km = Math.hypot(v.x, v.y, v.z) * KM_PER_AU;
    return { km, deg: diam(km) };
  }, []);
  const dMin = diam(406700), dMax = diam(356400);
  const d = tonight.deg;
  const count = POINTERS_DEG / d;

  let body: JSX.Element;
  if (view === 'finger') {
    const k = 190; // px per degree
    const fw = 1 * k;
    body = (
      <g>
        {/* little finger at arm's length, 1° wide */}
        <rect x={150} y={70} width={fw} height={290} rx={fw / 2} fill="rgba(232, 196, 160, 0.92)" />
        <path d={`M ${150 + fw * 0.2} 112 q ${fw * 0.3} -14 ${fw * 0.6} 0`} fill="none" stroke="rgba(120,80,60,0.6)" strokeWidth={2} />
        <line x1={150} x2={150 + fw} y1={52} y2={52} stroke={C.lineStrong} markerStart="url(#fig-arrow)" markerEnd="url(#fig-arrow)" />
        <Label x={150 + fw / 2} y={42} anchor="middle" weight={600}>
          1°
        </Label>
        <Label x={150 + fw / 2} y={384} anchor="middle" size="s" color={C.amber}>
          little finger at arm's length
        </Label>
        <MoonDisc x={500} y={200} r={(d * k) / 2} />
        <line x1={500 - (d * k) / 2} x2={500 + (d * k) / 2} y1={52} y2={52} stroke={C.lineStrong} markerStart="url(#fig-arrow)" markerEnd="url(#fig-arrow)" />
        <Label x={500} y={42} anchor="middle" weight={600}>
          {`${d.toFixed(2)}°`}
        </Label>
        <line x1={500 - (d * k) / 2} x2={500 - (d * k) / 2} y1={58} y2={200 - (d * k) / 2} stroke={C.line} strokeDasharray="3 3" />
        <line x1={500 + (d * k) / 2} x2={500 + (d * k) / 2} y1={58} y2={200 - (d * k) / 2} stroke={C.line} strokeDasharray="3 3" />
        <Label x={500} y={200 + (d * k) / 2 + 26} anchor="middle" size="s" color={C.dim}>
          the full Moon, at the same scale
        </Label>
        <Label x={20} y={30} size="s" color={C.dim}>
          magnified view
        </Label>
      </g>
    );
  } else if (view === 'pointers') {
    const k = 118;
    const x0 = 360 - (POINTERS_DEG * k) / 2;
    const n = Math.floor(count);
    body = (
      <g>
        <circle cx={x0} cy={190} r={7} fill={C.star} />
        <circle cx={x0 + POINTERS_DEG * k} cy={190} r={8} fill={C.star} />
        <Label x={x0} y={140} anchor="middle" weight={600}>
          Merak
        </Label>
        <Label x={x0 + POINTERS_DEG * k} y={140} anchor="middle" weight={600}>
          Dubhe
        </Label>
        {Array.from({ length: n }, (_, i) => (
          <MoonDisc key={i} x={x0 + ((POINTERS_DEG - n * d) / 2 + (i + 0.5) * d) * k} y={190} r={(d * k) / 2 - 0.5} />
        ))}
        <line x1={x0} x2={x0 + POINTERS_DEG * k} y1={250} y2={250} stroke={C.lineStrong} markerStart="url(#fig-arrow)" markerEnd="url(#fig-arrow)" />
        <Label x={360} y={276} anchor="middle" color={C.amber} weight={600}>
          {`the Pointers: ${POINTERS_DEG}° apart = ${count.toFixed(1)} full Moons`}
        </Label>
        <Label x={360} y={300} anchor="middle" size="s" color={C.dim}>
          three fingers at arm's length
        </Label>
      </g>
    );
  } else {
    const k = 70;
    const r = (d * k) / 2;
    const ground = 340;
    // a generic skyline: [left x, width, height]
    const blocks: [number, number, number][] = [[0, 60, 34], [60, 32, 92], [92, 58, 48], [150, 60, 120], [210, 50, 70], [260, 40, 150], [300, 60, 40], [360, 60, 96], [420, 50, 60], [470, 60, 36], [530, 70, 84], [600, 60, 58], [660, 60, 72]];
    const sky = `M 0 410 ${blocks.map(([x, w, h]) => `L ${x} ${ground - h} L ${x + w} ${ground - h}`).join(' ')} L 720 410 Z`;
    body = (
      <g>
        <path d={sky} fill="#141a33" stroke={C.lineStrong} />
        <MoonDisc x={121} y={ground - 48 - 40 - r} r={r} />
        <MoonDisc x={560} y={90} r={r} />
        {/* finger-width brackets, 1° */}
        {[[121, ground - 48 - 40 - r], [560, 90]].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - k / 2} y={y + r + 8} width={k} height={10} rx={5} fill="rgba(232, 196, 160, 0.8)" />
            <Label x={x + k / 2 + 8} y={y + r + 17} size="s" color={C.dim}>
              1° finger
            </Label>
          </g>
        ))}
        <Label x={121} y={ground - 48 - 52 - 2 * r} anchor="middle" size="s" color={C.dim}>
          low over the rooftops
        </Label>
        <Label x={560} y={90 - r - 12} anchor="middle" size="s" color={C.dim}>
          high in the sky
        </Label>
        <Label x={20} y={30} size="s" color={C.dim}>
          both Moons drawn the same true size
        </Label>
      </g>
    );
  }

  return (
    <div>
      <Svg w={720} h={410} title={meta.title} desc="The full Moon drawn at true angular scale: about half the width of a little finger held at arm's length, about ten Moons fitting between the Big Dipper's two Pointer stars, and the same size whether low over rooftops or high in the sky.">
        {body}
      </Svg>
      <Controls>
        <ChoiceControl
          label="Compare the Moon with"
          value={view}
          options={[
            { value: 'finger', label: 'Little finger' },
            { value: 'pointers', label: 'The Pointers' },
            { value: 'illusion', label: 'Low vs high' },
          ]}
          onChange={setView}
        />
      </Controls>
      <Readout>
        {view === 'finger'
          ? `Tonight the Moon is ${Math.round(tonight.km).toLocaleString('en-US')} km away and ${d.toFixed(2)}° wide; over the year it ranges from ${dMin.toFixed(2)}° to ${dMax.toFixed(2)}°. Your little finger at arm's length, about 1°, covers it twice over.`
          : view === 'pointers'
            ? `About ${Math.round(count)} full Moons fit in the ${POINTERS_DEG}° gap between the Pointers. Constellations are much bigger than beginners expect.`
            : 'Both Moons are drawn exactly the same size. A rising Moon only looks huge: hold your little finger next to it and it still covers it easily. Nobody fully agrees why the brain is fooled, but the measurement settles it.'}
      </Readout>
    </div>
  );
}
