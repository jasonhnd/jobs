// CLI checks for assemble-scores.ts.
// The entry block runs only when this file is the process entry. Importing it
// from a test is a no-op once any earlier file has loaded the module, and
// Bun's file order differs between macOS and Linux. Every case therefore
// runs in its own subprocess. Outputs stay under a temp directory.
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';

import { ScoreRunSchema } from '../src/data/schema/score-run.js';

const REPO = realpathSync(join(import.meta.dir, '..'));
const SCRIPT = realpathSync(join(REPO, 'scripts', 'assemble-scores.ts'));
const SCORES_DIR = join(REPO, 'data', 'scores');
const OCC_DIR = join(REPO, 'data', 'occupations');
const TMP = realpathSync(tmpdir());
const scoresBefore = readdirSync(SCORES_DIR).sort();
const occBefore = readdirSync(OCC_DIR).sort();
// An id with no occupation file, derived from the fixtures instead of hard-coded.
const presentIds = new Set(occBefore.filter((f) => f.endsWith('.json')).map((f) => Number.parseInt(f, 10)));
let MISSING_OCC_ID = 1;
while (presentIds.has(MISSING_OCC_ID)) MISSING_OCC_ID += 1;

const AIOIS = {
  d1: 4.8, d2: 4.4, d3: 5.0, d4: 6.5, d5: 5.8, d6: 3.0, d7: 4.2, d8: 3.6, d9: 2.8, d10: 3.5,
  transformation: 4.6, displacement: 1.7,
};

const root = mkdtempSync(join(TMP, 'assemble-scores-cli-'));
const anchors = join(root, 'anchors.json');
const caveat = join(root, 'caveat.txt');
const aioisIn = join(root, 'aiois.jsonl');
const aioisOut = join(root, 'aiois.json');
writeFileSync(anchors, `${JSON.stringify({ '0-1': 'min', '10': 'max' })}\n`, 'utf8');
writeFileSync(caveat, 'coverage caveat\n', 'utf8');
writeFileSync(
  aioisIn,
  `${JSON.stringify({
    id: 1,
    ai_risk: 4.6,
    rationale_ja: 'coverage fixture',
    confidence: 0.8,
    aiois: AIOIS,
  })}\n`,
  'utf8',
);

after(() => {
  rmSync(root, { recursive: true, force: true });
});

function assertTempOut(outPath: string): void {
  const parent = realpathSync(dirname(outPath));
  assert.equal(relative(TMP, parent).startsWith('..'), false, `${outPath} is not under the temp dir`);
  assert.equal(relative(REPO, parent).startsWith('..'), true, `${outPath} is inside the repo`);
  assert.equal(basename(outPath) === '..' || basename(outPath) === '.', false);
}

function runCli(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const outAt = args.indexOf('--out');
  if (outAt !== -1) assertTempOut(args[outAt + 1] ?? '');
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8', cwd: REPO,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('subprocess entry writes an append-only batch under the temp directory', { timeout: 60_000 }, () => {
  const run = runCli([
    '--mode', 'aiois',
    '--model', 'gpt-job0064cov',
    '--date', '2026-10-02',
    '--prompt-version', 'test',
    '--prompt-file', 'data/prompts/prompt.ja.md',
    '--in', aioisIn,
    '--out', aioisOut,
    '--anchors', anchors,
    '--caveat', caveat,
    '--backfill', 'true',
  ]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /OK →/);
  assert.match(run.stdout, /backfill batch/);
  assert.equal(existsSync(aioisOut), true);
  const batch = ScoreRunSchema.parse(JSON.parse(readFileSync(aioisOut, 'utf8')));
  assert.equal(batch.run.backfill, true);
  assert.equal(batch.run.run_id, 'occ_2026-10-02_v1');
  assert.equal(batch.run.operator ?? null, null);
  assert.equal(batch.scorer.model_provider, 'openai');
  assert.equal(batch.scorer.scoring_method_id, 'aiois-semantic-judgment');
  assert.match(batch.scorer.scoring_method, /AIOIS-10 v1\.0/);
  assert.equal(batch.scores['1']?.aiois?.displacement, 1.7);
  assert.match(batch.prompt.prompt_sha256 ?? '', /^[a-f0-9]{64}$/);
  assert.equal(batch.input.occupation_count_scored, 1);
  assert.equal(batch.input.occupation_count_skipped, occBefore.length - 1);
  assert.equal(existsSync(join(SCORES_DIR, 'occupations_gpt-job0064cov_2026-10-02.json')), false);
});

