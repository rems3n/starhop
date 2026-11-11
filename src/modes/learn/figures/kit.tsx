/**
 * Diagram kit: shared building blocks for lesson figures (see docs/FIGURES.md).
 * Everything is plain SVG + React, themed from the CSS tokens, responsive (viewBox) and accessible.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** Colours for diagrams. Use these, not raw hex, so figures match the app and red night-vision mode. */
export const C = {
  bg: 'var(--fig-bg)',
  panel: 'var(--night-800)',
  line: 'var(--fig-line)',
  lineStrong: 'var(--fig-line-strong)',
  text: 'var(--text)',
  dim: 'var(--text-dim)',
  faint: 'var(--text-faint)',
  amber: 'var(--amber)',
  blue: 'var(--vega)',
  good: 'var(--good)',
  bad: 'var(--bad)',
  sun: '#ffd27a',
  earth: '#5b8fd6',
  land: '#4d8a5a',
  moon: '#cfcab8',
  red: '#e0604f',
  star: '#f6f1e3',
} as const;

/** Responsive SVG canvas. `title` and `desc` are read by screen readers; keep desc to what the picture shows. */
export function Svg({ w, h, title, desc, children, className }: { w: number; h: number; title: string; desc: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <svg className={`fig-svg${className ? ` ${className}` : ''}`} viewBox={`0 0 ${w} ${h}`} role="img" aria-labelledby={`${id}t ${id}d`} preserveAspectRatio="xMidYMid meet">
      <title id={`${id}t`}>{title}</title>
      <desc id={`${id}d`}>{desc}</desc>
      <defs>
        <marker id="fig-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="context-stroke" />
        </marker>
        <radialGradient id="fig-glow">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="1" />
          <stop offset="0.35" stopColor="#ffd27a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {children}
    </svg>
  );
}

/** Text label. `anchor`: start | middle | end. `size`: s (12) | m (14) | l (17). */
export function Label({ x, y, children, anchor = 'start', size = 'm', color = C.text, weight = 500, italic }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; size?: 's' | 'm' | 'l'; color?: string; weight?: number; italic?: boolean }) {
  const fs = size === 's' ? 12 : size === 'l' ? 17 : 14;
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={fs} fill={color} fontWeight={weight} fontStyle={italic ? 'italic' : undefined} className="fig-label">
      {children}
    </text>
  );
}

/**
 * Annotation in the Bennett style: a leader line from a point on the drawing to a short label,
 * optionally with a second, dimmer line of explanation.
 */
export function Callout({ from, to, label, note, anchor = 'start', color = C.text }: { from: [number, number]; to: [number, number]; label: string; note?: string; anchor?: 'start' | 'middle' | 'end'; color?: string }) {
  return (
    <g className="fig-callout">
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={C.lineStrong} strokeWidth={1} />
      <circle cx={from[0]} cy={from[1]} r={2.5} fill={color} />
      <Label x={to[0] + (anchor === 'start' ? 4 : anchor === 'end' ? -4 : 0)} y={to[1] + 4} anchor={anchor} color={color} weight={600}>
        {label}
      </Label>
      {note && (
        <Label x={to[0] + (anchor === 'start' ? 4 : anchor === 'end' ? -4 : 0)} y={to[1] + 19} anchor={anchor} size="s" color={C.dim} weight={400}>
          {note}
        </Label>
      )}
    </g>
  );
}

export function Arrow({ x1, y1, x2, y2, color = C.lineStrong, width = 1.5, dashed, both }: { x1: number; y1: number; x2: number; y2: number; color?: string; width?: number; dashed?: boolean; both?: boolean }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeDasharray={dashed ? '5 4' : undefined} markerEnd="url(#fig-arrow)" markerStart={both ? 'url(#fig-arrow)' : undefined} />;
}

/** Numbered step marker for process diagrams (1, 2, 3 …). Use only when the figure really is a sequence. */
export function Step({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={10} fill={C.amber} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--amber-ink)">
        {n}
      </text>
    </g>
  );
}

// ───────────── Controls under a diagram ─────────────

/** Row of controls under the drawing. Put sliders, toggles and play buttons in here. */
export function Controls({ children }: { children: ReactNode }) {
  return <div className="fig-controls">{children}</div>;
}

export function RangeControl({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="fig-range">
      <span className="fig-range-label">
        {label} <output>{format ? format(value) : value}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function ChoiceControl<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="fig-choice" role="group" aria-label={label}>
      {label && <span className="fig-range-label">{label}</span>}
      <div className="segmented">
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlayButton({ playing, onToggle, label = 'Play' }: { playing: boolean; onToggle: () => void; label?: string }) {
  return (
    <button type="button" className="btn btn--sm" aria-pressed={playing} onClick={onToggle}>
      {playing ? 'Pause' : label}
    </button>
  );
}

/** Line of explanation that changes with the controls ("At 25 minutes your rods are…"). Announced politely. */
export function Readout({ children }: { children: ReactNode }) {
  return (
    <p className="fig-readout" aria-live="polite">
      {children}
    </p>
  );
}

// ───────────── Hooks ─────────────

export function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

/**
 * Animation clock for diagrams: returns a value advancing by `speed` units per second while `playing`.
 * Pauses when the figure is off screen. Under reduced motion it still works, but only when the learner presses Play.
 */
export function useAnimatedValue(initial: number, playing: boolean, speed: number, wrap?: [number, number]) {
  const [v, setV] = useState(initial);
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      setV((x) => {
        let n = x + speed * dt;
        if (wrap) {
          const [a, b] = wrap;
          n = a + ((((n - a) % (b - a)) + (b - a)) % (b - a));
        }
        return n;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, wrap?.[0], wrap?.[1]]);
  return [v, setV] as const;
}

// ───────────── Small geometry helpers ─────────────
export const rad = (d: number) => (d * Math.PI) / 180;
export const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos(rad(deg)), cy - r * Math.sin(rad(deg))];
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Props every diagram receives. `params` comes from the lesson JSON. */
export interface DiagramProps {
  params?: Record<string, unknown>;
}
/** Every diagram file exports `meta` describing itself (the validator and docs read it). */
export interface DiagramMeta {
  title: string;
  /** One line: what the learner sees and can do */
  summary: string;
  /** Names and meanings of supported params, if any */
  params?: Record<string, string>;
}
