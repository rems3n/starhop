/**
 * Why sky charts have east and west swapped. Left: you, seen from above, either standing over a map on the
 * ground or lying on your back with your head to the north. Right: what you see. Flipping from looking down to
 * looking up turns the view over, and east moves from the right-hand side to the left. North stays at the top.
 */
import { useEffect, useRef, useState } from 'react';
import { C, Controls, Label, PlayButton, RangeControl, Readout, Svg, usePrefersReducedMotion, type DiagramMeta, type DiagramProps } from '../kit';

export const meta: DiagramMeta = {
  title: 'Why sky charts swap east and west',
  summary: 'Flip from looking down at a map to looking up at the sky and watch east move from the right to the left while north stays on top.',
  params: { up: 'true to start looking up at the sky (default false)' },
};

const VX = 520, VY = 190, VW = 300, VH = 250; // view panel centre and size

// A few made-up "stars" for the sky view (decoration only, not a real chart).
const STARS: [number, number, number][] = [
  [-100, -70, 3], [-40, -88, 2], [20, -60, 3.5], [70, -80, 2], [110, -30, 2.5], [-120, 10, 2], [-60, 0, 3], [0, 20, 2], [60, 30, 3], [120, 60, 2],
  [-90, 70, 2.5], [-20, 80, 2], [40, 90, 2.5], [95, -95, 1.8], [-130, -100, 1.8], [10, -20, 1.8],
];