test('subprocess CLI rejects bad input and never overwrites', { timeout: 60_000 }, () => {
  const legacyLine = JSON.stringify({ id: 1, ai_risk: 6.9, rationale_ja: 'coverage fixture', confidence: 0.8 });
  const legacyIn = join(root, 'legacy.jsonl');
  writeFileSync(legacyIn, `${legacyLine}\n`, 'utf8');

  const missingMode = runCli([]);
  assert.equal(missingMode.status, 1);
  assert.match(missingMode.stderr, /missing --mode/);

  const needsValue = runCli(['--mode']);
  assert.equal(needsValue.status, 1);
  assert.match(needsValue.stderr, /--mode needs a value/);

  const badMode = runCli(['--mode', 'both']);
  assert.equal(badMode.status, 1);
  assert.match(badMode.stderr, /--mode must be "aiois" or "legacy"/);

  const unknownModel = runCli(['--mode', 'legacy', '--model', 'mystery-model']);
  assert.notEqual(unknownModel.status, 0);
  assert.match(unknownModel.stderr, /pass --provider/);

  const badBackfill = runCli([
    '--mode', 'legacy', '--model', 'gpt-job0064cov', '--date', '2026-10-02', '--backfill', 'maybe',
  ]);
  assert.equal(badBackfill.status, 1);
  assert.match(badBackfill.stderr, /--backfill must be "true" or "false"/);

  const missingIn = runCli([
    '--mode', 'legacy', '--model', 'gpt-job0064cov', '--date', '2026-10-02', '--prompt-version', 'test',
    '--in', join(root, 'nope.jsonl'), '--out', join(root, 'unused.json'),
  ]);
  assert.equal(missingIn.status, 1);
  assert.match(missingIn.stderr, /--in not found/);

  const kept = join(root, 'kept.json');
  writeFileSync(kept, 'KEEP', 'utf8');
  const appendOnly = runCli([
    '--mode', 'legacy', '--model', 'gpt-job0064cov', '--date', '2026-10-02', '--prompt-version', 'test',
    '--in', legacyIn, '--out', kept,
  ]);
  assert.equal(appendOnly.status, 1);
  assert.match(appendOnly.stderr, /append-only; never overwrite/);
  assert.equal(readFileSync(kept, 'utf8'), 'KEEP');

  const badLines = join(root, 'bad.jsonl');
  writeFileSync(badLines, `${Array.from({ length: 31 }, () => 'not-json').join('\n')}\n`, 'utf8');
  const badOut = join(root, 'bad-out.json');
  const manyErrors = runCli([
    '--mode', 'legacy', '--model', 'gpt-job0064cov', '--date', '2026-10-02', '--prompt-version', 'test',
    '--in', badLines, '--out', badOut, '--anchors', anchors, '--caveat', caveat,
  ]);
  assert.equal(manyErrors.status, 1);
  assert.match(manyErrors.stderr, /31 input error\(s\)/);
  assert.match(manyErrors.stderr, /invalid JSON/);
  assert.match(manyErrors.stderr, /and 1 more/);
  assert.equal(existsSync(badOut), false);

  const extra = join(root, 'extra.jsonl');
  writeFileSync(extra, `${JSON.stringify({ id: MISSING_OCC_ID, ai_risk: 6.9, rationale_ja: 'coverage fixture', confidence: 0.8 })}\n`, 'utf8');
  const extraRun = runCli([
    '--mode', 'legacy', '--model', 'gpt-job0064cov', '--date', '2026-10-02', '--prompt-version', 'test',
    '--in', extra, '--out', join(root, 'extra-out.json'),
  ]);
  assert.equal(extraRun.status, 1);
  assert.match(extraRun.stderr, new RegExp(`no occupation file: ${MISSING_OCC_ID}`));

  const legacyOut = join(root, 'legacy.json');
  const legacy = runCli([
    '--mode', 'legacy', '--model', 'gpt-job0064cov', '--provider', 'openai', '--date', '2026-10-02',
    '--prompt-version', 'test', '--prompt-file', 'data/prompts/job0064-does-not-exist.md',
    '--in', legacyIn, '--out', legacyOut, '--anchors', anchors, '--caveat', caveat,
    '--run-id', 'job0064-legacy', '--operator', 'job0064', '--input-data-version', 'occupations_test',
    '--scoring-method', 'coverage legacy',
  ]);
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.match(legacy.stdout, /OK →/);
  assert.match(legacy.stdout, /scored 1\//);
  assert.match(legacy.stdout, / …/);
  assert.equal(legacy.stdout.includes('backfill batch'), false);
  const legacyBatch = ScoreRunSchema.parse(JSON.parse(readFileSync(legacyOut, 'utf8')));
  assert.equal(legacyBatch.scorer.scoring_method, 'coverage legacy');
  assert.equal(legacyBatch.scorer.scoring_method_id, 'legacy-single-axis');
  assert.equal(legacyBatch.prompt.prompt_sha256 ?? null, null);
  assert.equal(legacyBatch.run.backfill, undefined);
  assert.equal(legacyBatch.input.input_data_version, 'occupations_test');

  const badMethod = runCli([
    '--mode', 'legacy', '--model', 'gpt-job0064cov', '--date', '2026-10-02', '--prompt-version', 'test',
    '--in', legacyIn, '--out', join(root, 'bad-method.json'), '--anchors', anchors, '--caveat', caveat,
    '--scoring-method-id', 'not-a-method',
  ]);
  assert.equal(badMethod.status, 1);
  assert.match(badMethod.stderr, /--scoring-method-id must be one of/);

  const badAnchors = join(root, 'bad-anchors.json');
  writeFileSync(badAnchors, '{"0-1":1}\n', 'utf8');
  const schemaOut = join(root, 'schema.json');
  const schemaFail = runCli([
    '--mode', 'legacy', '--model', 'gpt-job0064cov', '--date', '2026-10-02', '--prompt-version', 'test',
    '--in', legacyIn, '--out', schemaOut, '--anchors', badAnchors, '--caveat', caveat,
  ]);
  assert.equal(schemaFail.status, 1);
  assert.match(schemaFail.stderr, /does not pass ScoreRunSchema/);
  assert.equal(existsSync(schemaOut), false);

  assert.deepEqual(readdirSync(SCORES_DIR).sort(), scoresBefore);
  assert.deepEqual(readdirSync(OCC_DIR).sort(), occBefore);
});
