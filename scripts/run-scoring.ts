#!/usr/bin/env bun
/**
 * run-scoring.ts — score occupations with an Opus model via the Anthropic
 * Message Batches API (50% cost) + prompt caching, emitting JSONL for
 * `assemble:scores`. Reusable on every model upgrade (4.8 → 4.9 → 5.0).
 * See docs/SCORING_RUNBOOK.md §2.
 *
 * LOCAL dev tool — NOT wired into build / verify:gates / vercel.json.
 * Needs ANTHROPIC_API_KEY (bun auto-loads .env). Makes real, paid API calls.
 *
 * Usage:
 *   bun scripts/run-scoring.ts \
 *     --prompt-file data/prompts/prompt_opus-4-8.ja.md \
 *     --out raw-scores.jsonl \
 *     [--model claude-opus-4-8] [--limit N] [--ids 1,2,3] [--resume] [--poll-interval 20]
 *
 * Output JSONL (one line per occupation): {id, ai_risk, rationale_ja, confidence}
 * → next: bun run assemble:scores --in raw-scores.jsonl …
 */
import { readFileSync, readdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const OCC_DIR = join(ROOT, 'data', 'occupations');
const BATCHES_API = 'https://api.anthropic.com/v1/messages/batches';
const ANTHROPIC_VERSION = '2023-06-01';

const fail = (m: string): never => {
  console.error(`[run-scoring] FAIL — ${m}`);
  process.exit(1);
};

// ---- CLI ----
const args: Record<string, string> = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i]!;
  if (!a.startsWith('--')) continue;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) {
    args[a.slice(2)] = 'true'; // boolean flag
  } else {
    args[a.slice(2)] = v;
    i += 1;
  }
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) fail('ANTHROPIC_API_KEY not set — put it in .env (bun auto-loads) or the environment.');
const model = args['model'] ?? 'claude-opus-4-8';
const promptFile = resolve(ROOT, args['prompt-file'] ?? 'data/prompts/prompt_opus-4-8.ja.md');
const outPath = resolve(args['out'] ?? join(ROOT, 'raw-scores.jsonl'));
if (!existsSync(promptFile)) fail(`prompt file not found: ${promptFile}`);
const rubric = readFileSync(promptFile, 'utf8');

