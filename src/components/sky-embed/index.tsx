/**
 * Embedded sky map with its own compact controls (owner: sky-embed engineer; see docs/briefs/v2.md).
 * PLACEHOLDER: renders a plain SkyView until the real implementation lands. The props contract is FIXED.
 */
import type { CSSProperties } from 'react';
import { SkyView } from '@/sky';
import type { LayerState, SkyController, SkyEngineOptions, TargetRef } from '@/types';

export interface SkyEmbedProps {
  options: SkyEngineOptions;
  onReady?: (c: SkyController) => void;
  className?: string;
  style?: CSSProperties;
  /**
   * 'full'    = layer toggles, light-pollution slider, reset, "open in the sky map" (lessons, library, tonight)
   * 'limited' = only the layers listed in `allowedLayers` (quizzes, governed by difficulty)
   * 'none'    = no controls
   */
  controls?: 'full' | 'limited' | 'none';
  allowedLayers?: (keyof LayerState)[];
  /** What "Open in the sky map" should centre on (defaults to the view centre) */
  openTarget?: TargetRef;
  /** Called after the user changes a layer/limiting magnitude through the embed controls */
  onUserChange?: (change: { layers?: Partial<LayerState>; limitingMag?: number }) => void;
}

export function SkyEmbed({ options, onReady, className, style }: SkyEmbedProps) {
  return <SkyView options={options} onReady={onReady} className={className} style={style} />;
}
