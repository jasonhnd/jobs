#!/usr/bin/env bun
/**
 * make-pilot-sample.ts — pilot sample selector
 * (docs/SCORING_RUNBOOK.md Phase 3).
 *
 * Deterministically picks 30–50 representative occupations from the current
 * baseline batch and writes the sample manifest plus extract chunks for the
 * scoring pass. No randomness — same inputs, same sample.
 *
 * The baseline defaults to the newest AIOIS-10 batch in data/scores/ rather
 * than a pinned filename, so the sample is always stratified against the batch
 * that is actually canonical.
 *
 * Selection (ties → lower id):
 *   - named exemplars (the /standard calibration set + Opus anchors), matched
 *     by title/alias substring
 *   - top 3 by displacement; top 3 by transformation−displacement gap
 *   - band quotas (high 25% / mid 37.5% / low rest) filled evenly across each
 *     band's ai_risk order (low < 4.0 / mid < 7.0 / high ≥ 7.0 — riskBand canon)
 *
 * LOCAL dev tool — NOT wired into build / verify:gates / vercel.json.
 * Output stays under .cache/ (never data/scores/) until full-run approval.
 *
 * Usage:
 *   bun scripts/make-pilot-sample.ts \
 *     --model claude-opus-5 \
 *     --prompt-file data/prompts/2026-07-26_claude-opus-5-aiois10.ja.md \
 *     [--size 40] [--chunk 5] \
 *     [--baseline <path>]   # default: newest AIOIS-10 batch \
 *     [--out .cache/scoring/<model>/pilot]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { extractOcc } from './extract-occ-chunks.js';

// ───── Pure, testable core ─────

export interface BaselineEntry {
  readonly id: number;
  readonly title: string;
  readonly aliases: readonly string[];
  /** Baseline headline score (== aiois.transformation on an AIOIS-10 batch). */
  readonly aiRisk: number;
  readonly displacement: number;
}

export interface PilotPick {
  readonly id: number;
  readonly reasons: readonly string[];
}

export interface PilotSelection {
  readonly picks: readonly PilotPick[];
  readonly unmatchedNames: readonly string[];
}

/** /standard の校正例＋Opus アンカー職。title/alias の部分一致で各 1 件拾う。 */
export const MUST_INCLUDE_NAMES: readonly string[] = [
  'データ入力', '翻訳者', 'プログラマー', '会計士', '弁護士', '看護師', '美容師', '林業',
  '経営者', '外科医', '介護員',
];

const SPECIAL_TOP_N = 3;

/** ai_risk band — matches bands.ts riskBand (decimal-safe): < 4.0 low / < 7.0 mid / ≥ 7.0 high. */
export const riskBand = (r: number): 'low' | 'mid' | 'high' => (r < 4 ? 'low' : r < 7 ? 'mid' : 'high');

const byId = (a: { readonly id: number }, b: { readonly id: number }): number => a.id - b.id;

/** Evenly spaced index for pick k of need over a pool, nudged to the nearest free slot. */
function spacedFreeIndex(k: number, need: number, poolLength: number, taken: ReadonlySet<number>): number {
  const ideal = need === 1 ? 0 : Math.round((k * (poolLength - 1)) / (need - 1));
  let idx = ideal;
  while (idx < poolLength && taken.has(idx)) idx += 1;
  if (idx >= poolLength) {
    idx = ideal;
    while (idx >= 0 && taken.has(idx)) idx -= 1;
  }
  return idx;
}

/**
 * Deterministic stratified pilot sample. Returns `size` picks when the pools
 * allow it (named/special picks above a band quota can push the total a few
 * entries over `size` — the runbook bound 30–50 is enforced by the caller).
 */
