import { useEffect, useRef, type CSSProperties } from 'react';
import { useCatalog } from '@/data/catalog';
import type { SkyController, SkyEngineOptions } from '@/types';
import { createSkyEngine } from './engine';
import './sky.css';

export interface SkyViewProps {
  options: SkyEngineOptions;
  onReady?: (c: SkyController) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Fills its parent with one sky engine. `options` are read once, when the engine is created; later changes
 * go through the controller handed to `onReady` (called once, after the first frame is on screen).
 */
export function SkyView({ options, onReady, className, style }: SkyViewProps): JSX.Element {
  const catalog = useCatalog();
  const host = useRef<HTMLDivElement>(null);
  const optionsRef = useRef(options);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const el = host.current;
    if (!catalog || !el) return;
    const dbg = (globalThis as { __SKY_DEBUG__?: boolean }).__SKY_DEBUG__;
    const engine = createSkyEngine(el, catalog, optionsRef.current, dbg ? { checkGlErrors: true } : undefined);
    const off = engine.on('ready', () => onReadyRef.current?.(engine));
    // StrictMode mounts twice in development: the first engine is destroyed here before its first frame,
    // so `onReady` only ever fires for the engine that stays.
    return () => {
      off();
      engine.destroy();
    };
  }, [catalog]);

  return (
    <div ref={host} className={className ? `sky-view ${className}` : 'sky-view'} style={style}>
      {!catalog && <div className="sky-view-loading" role="status">Loading the sky…</div>}
    </div>
  );
}
