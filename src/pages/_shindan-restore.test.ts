import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

interface Hooks {
  countsAsNewResult(options?: Record<string, unknown> | null): boolean;
}

const shindan = readFileSync('src/pages/_shindan.js', 'utf8');
const me = readFileSync('src/pages/_me-inline.js', 'utf8');

function loadHooks(): Hooks {
  const hooks: Partial<Hooks> = {};
  runInNewContext(shindan, {
    document: { getElementById: () => null, readyState: 'loading', addEventListener: () => undefined },
    window: { __SHINDAN_TEST_HOOKS__: hooks },
  });
  assert.equal(typeof hooks.countsAsNewResult, 'function');
  return hooks as Hooks;
}

function fnBody(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `${signature} not found`);
  const end = src.indexOf('\n    }\n', start);
  return src.slice(start, end);
}

test('shindan_result_view (a conversion) is not re-sent for restored or shared results (#884)', () => {
  const { countsAsNewResult } = loadHooks();
  assert.equal(countsAsNewResult(undefined), true);
  assert.equal(countsAsNewResult(null), true);
  assert.equal(countsAsNewResult({ skipScroll: true }), true);
  assert.equal(countsAsNewResult({ restored: true, skipScroll: true }), false);
  assert.equal(countsAsNewResult({ fromUrl: true, skipScroll: true }), false);

  const render = fnBody(shindan, 'function renderResult(');
  assert.match(render, /if \(countsAsNewResult\(options\)\) \{\n\s+track\('shindan_result_view'/);
  assert.match(shindan, /renderResult\(fromUrl, \{ fromUrl: true, skipScroll: true \}\)/);
});

test('shindan selectGapJob ignores responses for an older selection (#884)', () => {
  const body = fnBody(shindan, 'function selectGapJob(');
  assert.match(body, /var seq = \+\+gapSelectSeq;/);
  assert.match(body, /if \(seq !== gapSelectSeq\) return;/);
  const load = fnBody(shindan, 'function loadTransferPaths(');
  assert.match(load, /if \(transferPathsPromise\) return transferPathsPromise;/);
});

test('/me selectJob ignores older selections and reports load failures (#884)', () => {
  const select = fnBody(me, 'function selectJob(');
  assert.match(select, /var seq = \+\+selectSeq;/);
  assert.match(select, /if \(seq !== selectSeq\) return;/);
  assert.match(select, /\.catch\(showLoadFailure\)/);
  assert.match(fnBody(me, 'function submitQuiz('), /\.catch\(showQuizLoadFailure\)/);
  assert.match(fnBody(me, 'function showGap('), /\.catch\(showQuizLoadFailure\)/);
});