// ---- occupation extraction (compact; NOT the full ~200-line source file) ----
interface OccExtract {
  readonly id: number;
  readonly text: string;
}
function extractOcc(raw: Record<string, any>): OccExtract {
  const d = (raw.description ?? {}) as Record<string, string | undefined>;
  const aliases = Array.isArray(raw.aliases_ja) ? (raw.aliases_ja as string[]) : [];
  const text = [
    `職業ID: ${raw.id}`,
    `名称: ${raw.title_ja ?? ''}`,
    aliases.length ? `別名: ${aliases.join('、')}` : '',
    d.summary_ja ? `概要: ${d.summary_ja}` : '',
    d.what_it_is_ja ? `仕事内容:\n${d.what_it_is_ja}` : '',
    d.working_conditions_ja ? `労働条件:\n${d.working_conditions_ja}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { id: Number(raw.id), text };
}

const allOccs: OccExtract[] = readdirSync(OCC_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => extractOcc(JSON.parse(readFileSync(join(OCC_DIR, f), 'utf8')) as Record<string, any>));

// ---- filters: --ids / --resume / --limit ----
let occs = allOccs;
if (args['ids']) {
  const want = new Set(args['ids'].split(',').map((s) => Number.parseInt(s.trim(), 10)));
  occs = occs.filter((o) => want.has(o.id));
}
if (args['resume'] && existsSync(outPath)) {
  const done = new Set(
    readFileSync(outPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return (JSON.parse(l) as { id: number }).id;
        } catch {
          return -1;
        }
      }),
  );
  occs = occs.filter((o) => !done.has(o.id));
}
if (args['limit']) occs = occs.slice(0, Number.parseInt(args['limit'], 10));
if (occs.length === 0) fail('no occupations to score (all done via --resume? bad --ids?)');

// ---- forced tool for structured output ----
const tool = {
  name: 'submit_score',
  description: 'Submit the AI-risk score for the occupation described by the user.',
  input_schema: {
    type: 'object',
    properties: {
      ai_risk: { type: 'number', description: '0.0–10.0, one decimal place (e.g. 6.9)' },
      rationale_ja: { type: 'string', description: '簡潔な日本語の理由(1文)' },
      confidence: { type: 'number', description: '0.0–1.0 の自信度' },
    },
    required: ['ai_risk', 'rationale_ja', 'confidence'],
  },
};

const requests = occs.map((o) => ({
  custom_id: `occ-${o.id}`,
  params: {
    model,
    max_tokens: 512,
    system: [{ type: 'text', text: rubric, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `次の職業を採点し、submit_score ツールで結果を返せ:\n\n${o.text}` }],
    tools: [tool],
    tool_choice: { type: 'tool', name: 'submit_score' },
  },
}));

const headers = {
  'x-api-key': apiKey as string,
  'anthropic-version': ANTHROPIC_VERSION,
  'content-type': 'application/json',
};

console.log(`[run-scoring] ${occs.length} occupations · model=${model} · Batches API`);

// ---- submit batch ----
const createRes = await fetch(BATCHES_API, { method: 'POST', headers, body: JSON.stringify({ requests }) });
if (!createRes.ok) fail(`batch create ${createRes.status}: ${await createRes.text()}`);
const batch = (await createRes.json()) as { id: string };
console.log(`[run-scoring] batch ${batch.id} submitted; polling…`);

// ---- poll until ended ----
const pollMs = Number.parseInt(args['poll-interval'] ?? '20', 10) * 1000;
let status: {
  processing_status: string;
  results_url?: string;
  request_counts?: { succeeded?: number; errored?: number; canceled?: number; expired?: number; processing?: number };
};
for (;;) {
  await new Promise((r) => setTimeout(r, pollMs));
  const pr = await fetch(`${BATCHES_API}/${batch.id}`, { headers });
  if (!pr.ok) fail(`batch poll ${pr.status}: ${await pr.text()}`);
  status = (await pr.json()) as typeof status;
  const c = status.request_counts ?? {};
  const done = (c.succeeded ?? 0) + (c.errored ?? 0) + (c.canceled ?? 0) + (c.expired ?? 0);
  console.log(`  [${status.processing_status}] ${done}/${occs.length} (ok=${c.succeeded ?? 0} err=${c.errored ?? 0})`);
  if (status.processing_status === 'ended') break;
}

// ---- fetch + parse results ----
if (!status.results_url) fail('batch ended but no results_url');
const rr = await fetch(status.results_url, { headers });
if (!rr.ok) fail(`results fetch ${rr.status}: ${await rr.text()}`);

let ok = 0;
const errs: string[] = [];
const outLines: string[] = [];
for (const line of (await rr.text()).split('\n').filter(Boolean)) {
  let r: {
    custom_id: string;
    result?: { type: string; message?: { content?: Array<{ type: string; name?: string; input?: Record<string, unknown> }> } };
  };
  try {
    r = JSON.parse(line) as typeof r;
  } catch {
    continue;
  }
  const id = Number.parseInt(String(r.custom_id).replace('occ-', ''), 10);
  if (r.result?.type !== 'succeeded') {
    errs.push(`occ-${id}: ${r.result?.type ?? 'unknown'}`);
    continue;
  }
  const block = (r.result.message?.content ?? []).find((b) => b.type === 'tool_use' && b.name === 'submit_score');
  if (!block?.input) {
    errs.push(`occ-${id}: no submit_score tool_use`);
    continue;
  }
  const { ai_risk, rationale_ja, confidence } = block.input as {
    ai_risk: number;
    rationale_ja: string;
    confidence: number;
  };
  outLines.push(JSON.stringify({ id, ai_risk, rationale_ja, confidence }));
  ok += 1;
}

if (args['resume'] && existsSync(outPath)) appendFileSync(outPath, `${outLines.join('\n')}\n`);
else writeFileSync(outPath, `${outLines.join('\n')}\n`);

console.log(`[run-scoring] done — ${ok} scored → ${outPath}`);
if (errs.length) {
  console.log(`  ${errs.length} errored (re-run with --resume to retry the rest):`);
  errs.slice(0, 20).forEach((e) => console.log(`    ${e}`));
}
console.log(
  `  next: bun run assemble:scores --model ${model} --date <YYYY-MM-DD> --prompt-version 2.0 ` +
    `--prompt-file ${args['prompt-file'] ?? 'data/prompts/prompt_opus-4-8.ja.md'} --in ${outPath} ` +
    `--out data/scores/occupations_${model}_<date>.json`,
);
