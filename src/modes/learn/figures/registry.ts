/** Diagram registry: every file in ./diagrams is a diagram whose id is its file name. */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { DiagramMeta, DiagramProps } from './kit';

const loaders = import.meta.glob<{ default: ComponentType<DiagramProps>; meta: DiagramMeta }>('./diagrams/*.tsx');
const cache = new Map<string, LazyExoticComponent<ComponentType<DiagramProps>>>();

export const diagramIds = Object.keys(loaders).map((k) => k.replace(/^.*\/([a-z0-9-]+)\.tsx$/, '$1'));

export function getDiagram(id: string): LazyExoticComponent<ComponentType<DiagramProps>> | null {
  const load = loaders[`./diagrams/${id}.tsx`];
  if (!load) return null;
  let c = cache.get(id);
  if (!c) cache.set(id, (c = lazy(() => load().then((m) => ({ default: m.default })))));
  return c;
}
