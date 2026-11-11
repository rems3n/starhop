/** Star-hop library access for the Library pages (one place to read `starhops`). */
import { starhopById, starhops, type Starhop } from '@/content';

export function allStarhops(): Starhop[] {
  return starhops;
}
export function getStarhop(id: string): Starhop | undefined {
  return starhopById.get(id);
}
