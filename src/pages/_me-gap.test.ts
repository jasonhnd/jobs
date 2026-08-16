import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { runInNewContext } from 'node:vm';

import { classifyShindanGap } from '../site/shindan-result-state.js';

type GapKind = 'aligned' | 'hidden_strength' | 'hidden_risk';

interface GapResult {
  readonly kind: GapKind;
  readonly matches: number;
  readonly gapAxes: number;
  readonly mismatchLabels: readonly string[];
  readonly underusedStrengthLabels: readonly string[];
  readonly riskMismatchLabels: readonly string[];
}

interface MeTestHooks {
  computeGap(selfCode: string, jobCode: string): GapResult;
  gapReadingFor(copy: { readonly reading: string }, gap: GapResult): string;
  quizStateParams(jobId: number | null, result: { code: string; variantId: string; pattern: string } | null): string;
}

const FAMILY_CODES = ['CPB', 'CPK', 'CDB', 'CDK', 'RPB', 'RPK', 'RDB', 'RDK'] as const;

const meJs = readFileSync(join(import.meta.dirname, '_me-inline.js'), 'utf8');
const meAstro = readFileSync(join(import.meta.dirname, 'me.astro'), 'utf8');
const shindanJs = readFileSync(join(import.meta.dirname, '_shindan.js'), 'utf8');

function stubEl(): Record<string, unknown> {
  return {
    addEventListener: () => undefined,
    setAttribute: () => undefined,
    removeAttribute: () => undefined,
    querySelector: () => null,
    querySelectorAll: () => [],
    replaceChildren: () => undefined,
    closest: () => null,
    style: {},
    dataset: {},
    hidden: true,
    textContent: '',
    value: '',
    children: [],
  };
}

function loadMeHooks(): MeTestHooks {
  const hooks: Partial<MeTestHooks> = {};
  runInNewContext(meJs, {
    document: {
      getElementById: () => stubEl(),
      readyState: 'loading',
      addEventListener: () => undefined,
    },
    window: { __ME_TEST_HOOKS__: hooks },
    location: { pathname: '/me', search: '', origin: 'https://example.test' },
    history: { replaceState: () => undefined },
    URLSearchParams,
    fetch: () => Promise.reject(new Error('no fetch in tests')),
  });
  assert.equal(typeof hooks.computeGap, 'function');
  assert.equal(typeof hooks.gapReadingFor, 'function');
  assert.equal(typeof hooks.quizStateParams, 'function');
  return hooks as MeTestHooks;
}

const hooks = loadMeHooks();

describe('/me screen 3 gap (#258)', () => {
  test('gap is the payoff after the quiz, with no second occupation input', () => {
    const quizAt = meAstro.indexOf('id="meQuiz"');
    const gapAt = meAstro.indexOf('id="meGap"');
    const similarAt = meAstro.indexOf('id="meSimilarHead"');
    assert.ok(quizAt > 0 && gapAt > quizAt && similarAt > gapAt);
    assert.match(meAstro, /id="meGap" hidden/);
    assert.doesNotMatch(meAstro, /id="shindanJobInput"|id="meGapJobInput"/);
    assert.doesNotMatch(meJs, /function selectGapJob|shindan_gap_select_job/);
  });

  test('uses the same computeGap verdicts as /shindan and classifyShindanGap', () => {
    for (const selfCode of FAMILY_CODES) {
      for (const jobCode of FAMILY_CODES) {
        const me = hooks.computeGap(selfCode, jobCode);
        assert.equal(me.kind, classifyShindanGap(selfCode, jobCode).kind, `${selfCode} x ${jobCode}`);
        assert.equal(me.matches + me.gapAxes, 3, `${selfCode} x ${jobCode}`);
      }
    }
    assert.match(meJs, /leftCount >= 2 \? cfg\.leftPole : cfg\.rightPole/);
    assert.match(shindanJs, /function computeGap\(selfCode, jobCode\)/);
  });

  test('does not persist gap in the query string', () => {
    const qs = hooks.quizStateParams(156, {
      code: 'RPK',
      variantId: 'mediator',
      pattern: '3-0/2-1/2-1',
    });
    const params = new URLSearchParams(qs);
    assert.equal(params.get('id'), '156');
    assert.equal(params.get('self'), 'RPK');
    assert.equal(params.get('variant'), 'mediator');
    assert.equal(params.get('axes'), '3-0/2-1/2-1');
    assert.equal(params.has('gap'), false);
    assert.doesNotMatch(meJs, /p\.set\('gap'/);
  });

  test('hidden_risk heading does not forecast the visitor\'s livelihood', () => {
    assert.match(meAstro, /この仕事での進め方は、これから変えていけます/);
    assert.doesNotMatch(meAstro, /失う|淘汰|危ない|生き残れない|仕事がなくなる/);
  });

  test('names underused strengths in the hidden_strength reading', () => {
    const result = hooks.computeGap('CPB', 'CDK');
    assert.equal(result.kind, 'hidden_strength');
    const reading = hooks.gapReadingFor(
      { reading: 'あなたの{strengths}という強みが、この仕事ではまだ使い切れていないかもしれません。' },
      result,
    );
    assert.doesNotMatch(reading, /\{strengths\}/);
    assert.match(reading, /現場感/);
  });
});