export function pickPilotSample(entries: readonly BaselineEntry[], size: number): PilotSelection {
  const reasons = new Map<number, string[]>();
  const addPick = (id: number, reason: string): void => {
    const existing = reasons.get(id);
    if (existing) existing.push(reason);
    else reasons.set(id, [reason]);
  };

  // 1. Named exemplars (first match in id order).
  const unmatchedNames: string[] = [];
  const sortedById = [...entries].sort(byId);
  for (const name of MUST_INCLUDE_NAMES) {
    const hit = sortedById.find((e) => e.title.includes(name) || e.aliases.some((a) => a.includes(name)));
    if (hit) addPick(hit.id, `named-exemplar:${name}`);
    else unmatchedNames.push(name);
  }

  // 2. Displacement / gap specials.
  const topBy = (cmp: (a: BaselineEntry, b: BaselineEntry) => number): readonly BaselineEntry[] =>
    [...entries].sort((a, b) => cmp(a, b) || a.id - b.id).slice(0, SPECIAL_TOP_N);
  for (const e of topBy((a, b) => b.displacement - a.displacement)) addPick(e.id, 'top-displacement');
  for (const e of topBy((a, b) => b.aiRisk - b.displacement - (a.aiRisk - a.displacement))) {
    addPick(e.id, 'sharp-transformation-vs-displacement-gap');
  }

  // 3. Band quotas, filled evenly over each band's ai_risk order.
  const quotaHigh = Math.round(size * 0.25);
  const quotaMid = Math.round(size * 0.375);
  const quotas = { high: quotaHigh, mid: quotaMid, low: size - quotaHigh - quotaMid } as const;
  const entryById = new Map(entries.map((e) => [e.id, e]));
  for (const bandName of ['high', 'mid', 'low'] as const) {
    const have = [...reasons.keys()].filter((id) => {
      const e = entryById.get(id);
      return e !== undefined && riskBand(e.aiRisk) === bandName;
    }).length;
    const pool = entries
      .filter((e) => riskBand(e.aiRisk) === bandName && !reasons.has(e.id))
      .sort((a, b) => a.aiRisk - b.aiRisk || a.id - b.id);
    const need = Math.min(Math.max(quotas[bandName] - have, 0), pool.length);
    const taken = new Set<number>();
    for (let k = 0; k < need; k += 1) {
      const idx = spacedFreeIndex(k, need, pool.length, taken);
      taken.add(idx);
      addPick(pool[idx]!.id, `band-fill:${bandName}`);
    }
  }

  // 4. Top-up when small bands left the sample short.
  const target = Math.min(size, entries.length);
  if (reasons.size < target) {
    for (const e of sortedById) {
      if (reasons.size >= target) break;
      if (!reasons.has(e.id)) addPick(e.id, 'top-up');
    }
  }

  const picks = [...reasons.entries()]
    .map(([id, rs]) => ({ id, reasons: rs as readonly string[] }))
    .sort(byId);
  return { picks, unmatchedNames };
}

// ───── CLI wrapper (only runs when executed directly) ─────