export default function SkyChartFlip({ params }: DiagramProps) {
  const reduced = usePrefersReducedMotion();
  const [t, setT] = useState(params?.up === true ? 1 : 0);
  const [target, setTarget] = useState<number | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    if (target === null) return;
    if (reduced) {
      setT(target);
      setTarget(null);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let done = false;
      setT((v) => {
        const n = v + Math.sign(target - v) * dt * 0.7;
        if ((target - v) * (target - n) <= 0) {
          done = true;
          return target;
        }
        return n;
      });
      if (!done) raf.current = requestAnimationFrame(tick);
      else setTarget(null);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, reduced]);

  const k = Math.cos(Math.PI * t); // +1 looking down, −1 looking up
  const up = t >= 0.5;
  const eastX = VX + (k * VW) / 2;
  const westX = VX - (k * VW) / 2;
  const sideAnchor = (x: number) => (x > VX + 20 ? 'start' : x < VX - 20 ? 'end' : 'middle');

  return (
    <div>
      <Svg w={720} h={380} title={meta.title} desc="Left: a person seen from above, first standing over a street map, then lying on their back with their head to the north. Right: what they see. Looking down, east is on the right; looking up at the sky, east is on the left, and north stays at the top.">
        {/* Left: where you are, seen from above */}
        <Label x={150} y={30} anchor="middle" size="s" color={C.dim}>
          You, seen from above
        </Label>
        <circle cx={150} cy={195} r={120} fill={C.panel} stroke={C.line} />
        <Label x={150} y={66} anchor="middle" weight={700} color={C.amber}>
          N
        </Label>
        <Label x={150} y={334} anchor="middle" weight={700}>
          S
        </Label>
        <Label x={282} y={200} anchor="middle" weight={700}>
          E
        </Label>
        <Label x={18} y={200} anchor="middle" weight={700}>
          W
        </Label>
        {!up ? (
          <g>
            {/* map lying on the ground in front of you (to the north) */}
            <rect x={110} y={95} width={80} height={60} fill="#1d2747" stroke={C.lineStrong} />
            <path d="M 110 125 H 190 M 150 95 V 155" stroke={C.dim} strokeWidth={1} />
            <Label x={196} y={112} size="s" color={C.dim}>
              map on the ground
            </Label>
            {/* standing person: shoulders and head, facing north */}
            <ellipse cx={150} cy={205} rx={30} ry={12} fill="#3a4672" />
            <circle cx={150} cy={203} r={12} fill={C.moon} />
            <path d="M 150 188 l -4 7 h 8 z" fill={C.moon} />
            <Label x={150} y={240} anchor="middle" size="s" color={C.dim}>
              standing, looking down
            </Label>
          </g>
        ) : (
          <g>
            {/* lying on your back, head to the north */}
            <rect x={136} y={150} width={28} height={110} rx={12} fill="#3a4672" />
            <rect x={120} y={158} width={60} height={16} rx={8} fill="#3a4672" />
            <circle cx={150} cy={138} r={13} fill={C.moon} />
            <circle cx={145} cy={136} r={1.8} fill={C.bg} />
            <circle cx={155} cy={136} r={1.8} fill={C.bg} />
            <Label x={172} y={128} size="s" color={C.dim}>
              head to the north
            </Label>
            <Label x={150} y={290} anchor="middle" size="s" color={C.dim}>
              lying on your back, looking up
            </Label>
            <Label x={66} y={168} anchor="middle" size="s" color={C.blue}>
              left hand
            </Label>
            <Label x={66} y={183} anchor="middle" size="s" color={C.blue}>
              = east
            </Label>
          </g>
        )}

        {/* Right: what you see */}
        <Label x={VX} y={30} anchor="middle" size="s" color={C.dim}>
          {up ? 'What you see: the sky overhead' : 'What you see: the map below you'}
        </Label>
        <g transform={`translate(${VX} ${VY}) scale(${Math.max(0.02, Math.abs(k))} 1)`}>
          <rect x={-VW / 2} y={-VH / 2} width={VW} height={VH} rx={8} fill={up ? '#0a1027' : '#1d2747'} stroke={C.lineStrong} strokeWidth={1.5} />
          {!up ? (
            <g stroke={C.dim} strokeWidth={1.2} opacity={0.8}>
              {[-90, -30, 30, 90].map((x) => (
                <line key={`v${x}`} x1={x} x2={x} y1={-VH / 2 + 6} y2={VH / 2 - 6} />
              ))}
              {[-80, -20, 40, 95].map((y) => (
                <line key={`h${y}`} x1={-VW / 2 + 6} x2={VW / 2 - 6} y1={y} y2={y} />
              ))}
              <path d={`M ${VW / 2 - 8} -${VH / 2 - 8} C 60 -20 90 40 ${VW / 2 - 40} ${VH / 2 - 8}`} stroke={C.blue} strokeWidth={10} opacity={0.5} fill="none" />
            </g>
          ) : (
            <g>
              {STARS.map(([x, y, r], i) => (
                <circle key={i} cx={x} cy={y} r={r} fill={C.star} />
              ))}
            </g>
          )}
        </g>
        {/* direction labels, positioned (not mirrored) so they stay readable */}
        <Label x={VX} y={VY - VH / 2 - 10} anchor="middle" weight={700} color={C.amber}>
          North
        </Label>
        <Label x={VX} y={VY + VH / 2 + 22} anchor="middle" weight={700}>
          South
        </Label>
        {Math.abs(k) > 0.15 && (
          <>
            <Label x={eastX + (k > 0 ? 8 : -8)} y={VY + 5} anchor={sideAnchor(eastX)} weight={700} color={C.blue}>
              East
            </Label>
            <Label x={westX + (k > 0 ? -8 : 8)} y={VY + 5} anchor={sideAnchor(westX)} weight={700}>
              West
            </Label>
          </>
        )}
      </Svg>
      <Controls>
        <RangeControl label="Turn your view over" value={Math.round(t * 100)} min={0} max={100} step={1} onChange={(v) => { setTarget(null); setT(v / 100); }} format={(v) => (v < 50 ? 'looking down' : 'looking up')} />
        <PlayButton playing={target !== null} onToggle={() => setTarget((cur) => (cur !== null ? null : t < 0.5 ? 1 : 0))} label={t < 0.5 ? 'Look up' : 'Look down'} />
      </Controls>
      <Readout>
        {Math.abs(k) <= 0.15
          ? 'Turning over: north stays at the top, but the sides are about to swap.'
          : !up
            ? 'Looking down at a map with north at the top, east is on your right. That is how street maps are drawn.'
            : 'Looking up with your head to the north, east is on your left. Star charts are drawn this way, so hold one over your head with its north edge toward north and it matches the sky.'}
      </Readout>
    </div>
  );
}
