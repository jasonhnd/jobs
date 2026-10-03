// Tests for the gate assertions in scripts/check-geo-freshness.ts — `bun test`.
// Every assertion runs against a temp-dir fixture selected with process.chdir;
// nothing here touches the network, a model, or writes under the real data/.
import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  assertContains,
  assertContainsText,
  assertCrossModelValidationArchive,
  assertDocumentedDetailProjectionExamples,
  assertExact,
  assertFreshGeoAstroPages,
  assertHomeAndReadmeConsistency,
  assertNoStaleOrPlaceholders,
  assertOmitsText,
  assertRenderedFactBlocks,
  collectRenderedFactBlocks,
  assertRunbookCurrentBatch,
  loadScoreRuns,
  main,
  readText,
  staleModelTokens,
} from './check-geo-freshness.js';
import { ScoreRunSchema, type ScoreRun } from '../src/data/schema/index.js';
import { buildMethodologyBatchView } from '../src/site/methodology-facts.js';
import { buildHomeKpiView } from '../src/site/home-facts-render.js';
import { SCORE_PANEL } from '../src/site/score-attribution.js';
import { computeGeoFacts, GeoTreemapRowsSchema, pickLatestGeoScoreRun } from '../src/site/geo-facts.js';

const REPO = process.cwd();
const REAL_SCORES = join(REPO, 'data', 'scores');
const tmpDirs: string[] = [];

afterEach(() => {
  process.chdir(REPO);
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture(files: Readonly<Record<string, string>> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'geo-fresh-'));
  tmpDirs.push(dir);
  for (const [rel, text] of Object.entries(files)) put(dir, rel, text);
  process.chdir(dir);
  return dir;
}

