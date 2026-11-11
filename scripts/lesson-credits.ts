/**
 * Rebuilds the "Lesson images" section of CREDITS.md from the figures in src/content/lessons/*.json.
 * Run: npx tsx scripts/lesson-credits.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FigureImage, Lesson } from '../src/content/schema';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dir = join(root, 'src/content/lessons');
const rows = new Map<string, { img: FigureImage; lessons: Set<string> }>();
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const l = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Lesson;
  for (const s of l.sections)
    for (const fig of s.figures ?? []) {
      const imgs = fig.type === 'image' ? [fig.image] : fig.type === 'gallery' ? fig.images : [];
      for (const img of imgs) {
        const r = rows.get(img.file) ?? { img, lessons: new Set<string>() };
        r.lessons.add(l.id);
        rows.set(img.file, r);
      }
    }
}
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const lines = [
  '## Lesson images',
  '',
  'Photos and illustrations used in lesson figures. Files under `img/lessons/` were added for the lessons; others are reused from the gallery above.',
  'All diagrams in lessons are original drawings made for this project (`src/modes/learn/figures/diagrams/`).',
  '',
  '| File | Lessons | Kind | Credit | Licence | Source |',
  '|---|---|---|---|---|---|',
  ...[...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, { img, lessons }]) => `| \`${file}\` | ${[...lessons].join(', ')} | ${img.kind}${img.kindNote ? ` (${esc(img.kindNote)})` : ''} | ${esc(img.credit)} | ${img.licenseUrl ? `[${esc(img.license)}](${img.licenseUrl})` : esc(img.license)} | <${img.sourceUrl}> |`),
  '',
];
const creditsPath = join(root, 'CREDITS.md');
let credits = readFileSync(creditsPath, 'utf8');
const start = credits.indexOf('## Lesson images');
if (start >= 0) credits = credits.slice(0, start).trimEnd() + '\n';
writeFileSync(creditsPath, `${credits.trimEnd()}\n\n${lines.join('\n')}`);
console.log(`Lesson images: ${rows.size}`);