if (import.meta.main) {
  const ROOT = resolve(import.meta.dir, '..');
  const OCC_DIR = join(ROOT, 'data', 'occupations');
  const fail = (m: string): never => {
    console.error(`[make-pilot-sample] FAIL — ${m}`);
    process.exit(1);
  };

  /**
   * Newest occupations batch that actually carries AIOIS-10 vectors.
   *
   * Auto-detected rather than defaulted to a pinned filename: a pinned default
   * silently goes stale the moment a batch lands, and stratifying a pilot
   * against a superseded baseline produces a misleading sample.
   */
  const latestAioisBatchPath = (): string => {
    const scoresDir = join(ROOT, 'data', 'scores');
    const candidates = readdirSync(scoresDir)
      .filter((f) => f.startsWith('occupations_') && f.endsWith('.json'))
      .map((f) => {
        const path = join(scoresDir, f);
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
          scope?: string;
          run?: { run_date?: string };
          scores?: Record<string, { aiois?: unknown }>;
        };
        const hasAiois = Object.values(parsed.scores ?? {}).some((s) => s?.aiois != null);
        return { path, runDate: parsed.run?.run_date ?? '', scope: parsed.scope, hasAiois };
      })
      .filter((c) => c.scope === 'occupations' && c.hasAiois && c.runDate)
      .sort((a, b) => (a.runDate < b.runDate ? 1 : a.runDate > b.runDate ? -1 : 0));
    if (candidates.length === 0) fail('no AIOIS-10 occupations batch found in data/scores/');
    return candidates[0]!.path;
  };

  // Every other flag takes a value; requiring one catches typos like
  // `--size --chunk 5` instead of silently reading "--chunk" as the size.
  const BOOLEAN_FLAGS = new Set(['explain']);

  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (BOOLEAN_FLAGS.has(key)) {
      args[key] = 'true';
      continue;
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) fail(`--${key} needs a value`);
    args[key] = v as string;
    i += 1;
  }

  const size = Number.parseInt(args['size'] ?? '40', 10);
  if (!Number.isInteger(size) || size < 30 || size > 50) fail('--size must be 30–50 (runbook pilot bounds)');
  const chunkSize = Number.parseInt(args['chunk'] ?? '5', 10);
  if (!Number.isInteger(chunkSize) || chunkSize < 1) fail('--chunk must be a positive integer');
  const model = args['model'];
  if (!model) fail('--model <id> is required (recorded in the manifest as the model being piloted)');
  const promptFile = args['prompt-file'];
  if (!promptFile) fail('--prompt-file <path> is required (the frozen rubric the chunks point at)');
  const baselinePath = args['baseline'] ? resolve(ROOT, args['baseline']) : latestAioisBatchPath();
  const outDir = resolve(ROOT, args['out'] ?? `.cache/scoring/${model}/pilot`);

  const batch = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
    scorer?: { model?: string };
    run?: { run_date?: string };
    scores?: Record<string, { ai_risk?: number; aiois?: { displacement?: number } | null }>;
  };
  if (!batch.scores || !batch.run?.run_date || !batch.scorer?.model) {
    fail('baseline batch missing scores/run/scorer');
  }

  const occById = new Map<number, Record<string, any>>();
  for (const f of readdirSync(OCC_DIR).filter((x) => x.endsWith('.json'))) {
    const raw = JSON.parse(readFileSync(join(OCC_DIR, f), 'utf8')) as Record<string, any>;
    occById.set(Number(raw.id), raw);
  }

  const entries: BaselineEntry[] = [];
  for (const [k, v] of Object.entries(batch.scores!)) {
    const id = Number.parseInt(k, 10);
    const occ = occById.get(id);
    if (!occ) fail(`baseline id ${id} has no occupation file`);
    if (typeof v.ai_risk !== 'number' || typeof v.aiois?.displacement !== 'number') {
      fail(`baseline id ${id} lacks ai_risk / aiois.displacement (AIOIS-10 baseline required)`);
    }
    entries.push({
      id,
      title: String(occ!.title_ja ?? ''),
      aliases: Array.isArray(occ!.aliases_ja) ? (occ!.aliases_ja as string[]) : [],
      aiRisk: v.ai_risk!,
      displacement: v.aiois!.displacement!,
    });
  }

  const { picks, unmatchedNames } = pickPilotSample(entries, size);
  if (picks.length < 30 || picks.length > 50) fail(`sample size ${picks.length} out of runbook bounds 30–50`);

  mkdirSync(outDir, { recursive: true });

  const manifest = {
    model,
    prompt_file: promptFile,
    baseline_path: baselinePath.replace(`${ROOT}/`, ''),
    baseline_model: batch.scorer!.model,
    baseline_run_date: batch.run!.run_date,
    sample_size: picks.length,
    ids: picks.map((p) => p.id),
    selection_notes: {
      high: 'current ai_risk >= 7.0',
      mid: 'current ai_risk 4.0-6.9',
      low: 'current ai_risk < 4.0',
    },
    selection_reasons: Object.fromEntries(picks.map((p) => [String(p.id), p.reasons.join('; ')])),
    unmatched_names: unmatchedNames,
  };
  writeFileSync(join(outDir, 'sample.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  // Extract chunks for the scoring agents — same extract shape as the Opus run.
  // The header deliberately carries NO rubric: the frozen prompt is the canon.
  const chunks: PilotPick[][] = [];
  for (let i = 0; i < picks.length; i += chunkSize) chunks.push(picks.slice(i, i + chunkSize));
  chunks.forEach((ch, idx) => {
    const n = String(idx + 1).padStart(2, '0');
    const header =
      `# ${model} pilot chunk ${n}/${chunks.length} — ${ch.length} occupations (ids ${ch.map((p) => p.id).join(', ')})\n` +
      `# 採点指示の正典: ${promptFile}（このファイル自体に採点指示は書かない）\n`;
    const body = ch.map((p) => extractOcc(occById.get(p.id)!).text).join('\n\n');
    writeFileSync(join(outDir, `pilot-chunk-${n}.txt`), `${header}\n${body}\n`);
  });

  const bandCount = { low: 0, mid: 0, high: 0 };
  const entryById = new Map(entries.map((e) => [e.id, e]));
  for (const p of picks) bandCount[riskBand(entryById.get(p.id)!.aiRisk)] += 1;

  console.log(`[make-pilot-sample] OK → ${outDir}`);
  console.log(
    `  sample ${picks.length}: low=${bandCount.low} mid=${bandCount.mid} high=${bandCount.high}; ` +
      `chunks=${chunks.length} (size ${chunkSize})`,
  );
  if (unmatchedNames.length) console.log(`  WARNING unmatched exemplar name(s): ${unmatchedNames.join(', ')}`);
  // Baseline scores stay OFF by default. On the in-agent path the operator IS
  // the scorer, and docs/SCORING_RUNBOOK.md forbids showing the baseline batch
  // or expected drift to whoever is about to score ("アンカリング防止"). Pass
  // --explain only when the reader will not be scoring this sample.
  if (args['explain'] === 'true') {
    for (const p of picks) {
      const named = p.reasons.filter((r) => r.startsWith('named-exemplar:'));
      if (named.length) {
        const e = entryById.get(p.id)!;
        console.log(`  named: id=${p.id} ${e.title} ← ${named.join(', ')} (T=${e.aiRisk}, D=${e.displacement})`);
      }
    }
  } else {
    const namedCount = picks.filter((p) => p.reasons.some((r) => r.startsWith('named-exemplar:'))).length;
    console.log(`  ${namedCount} named exemplar(s) included; re-run with --explain to see baseline scores`);
    console.log('  (omitted by default so the scorer is not anchored to the baseline batch)');
  }
  console.log(`  next: score the pilot chunks against ${promptFile}, then assemble with --mode aiois`);
}