function put(dir: string, rel: string, text: string): void {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

/** Runs `fn` with process.exit / console.error stubbed; returns the FAIL message or null. */
function failureOf(fn: () => unknown): string | null {
  const origExit = process.exit;
  const origErr = console.error;
  const lines: string[] = [];
  console.error = (...a: unknown[]) => void lines.push(a.join(' '));
  process.exit = ((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as typeof process.exit;
  try {
    fn();
    return null;
  } catch (e) {
    assert.equal((e as Error).message, 'exit:1');
    assert.equal(lines.length, 1);
    return lines[0]!;
  } finally {
    process.exit = origExit;
    console.error = origErr;
  }
}

async function failureOfAsync(fn: () => Promise<unknown>): Promise<string | null> {
  const origExit = process.exit;
  const origErr = console.error;
  const lines: string[] = [];
  console.error = (...a: unknown[]) => void lines.push(a.join(' '));
  process.exit = ((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as typeof process.exit;
  try {
    await fn();
    return null;
  } catch (e) {
    assert.equal((e as Error).message, 'exit:1');
    return lines[0]!;
  } finally {
    process.exit = origExit;
    console.error = origErr;
  }
}

const run = (model: string, runDate: string): ScoreRun =>
  ({ scorer: { model }, run: { run_date: runDate } }) as unknown as ScoreRun;

describe('readText / assertExact / assertContains*', () => {
  test('readText normalises CRLF', () => {
    fixture({ 'a.txt': 'x\r\ny\r\n' });
    assert.equal(readText('a.txt'), 'x\ny\n');
  });

  test('assertExact passes on equal text (CRLF-insensitive) and fails otherwise', () => {
    fixture({ 'a.txt': 'x\r\ny' });
    assert.equal(failureOf(() => assertExact('a.txt', 'x\ny')), null);
    assert.equal(failureOf(() => assertExact('a.txt', 'x\nz')), '[check-geo-freshness] FAIL: a.txt does not match the generated GEO facts. Run `bun src/data/build.ts`.');
  });

  test('assertContains passes, reports a missing file, and reports a missing block', () => {
    fixture({ 'a.html': '<p>hello</p>' });
    assert.equal(failureOf(() => assertContains('a.html', 'hello')), null);
    assert.ok(failureOf(() => assertContains('nope.html', 'hello'))!.includes('nope.html is missing. Run `bun run build`'));
    assert.ok(failureOf(() => assertContains('a.html', 'bye'))!.includes('does not contain the generated GEO citable fact block'));
  });

  test('assertContainsText / assertOmitsText', () => {
    fixture({ 'a.txt': 'alpha beta' });
    assert.equal(failureOf(() => assertContainsText('a.txt', 'beta', 'beta copy')), null);
    assert.ok(failureOf(() => assertContainsText('a.txt', 'gamma', 'gamma copy'))!.includes('a.txt is missing gamma copy'));
    assert.equal(failureOf(() => assertOmitsText('a.txt', 'gamma', 'why')), null);
    assert.ok(failureOf(() => assertOmitsText('a.txt', 'alpha', 'because'))!.includes('still carries copy it should have dropped — because'));
  });
});

describe('loadScoreRuns', () => {
  test('parses every batch in data/scores, sorted by file name', () => {
    const dir = fixture();
    const names = readdirSync(REAL_SCORES).filter((f) => f.endsWith('.json')).sort().slice(0, 2);
    mkdirSync(join(dir, 'data', 'scores'), { recursive: true });
    for (const name of [...names].reverse()) copyFileSync(join(REAL_SCORES, name), join(dir, 'data', 'scores', name));
    writeFileSync(join(dir, 'data', 'scores', 'README.md'), 'ignored');
    const runs = loadScoreRuns();
    assert.equal(runs.length, 2);
    assert.ok(runs[0]!.scorer.model.length > 0);
  });
});

describe('assertNoStaleOrPlaceholders', () => {
  const stale = staleModelTokens([run('old-model', '2026-01-01'), run('new-model', '2026-02-01')], run('new-model', '2026-02-01'));

  test('passes clean text, flags a stale token with the file name', () => {
    fixture({ 'ok.txt': 'new-model only', 'bad.txt': 'uses old-model here', 'name.txt': 'Old-model' });
    assert.equal(failureOf(() => assertNoStaleOrPlaceholders('ok.txt', stale)), null);
    assert.equal(
      failureOf(() => assertNoStaleOrPlaceholders('bad.txt', stale)),
      '[check-geo-freshness] FAIL: bad.txt contains stale token "old-model"',
    );
  });
});

describe('assertDocumentedDetailProjectionExamples', () => {
  const doc = 'detail IDs are zero-padded to four digits\nhttps://mirai-shigoto.com/data.detail/0123.json\n';
  const detail = JSON.stringify({ id: 123 });
  const files = (over: Record<string, string> = {}): Record<string, string> => ({
    'public/llms.txt': doc,
    'public/llms-full.txt': doc,
    'public/data.detail/0123.json': detail,
    'dist-astro/data.detail/0123.json': detail,
    ...over,
  });

  test('passes for documented, existing, id-matching examples', () => {
    fixture(files());
    assert.equal(failureOf(() => assertDocumentedDetailProjectionExamples()), null);
  });

  test('fails when the zero-padding rule is not documented', () => {
    fixture(files({ 'public/llms.txt': 'https://mirai-shigoto.com/data.detail/0123.json' }));
    assert.ok(failureOf(() => assertDocumentedDetailProjectionExamples())!.includes('four-digit zero-padding rule'));
  });

  test('fails on an ambiguous placeholder URL', () => {
    fixture(files({ 'public/llms.txt': `${doc}data.detail/<id>.json` }));
    assert.ok(failureOf(() => assertDocumentedDetailProjectionExamples())!.includes('ambiguous per-occupation detail URL placeholder'));
    fixture(files({ 'public/llms.txt': `${doc}data.detail/{id}.json` }));
    assert.ok(failureOf(() => assertDocumentedDetailProjectionExamples())!.includes('ambiguous'));
  });

  test('fails when no concrete example exists', () => {
    fixture(files({ 'public/llms.txt': 'detail IDs are zero-padded to four digits' }));
    assert.ok(failureOf(() => assertDocumentedDetailProjectionExamples())!.includes('at least one concrete per-occupation detail URL'));
  });

  test('fails when the example file is missing or invalid in either output root', () => {
    fixture(files({ 'dist-astro/data.detail/0123.json': 'not json' }));
    assert.ok(failureOf(() => assertDocumentedDetailProjectionExamples())!.includes('dist-astro/data.detail/0123.json is missing or invalid'));
    const dir = fixture(files());
    rmSync(join(dir, 'public/data.detail/0123.json'));
    assert.ok(failureOf(() => assertDocumentedDetailProjectionExamples())!.includes('public/data.detail/0123.json is missing or invalid'));
  });

  test('fails when the example id does not match its padded filename', () => {
    fixture(files({ 'public/data.detail/0123.json': JSON.stringify({ id: 124 }) }));
    assert.ok(failureOf(() => assertDocumentedDetailProjectionExamples())!.includes('id does not match its documented zero-padded filename'));
  });
});

describe('assertFreshGeoAstroPages', () => {
  const GOOD = 'const a = SCORE_ATTRIBUTION.modelDisplay; const b = SCORE_PANEL.latestRunDate; CONSENSUS_STANDARD_FORMAL';
  const pages = (std: string, meth = GOOD): Record<string, string> => ({
    'src/pages/standard.astro': std,
    'src/pages/methodology.astro': meth,
  });

  test('passes when both pages derive consensus copy and date', () => {
    fixture(pages(GOOD));
    assert.equal(failureOf(() => assertFreshGeoAstroPages()), null);
  });

  test('accepts each alternative derivation marker', () => {
    fixture(pages('複数のAIモデルによる総合 SCORE_ATTRIBUTION.runDate', 'batchView.currentModelDisplay batchView.currentRunDate'));
    assert.equal(failureOf(() => assertFreshGeoAstroPages()), null);
  });

  test('fails when the consensus derivation is missing', () => {
    fixture(pages('SCORE_PANEL.latestRunDate'));
    assert.ok(failureOf(() => assertFreshGeoAstroPages())!.includes('src/pages/standard.astro must derive published-score copy'));
  });

  test('fails when the date derivation is missing', () => {
    fixture(pages(GOOD, 'CONSENSUS_STANDARD_FORMAL'));
    assert.ok(failureOf(() => assertFreshGeoAstroPages())!.includes('src/pages/methodology.astro must derive the current scoring date'));
  });

  for (const token of ['__SCORE_X', '__GEO_X', 'claude-opus-4-8', 'version": "0.5.0"', '変化の大きさの平均差 <strong>−0.07</strong>']) {
    test(`fails on stale token ${token}`, () => {
      fixture(pages(`${GOOD} ${token}`));
      assert.ok(failureOf(() => assertFreshGeoAstroPages())!.includes('contains stale token'));
    });
  }
});

describe('assertRunbookCurrentBatch', () => {
  const active = run('model-x', '2026-03-04');
  const lines = [
    '- モデル: `model-x`',
    '- run date: `2026-03-04`',
    '- Score output: `data/scores/occupations_model-x_2026-03-04.json`',
  ];

  test('passes when all three lines are present', () => {
    fixture({ 'docs/SCORING_RUNBOOK.md': lines.join('\n') });
    assert.equal(failureOf(() => assertRunbookCurrentBatch(active)), null);
  });

  test('fails naming the first missing line', () => {
    fixture({ 'docs/SCORING_RUNBOOK.md': lines.slice(0, 2).join('\n') });
    const msg = failureOf(() => assertRunbookCurrentBatch(active))!;
    assert.ok(msg.includes('"現行 batch" is out of date'));
    assert.ok(msg.includes('occupations_model-x_2026-03-04.json'));
    assert.ok(msg.includes('model-x @ 2026-03-04'));
  });
});

describe('assertCrossModelValidationArchive', () => {
  const valid = () => ({
    run_date: '2026-06-23',
    sample_size: 40,
    models: ['claude-fable-5(canonical)'],
    scores: { '111': { fable: 4.3, opus: 3.0, sonnet: 5.3 }, '424': { fable: 8.3, opus: 7.0, sonnet: 9.3 } },
    stats: {
      pearson: { fo: 0.97, fs: 0.951, os: 0.924 },
      mean_spread: 1.02,
      within_2_0: '38/40',
      mad_vs_fable: { opus: 0.57, sonnet: 0.61 },
    },
  });
  const REL = 'data/validation/issue-15-d2b/results.json';
  const mutate = (fn: (v: ReturnType<typeof valid>) => void): string | null => {
    const v = valid();
    fn(v);
    fixture({ [REL]: JSON.stringify(v) });
    return failureOf(() => assertCrossModelValidationArchive());
  };

  test('passes for the reviewed D2-B summary', () => {
    assert.equal(mutate(() => {}), null);
  });

  const cases: Array<[string, (v: ReturnType<typeof valid>) => void, string]> = [
    ['run_date', (v) => void (v.run_date = '2026-06-24'), 'run_date must be 2026-06-23'],
    ['sample_size', (v) => void (v.sample_size = 41), 'sample_size must be 40'],
    ['canonical model', (v) => void (v.models = ['x']), 'must include canonical Fable model'],
    ['pearson', (v) => void (v.stats.pearson.fo = 0.5), 'Pearson stats drifted'],
    ['mean_spread', (v) => void (v.stats.mean_spread = 2), 'agreement summary drifted'],
    ['within_2_0', (v) => void (v.stats.within_2_0 = '37/40'), 'agreement summary drifted'],
    ['mad', (v) => void (v.stats.mad_vs_fable.opus = 0.1), 'MAD-vs-Fable summary drifted'],
    ['id 111', (v) => void (v.scores['111'].opus = 1), 'id=111 validation scores drifted'],
    ['id 424', (v) => void (v.scores['424'].sonnet = 1), 'id=424 validation scores drifted'],
  ];
  for (const [name, fn, message] of cases) {
    test(`fails when ${name} drifts`, () => {
      assert.ok(mutate(fn)!.includes(message));
    });
  }

  test('fails when stats / scores are absent', () => {
    fixture({ [REL]: JSON.stringify({ run_date: '2026-06-23', sample_size: 40, models: ['claude-fable-5(canonical)'] }) });
    assert.ok(failureOf(() => assertCrossModelValidationArchive())!.includes('Pearson stats drifted'));
  });
});

describe('assertHomeAndReadmeConsistency', () => {
  const repoRuns = (): ScoreRun[] =>
    readdirSync(REAL_SCORES)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => ScoreRunSchema.parse(JSON.parse(readFileSync(join(REAL_SCORES, f), 'utf8'))));
  const facts = () => {
    const rows = GeoTreemapRowsSchema.parse(JSON.parse(readFileSync(join(REPO, 'public/data.treemap.json'), 'utf8')));
    return computeGeoFacts(rows, repoRuns());
  };
  const source = readFileSync(join(REPO, 'src/index-source.html'), 'utf8');
  const README_OK = 'これは Fable predecessor の外部整合性チェック';

  const goodFiles = (f: ReturnType<typeof facts>): Record<string, string> => {
    const view = buildHomeKpiView(f);
    const methodology = buildMethodologyBatchView(f);
    return {
      'src/index-source.html': source,
      'dist-astro/index.html': [
        `${view.workforceMan}<small>万</small>`,
        `${view.meanAiImpact}<small>/10</small>`,
        `${view.highImpactWagesTrillion}<small>兆</small>`,
        `影響≥${f.highImpactThreshold}・${view.highImpactCount}職業`,
      ].join('\n'),
      'dist-astro/methodology.html': `複数のAI ${SCORE_PANEL.latestRunDate} ${methodology.meanAiImpact} Claude Fable 5`,
      'README.md': README_OK,
    };
  };

  test('passes for a consistent home, methodology and README', () => {
    const f = facts();
    fixture(goodFiles(f));
    assert.equal(failureOf(() => assertHomeAndReadmeConsistency(f)), null);
  });

  test('fails when the built homepage lacks an active-batch figure', () => {
    const f = facts();
    fixture({ ...goodFiles(f), 'dist-astro/index.html': 'nothing' });
    assert.ok(failureOf(() => assertHomeAndReadmeConsistency(f))!.includes('dist-astro/index.html does not contain'));
  });

  test('fails when the README carries a stale claim or lacks the scoped note', () => {
    const f = facts();
    fixture({ ...goodFiles(f), 'README.md': `${README_OK} 複数のAIによる採点の中央値です` });
    assert.ok(failureOf(() => assertHomeAndReadmeConsistency(f))!.includes('README.md contains stale current-model claim'));
    fixture({ ...goodFiles(f), 'README.md': 'nothing' });
    assert.ok(failureOf(() => assertHomeAndReadmeConsistency(f))!.includes('README.md must scope the Fable 40-occupation validation'));
  });

  test('fails when percentages do not sum to 100', () => {
    const f = facts();
    fixture(goodFiles(f));
    const skewed = { ...f, fiveBandDistribution: f.fiveBandDistribution.map((b) => ({ ...b, sharePct: b.sharePct + 1 })) };
    assert.ok(failureOf(() => assertHomeAndReadmeConsistency(skewed))!.includes('must sum to exactly 100'));
  });
});

describe('main', () => {
  test('fails when SCORE_ATTRIBUTION disagrees with the active batch model', async () => {
    const dir = fixture();
    const names = readdirSync(REAL_SCORES).filter((f) => f.endsWith('.json')).sort();
    mkdirSync(join(dir, 'data', 'scores'), { recursive: true });
    const first = names[0]!;
    copyFileSync(join(REAL_SCORES, first), join(dir, 'data', 'scores', first));
    const active = pickLatestGeoScoreRun([ScoreRunSchema.parse(JSON.parse(readFileSync(join(dir, 'data/scores', first), 'utf8')))]);
    const msg = await failureOfAsync(() => main());
    // SCORE_ATTRIBUTION is derived from the consensus (latest) batch; the fixture's only
    // batch is the oldest, so either the model or the date comparison must trip first.
    assert.ok(msg!.includes('SCORE_ATTRIBUTION'), msg ?? 'no failure');
    assert.ok(active.scorer.model.length > 0);
  });

  const built = existsSync(join(REPO, 'dist-astro', 'index.html'));

  test('passes on the real repo when the build output is present', { skip: !built }, async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => void logs.push(a.join(' '));
    try {
      await main();
    } finally {
      console.log = orig;
    }
    assert.ok(logs[0]!.startsWith('[check-geo-freshness] OK - '));
  });

  const realFacts = () => {
    const rows = GeoTreemapRowsSchema.parse(JSON.parse(readFileSync(join(REPO, 'public/data.treemap.json'), 'utf8')));
    const runs = readdirSync(REAL_SCORES).filter((f) => f.endsWith('.json')).sort()
      .map((f) => ScoreRunSchema.parse(JSON.parse(readFileSync(join(REAL_SCORES, f), 'utf8'))));
    return computeGeoFacts(rows, runs);
  };

  test('rendered fact blocks: one block per surface, satisfied by a synthetic dist-astro', async () => {
    const facts = realFacts();
    const blocks = await collectRenderedFactBlocks(facts);
    const surfaces = ['sectors/', 'rankings/', 'abilities/', 'compare/', 'q/', 'answers/'];
    for (const surface of surfaces) {
      assert.ok(blocks.some((b) => b.rel.startsWith(`dist-astro/${surface}`)), `no block for ${surface}`);
    }
    const dir = fixture();
    const byFile = new Map<string, string[]>();
    for (const { rel, expected } of blocks) byFile.set(rel, [...(byFile.get(rel) ?? []), expected]);
    for (const [rel, parts] of byFile) put(dir, rel, parts.join('\n'));
    assert.equal(await failureOfAsync(() => assertRenderedFactBlocks(facts)), null);

    const [first] = blocks;
    put(dir, first!.rel, 'stripped');
    const msg = await failureOfAsync(() => assertRenderedFactBlocks(facts));
    assert.ok(msg!.includes(`${first!.rel} does not contain the generated GEO citable fact block`));
  });

  test('rendered fact blocks fail with a build hint when dist-astro is absent', async () => {
    const facts = realFacts();
    fixture();
    const msg = await failureOfAsync(() => assertRenderedFactBlocks(facts));
    assert.ok(msg!.includes('Run `bun run build`'));
  });
});
