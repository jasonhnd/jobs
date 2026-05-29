#!/usr/bin/env bun
/**
 * check-score-batch.ts — STANDALONE dev pre-flight for a new AI-risk score batch.
 *
 * IMPORTANT: this is a LOCAL developer tool. It is deliberately NOT wired into
 * `build`, `verify:gates`, or `vercel.json`, so it NEVER runs in a Vercel
 * build/deploy. It touches nothing outside reading local files — zero
 * production impact. Run it by hand before dropping a new batch into the build.
 *
 * What it checks for a candidate data/scores/<...>.json:
 *   1. Schema    — validates against the SAME ScoreRunSchema the build uses.
 *   2. Coverage  — which of the real occupations are scored / missing / extra.
 *   3. Freshness — is run_date newer than every other batch (else it won't win).
 *   4. Drift     — vs the current latest scores: how many changed, and the
 *                  before/after band distribution (low/mid/high).
 *
 * Usage:
 *   bun scripts/check-score-batch.ts data/scores/occupations_<model>_<YYYY-MM-DD>.json
 *
 * Exit codes: 0 = schema valid (warnings are advisory); 1 = bad args /
 * unreadable / schema-invalid.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ScoreRunSchema } from '../src/data/schema/score-run.js';

const ROOT = resolve(import.meta.dir, '..');
const OCC_DIR = join(ROOT, 'data', 'occupations');
const SCORES_DIR = join(ROOT, 'data', 'scores');

/** ai_risk band — matches bands.ts riskBand (decimal-safe): < 4.0 low / < 7.0 mid / ≥ 7.0 high. */
function band(r: number): 'low' | 'mid' | 'high' {
  if (r < 4) return 'low';
  if (r < 7) return 'mid';
  return 'high';
}

function fail(msg: string): never {
  console.error(`[check-score-batch] FAIL — ${msg}`);
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  fail('no file given.\n  Usage: bun scripts/check-score-batch.ts data/scores/<batch>.json');
}
const candidatePath = resolve(arg);
if (!existsSync(candidatePath)) fail(`file not found: ${candidatePath}`);

// ---- 1. Schema ----
let raw: unknown;
try {
  raw = JSON.parse(readFileSync(candidatePath, 'utf8'));
} catch (err) {
  fail(`not valid JSON: ${(err as Error).message}`);
}
const parsed = ScoreRunSchema.safeParse(raw);
if (!parsed.success) {
  console.error('[check-score-batch] FAIL — does not match ScoreRunSchema:\n');
  for (const issue of parsed.error.issues.slice(0, 25)) {
    console.error(`  ${issue.path.join('.') || '<root>'}: ${issue.message}`);
  }
  const extra = parsed.error.issues.length - 25;
  if (extra > 0) console.error(`  …and ${extra} more.`);
  process.exit(1);
}
const batch = parsed.data;
console.log(`[check-score-batch] schema OK — scope=${batch.scope}, model=${batch.scorer.model}, run_date=${batch.run.run_date}`);

if (batch.scope !== 'occupations') {
  console.log(`[check-score-batch] scope is "${batch.scope}" (not occupations) — skipping occupation coverage/drift.`);
  process.exit(0);
}

// ---- 2. Coverage ----
const realOccIds = new Set(
  readdirSync(OCC_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => Number.parseInt(f.replace(/\.json$/, ''), 10))
    .filter((n) => Number.isFinite(n)),
);
const scoredIds = Object.keys(batch.scores).map((k) => Number.parseInt(k, 10));
const scoredSet = new Set(scoredIds);
const missing = [...realOccIds].filter((id) => !scoredSet.has(id)).sort((a, b) => a - b);
const extra = scoredIds.filter((id) => !realOccIds.has(id)).sort((a, b) => a - b);

console.log(`\n[coverage] scored ${scoredSet.size} / ${realOccIds.size} occupations`);
if (missing.length) {
  console.log(`  missing ${missing.length}: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ' …' : ''}`);
} else {
  console.log('  missing 0 — full coverage');
}
if (extra.length) {
  console.log(`  WARNING ${extra.length} scored id(s) have no occupation file: ${extra.slice(0, 20).join(', ')}${extra.length > 20 ? ' …' : ''}`);
}

