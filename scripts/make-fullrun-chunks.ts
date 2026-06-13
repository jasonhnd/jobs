#!/usr/bin/env bun
/**
 * make-fullrun-chunks.ts — Issue #9 Phase 7: extract chunks for the full-run
 * remainder (all occupations EXCEPT the ids in an exclude manifest, normally
 * the approved pilot sample whose scores are carried unchanged).
 *
 * Same extract shape as the Opus run (extract-occ-chunks extractOcc); chunk
 * headers carry NO rubric — the frozen Fable 5 prompt is the canon.
 *
 * LOCAL dev tool — NOT wired into build / verify:gates / vercel.json.
 *
 * Usage:
 *   bun scripts/make-fullrun-chunks.ts \
 *     [--exclude .cache/scoring/issue-9/pilot/sample.json] \
 *     [--chunk 10] [--out .cache/scoring/issue-9/full/chunks]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { extractOcc, type OccExtract } from './extract-occ-chunks.js';

const ROOT = resolve(import.meta.dir, '..');
const OCC_DIR = join(ROOT, 'data', 'occupations');
const fail = (m: string): never => {
  console.error(`[make-fullrun-chunks] FAIL — ${m}`);
  process.exit(1);
};

const args: Record<string, string> = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i]!;
  if (!a.startsWith('--')) continue;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) fail(`--${a.slice(2)} needs a value`);
  args[a.slice(2)] = v as string;
  i += 1;
}

const chunkSize = Number.parseInt(args['chunk'] ?? '10', 10);
if (!Number.isInteger(chunkSize) || chunkSize < 1) fail('--chunk must be a positive integer');
const excludePath = resolve(ROOT, args['exclude'] ?? '.cache/scoring/issue-9/pilot/sample.json');
const outDir = resolve(ROOT, args['out'] ?? '.cache/scoring/issue-9/full/chunks');

let excluded = new Set<number>();
if (existsSync(excludePath)) {
  const manifest = JSON.parse(readFileSync(excludePath, 'utf8')) as { ids?: number[] };
  if (!Array.isArray(manifest.ids)) fail(`exclude manifest has no ids[]: ${excludePath}`);
  excluded = new Set(manifest.ids);
} else {
  fail(`exclude manifest not found: ${excludePath} (pass --exclude or create the pilot sample first)`);
}

const all: OccExtract[] = readdirSync(OCC_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => extractOcc(JSON.parse(readFileSync(join(OCC_DIR, f), 'utf8')) as Record<string, any>))
  .filter((o) => !excluded.has(o.id));

mkdirSync(outDir, { recursive: true });
const chunks: OccExtract[][] = [];
for (let i = 0; i < all.length; i += chunkSize) chunks.push(all.slice(i, i + chunkSize));

chunks.forEach((ch, idx) => {
  const n = String(idx + 1).padStart(3, '0');
  const header =
    `# Issue-9 full-run chunk ${n}/${chunks.length} — ${ch.length} occupations (ids ${ch.map((o) => o.id).join(', ')})\n` +
    `# 採点指示の正典: data/prompts/2026-06-13_claude-fable-5-aiois10.ja.md（このファイル自体に採点指示は書かない）\n`;
  writeFileSync(join(outDir, `full-chunk-${n}.txt`), `${header}\n${ch.map((o) => o.text).join('\n\n')}\n`);
});

writeFileSync(join(outDir, 'ids.txt'), `${all.map((o) => o.id).join('\n')}\n`);
console.log(
  `[make-fullrun-chunks] OK — ${all.length} occupations (excluded ${excluded.size}) → ${chunks.length} chunks of ${chunkSize} → ${outDir}`,
);
