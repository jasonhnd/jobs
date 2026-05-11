// scripts/sample-numeric-ranges.ts — one-off audit utility.
//
// Walks data/occupations/*.json and reports the observed min/max of every
// numeric subdivision so we can pick correct Zod `.min().max()` bounds
// without guessing. Run with `npx tsx scripts/sample-numeric-ranges.ts`.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'data', 'occupations');

const DIMENSIONS = [
  'interests',
  'work_values',
  'skills',
  'knowledge',
  'abilities',
  'work_characteristics',
  'work_activities',
  'education_distribution',
  'training_pre',
  'training_post',
  'experience',
  'employment_type',
] as const;

type Stat = { min: number; max: number; count: number; files: Set<string> };

const stats = new Map<string, Stat>();

const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
for (const file of files) {
  const raw = readFileSync(join(DIR, file), 'utf-8');
  const obj = JSON.parse(raw);
  for (const dim of DIMENSIONS) {
    const block = obj[dim];
    if (block == null) continue;
    let s = stats.get(dim);
    if (!s) { s = { min: Infinity, max: -Infinity, count: 0, files: new Set() }; stats.set(dim, s); }
    for (const v of Object.values(block) as number[]) {
      if (typeof v !== 'number' || Number.isNaN(v)) continue;
      if (v < s.min) s.min = v;
      if (v > s.max) s.max = v;
      s.count += 1;
      s.files.add(file);
    }
  }
}

console.log(`Scanned ${files.length} files.\n`);
console.log('Dimension'.padEnd(24) + 'min'.padStart(10) + 'max'.padStart(10) + 'count'.padStart(10) + '  files');
console.log('-'.repeat(72));
for (const dim of DIMENSIONS) {
  const s = stats.get(dim);
  if (!s) { console.log(`${dim.padEnd(24)}${'(absent)'.padStart(10)}`); continue; }
  console.log(`${dim.padEnd(24)}${s.min.toFixed(3).padStart(10)}${s.max.toFixed(3).padStart(10)}${String(s.count).padStart(10)}  ${s.files.size}`);
}