// ---- baseline: current latest (occupations) from all OTHER batches ----
const currentLatest = new Map<number, { ai_risk: number; date: string }>();
let otherBatches = 0;
for (const f of readdirSync(SCORES_DIR).filter((f) => f.endsWith('.json'))) {
  const p = join(SCORES_DIR, f);
  if (resolve(p) === candidatePath) continue; // exclude the candidate itself
  let other: { scope?: string; run?: { run_date?: string }; scores?: Record<string, { ai_risk?: number }> };
  try {
    other = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    console.log(`  (skipped unreadable batch ${f})`);
    continue;
  }
  if (other.scope !== 'occupations' || !other.scores || !other.run?.run_date) continue;
  otherBatches += 1;
  const date = other.run.run_date;
  for (const [k, v] of Object.entries(other.scores)) {
    const id = Number.parseInt(k, 10);
    if (!Number.isFinite(id) || typeof v.ai_risk !== 'number') continue;
    const prev = currentLatest.get(id);
    if (!prev || date >= prev.date) currentLatest.set(id, { ai_risk: v.ai_risk, date });
  }
}

// ---- 3. Freshness ----
let maxOtherDate = '';
for (const { date } of currentLatest.values()) if (date > maxOtherDate) maxOtherDate = date;
console.log('\n[freshness]');
if (otherBatches === 0) {
  console.log('  no other occupation batches — this would be the only one (all scores brand-new).');
} else if (batch.run.run_date > maxOtherDate) {
  console.log(`  OK — run_date ${batch.run.run_date} is newer than all ${otherBatches} existing batch(es) (max ${maxOtherDate}); these scores win.`);
} else {
  console.log(`  WARNING — run_date ${batch.run.run_date} is NOT newer than existing max ${maxOtherDate}. For occupations also present in that batch, the existing scores win (ties → later-loaded) and this batch may have NO effect. Bump run_date.`);
}

// ---- 4. Drift vs current latest ----
let changed = 0;
let same = 0;
let brandNew = 0;
let candSum = 0;
let prevSum = 0;
let prevN = 0;
let emptyEn = 0;
const candBands = { low: 0, mid: 0, high: 0 };
const prevBands = { low: 0, mid: 0, high: 0 };
for (const [k, v] of Object.entries(batch.scores)) {
  const id = Number.parseInt(k, 10);
  candBands[band(v.ai_risk)] += 1;
  candSum += v.ai_risk;
  if (!v.rationale_en) emptyEn += 1;
  const prev = currentLatest.get(id);
  if (!prev) {
    brandNew += 1;
  } else {
    prevBands[band(prev.ai_risk)] += 1;
    prevSum += prev.ai_risk;
    prevN += 1;
    if (prev.ai_risk === v.ai_risk) same += 1;
    else changed += 1;
  }
}
const nScored = Object.keys(batch.scores).length;
console.log('\n[drift vs current latest]');
console.log(`  changed=${changed}  unchanged=${same}  brand-new=${brandNew}`);
console.log(
  `  mean (this batch): ${(candSum / nScored).toFixed(2)}` +
    `${prevN ? `   current (same set): ${(prevSum / prevN).toFixed(2)}` : ''}`,
);
console.log(`  band (this batch):    low=${candBands.low}  mid=${candBands.mid}  high=${candBands.high}`);
if (changed + same > 0) {
  console.log(`  band (current, same set): low=${prevBands.low}  mid=${prevBands.mid}  high=${prevBands.high}`);
}
if (emptyEn > 0) console.log(`  note: ${emptyEn} entr${emptyEn === 1 ? 'y has' : 'ies have'} empty rationale_en (EN pending).`);

console.log('\n[check-score-batch] done — schema valid. Warnings above are advisory; the build (ScoreRunSchema) is the hard gate.');
