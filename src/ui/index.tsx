/** Shared UI primitives. Styles in src/styles/ui.css. */
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Equipment } from '@/types';
import { EQUIPMENT_LABEL } from '@/lib/format';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'quiet'; size?: 'md' | 'sm'; icon?: boolean; pressed?: boolean };

export function Button({ variant = 'default', size = 'md', icon, pressed, className = '', ...rest }: BtnProps) {
  const cls = ['btn', variant !== 'default' && `btn--${variant}`, size === 'sm' && 'btn--sm', icon && 'btn--icon', className].filter(Boolean).join(' ');
  return <button type="button" className={cls} aria-pressed={pressed} {...rest} />;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="switch">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden />
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ value, min, max, step = 1, onChange, label }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string }) {
  return <input className="slider" type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />;
}

export function Chip({ tone, children }: { tone?: 'amber' | 'good' | 'bad'; children: ReactNode }) {
  return <span className={`chip${tone ? ` chip--${tone}` : ''}`}>{children}</span>;
}

export function EquipChip({ equip }: { equip: Equipment }) {
  return <Chip tone={equip === 'naked-eye' ? 'good' : undefined}>{EQUIPMENT_LABEL[equip]}</Chip>;
}

export function Meter({ value, label }: { value: number; label?: string }) {
  return (
    <div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <span style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal" role="dialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h4>{title}</h4>
          <Button variant="quiet" size="sm" icon aria-label="Close" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}

export function Loading({ label = 'Loading the sky…' }: { label?: string }) {
  return <div className="center-fill">{label}</div>;
}

/**
 * Renders authored text with the two inline conventions from src/content/schema.ts:
 * [[TargetRef|label]] → "show in sky" link, *text* → italics.
 * `onTarget` overrides the default behaviour (open the target in Explore).
 */
export function RichText({ text, onTarget }: { text: string; onTarget?: (ref: string) => void }) {
  const navigate = useNavigate();
  const go = onTarget ?? ((ref: string) => navigate(`/explore?target=${encodeURIComponent(ref)}`));
  const out: ReactNode[] = [];
  const re = /\[\[([^\]|]+)\|([^\]]+)\]\]|\*([^*\n]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const ref = m[1].trim();
      out.push(
        <button key={k++} type="button" className="sky-link" title="Show in the sky" onClick={() => go(ref)}>
          {m[2]}
        </button>,
      );
    } else out.push(<em key={k++}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** Paragraph list rendered as prose. */
export function Prose({ paragraphs, onTarget }: { paragraphs: string[]; onTarget?: (ref: string) => void }) {
  return (
    <div className="prose">
      {paragraphs.map((p, i) => (
        <p key={i}>
          <RichText text={p} onTarget={onTarget} />
        </p>
      ))}
    </div>
  );
}

export { McqQuestion, type McqQuestionProps } from './Mcq';
