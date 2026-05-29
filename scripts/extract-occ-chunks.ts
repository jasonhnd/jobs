#!/usr/bin/env bun
/**
 * extract-occ-chunks.ts — dump compact, human-readable occupation extracts in
 * fixed-size chunks for IN-AGENT scoring. This is the alternative to the
 * Batches-API path (scripts/run-scoring.ts): instead of paying for 556 API
 * calls, the running Opus model (which IS claude-opus-4-8) reads each chunk
 * file and emits {id, ai_risk, rationale_ja, confidence} JSONL per occupation,
 * applying data/prompts/prompt_opus-4-8.ja.md. See docs/SCORING_RUNBOOK.md §2.
 *
 * The extract mirrors run-scoring.ts extractOcc() (title + aliases + summary +
 * what_it_is + working_conditions) so both scoring paths see the SAME inputs
 * and stay comparable across model upgrades (4.8 → 4.9 → 5.0). Long prose is
 * truncated only to keep chunks scannable; the scoring signal is preserved.
 *
 * LOCAL dev tool — NOT wired into build / verify:gates / vercel.json.
 *
 * Usage: bun scripts/extract-occ-chunks.ts [--size 40] [--out .cache/scoring]
 * Output: <out>/chunk-NN.txt (one per chunk) + <out>/ids.txt (coverage manifest)
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const OCC_DIR = join(ROOT, 'data', 'occupations');

// ---- CLI ----
const args: Record<string, string> = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i]!;
  if (!a.startsWith('--')) continue;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) args[a.slice(2)] = 'true';
  else {
    args[a.slice(2)] = v;
    i += 1;
  }
}
const size = Number.parseInt(args['size'] ?? '40', 10);
const outDir = resolve(ROOT, args['out'] ?? join('.cache', 'scoring'));

const oneLine = (s: string): string => s.replace(/\s*\n\s*/g, ' ').trim();
const truncate = (s: string, n: number): string =>
  s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;

interface OccExtract {
  readonly id: number;
  readonly text: string;
}
function extractOcc(raw: Record<string, any>): OccExtract {
  const d = (raw.description ?? {}) as Record<string, string | undefined>;
  const aliases = Array.isArray(raw.aliases_ja) ? (raw.aliases_ja as string[]) : [];
  const text = [
    `## id=${raw.id} ${raw.title_ja ?? ''}`,
    aliases.length ? `別名: ${aliases.join('、')}` : '',
    d.summary_ja ? `概要: ${oneLine(d.summary_ja)}` : '',
    d.what_it_is_ja ? `仕事内容: ${truncate(oneLine(d.what_it_is_ja), 320)}` : '',
    d.working_conditions_ja ? `労働条件: ${truncate(oneLine(d.working_conditions_ja), 200)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { id: Number(raw.id), text };
}

const all: OccExtract[] = readdirSync(OCC_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => extractOcc(JSON.parse(readFileSync(join(OCC_DIR, f), 'utf8')) as Record<string, any>));

mkdirSync(outDir, { recursive: true });
const chunks: OccExtract[][] = [];
for (let i = 0; i < all.length; i += size) chunks.push(all.slice(i, i + size));

chunks.forEach((ch, idx) => {
  const n = String(idx + 1).padStart(2, '0');
  const header =
    `# Chunk ${n}/${chunks.length} — ${ch.length} occupations (ids ${ch[0]!.id}–${ch[ch.length - 1]!.id})\n` +
    `# AI-risk 0.0–10.0 (one decimal). Anchors: データ入力9.9 翻訳9.1 ﾌﾟﾛｸﾞﾗﾏ8.8 会計士7.0 弁護士6.4 看護師4.3 美容師2.4 林業0.6\n` +
    `# Emit one JSONL line per id: {"id":N,"ai_risk":X.X,"rationale_ja":"…","confidence":0.0-1.0}\n`;
  writeFileSync(
    join(outDir, `chunk-${n}.txt`),
    `${header}\n${ch.map((o) => o.text).join('\n\n')}\n`,
  );
});

writeFileSync(join(outDir, 'ids.txt'), `${all.map((o) => o.id).join('\n')}\n`);
console.log(
  `[extract] ${all.length} occupations → ${chunks.length} chunks of ${size} → ${outDir}`,
);
console.log(`  id range: ${Math.min(...all.map((o) => o.id))}–${Math.max(...all.map((o) => o.id))}`);
