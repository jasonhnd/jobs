import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { runInNewContext } from 'node:vm';

interface AxisView {
  readonly margin: string;
}

interface RuntimeHooks {
  validAxesPattern(value: unknown): boolean;
  axesFromCodePattern(code: string, pattern: string): AxisView[];
  resultStateParams(
    result: { code: string; variantId: string; pattern: string },
    gap: { jobId: string; kind: string } | null,
    familyParam: 'self' | 'worktype',
  ): URLSearchParams;
}

function loadRuntimeHooks(): RuntimeHooks {
  const hooks: Partial<RuntimeHooks> = {};
  const source = readFileSync('src/pages/_shindan.js', 'utf8');
  runInNewContext(source, {
    URLSearchParams,
    document: {
      getElementById: () => null,
      readyState: 'loading',
      addEventListener: () => undefined,
    },
    window: { __SHINDAN_TEST_HOOKS__: hooks },
  });
  return hooks as RuntimeHooks;
}

const hooks = loadRuntimeHooks();

/** Bun 1.4 deepStrictEqual treats vm.runInNewContext arrays as another realm. */
function hostClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('shindan browser share-state runtime', () => {
  test('preserves exact margins for distinct mixed patterns', () => {
    for (const pattern of ['3-0/3-0/2-1', '3-0/2-1/3-0']) {
      assert.equal(hooks.validAxesPattern(pattern), true);
      assert.deepEqual(
        hostClone(hooks.axesFromCodePattern('CDK', pattern).map((axis) => axis.margin)),
        pattern.split('/'),
      );
      const params = hooks.resultStateParams(
        { code: 'CDK', variantId: 'researcher', pattern },
        null,
        'self',
      );
      assert.equal(params.get('axes'), pattern);
    }
  });

  test('one serializer drives result, job, gap, and OG parameters', () => {
    const result = { code: 'RPK', variantId: 'mediator', pattern: '3-0/2-1/2-1' };
    const gap = { jobId: '133', kind: 'hidden_risk' };
    const share = hooks.resultStateParams(result, gap, 'self');
    const image = hooks.resultStateParams(result, gap, 'worktype');

    assert.equal(share.toString(), 'self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=133&gap=hidden_risk');
    assert.equal(image.toString(), 'worktype=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=133&gap=hidden_risk');
  });

  test('rejects malformed or answer-like axis payloads', () => {
    for (const value of ['3-0/2-1', '3-0/2-1/1-2', 'left,right,left', '', null]) {
      assert.equal(hooks.validAxesPattern(value), false, String(value));
    }
  });
});
