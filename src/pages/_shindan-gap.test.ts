import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { runInNewContext } from 'node:vm';

import { GAP } from '../site/worktype-copy.js';
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

interface ShindanTestHooks {
  computeGap(selfCode: string, jobCode: string): GapResult;
  gapReadingFor(copy: { readonly reading: string }, gap: GapResult): string;
}

const FAMILY_CODES = ['CPB', 'CPK', 'CDB', 'CDK', 'RPB', 'RPK', 'RDB', 'RDK'] as const;

// Rows are personal codes and columns are occupation codes in FAMILY_CODES order.
// Keeping the complete expected matrix explicit prevents the test from restating
// the implementation and guarantees that every one of the 64 pairs is asserted.
const EXPECTED_KINDS: Readonly<Record<(typeof FAMILY_CODES)[number], readonly GapKind[]>> = {
  CPB: ['aligned', 'aligned', 'aligned', 'hidden_strength', 'aligned', 'hidden_strength', 'hidden_strength', 'hidden_strength'],
  CPK: ['aligned', 'aligned', 'hidden_strength', 'aligned', 'hidden_strength', 'aligned', 'hidden_strength', 'hidden_strength'],
  CDB: ['aligned', 'hidden_strength', 'aligned', 'aligned', 'hidden_strength', 'hidden_strength', 'aligned', 'hidden_strength'],
  CDK: ['hidden_risk', 'aligned', 'aligned', 'aligned', 'hidden_risk', 'hidden_strength', 'hidden_strength', 'aligned'],
  RPB: ['aligned', 'hidden_strength', 'hidden_strength', 'hidden_strength', 'aligned', 'aligned', 'aligned', 'hidden_strength'],
  RPK: ['hidden_risk', 'aligned', 'hidden_risk', 'hidden_strength', 'aligned', 'aligned', 'hidden_strength', 'aligned'],
  RDB: ['hidden_risk', 'hidden_risk', 'aligned', 'hidden_strength', 'aligned', 'hidden_strength', 'aligned', 'aligned'],
  RDK: ['hidden_risk', 'hidden_risk', 'hidden_risk', 'aligned', 'hidden_risk', 'aligned', 'aligned', 'aligned'],
};

function loadRuntimeHooks(): ShindanTestHooks {
  const hooks: Partial<ShindanTestHooks> = {};
  const source = readFileSync('src/pages/_shindan.js', 'utf8');

  runInNewContext(source, {
    document: {
      getElementById: () => null,
      readyState: 'loading',
      addEventListener: () => undefined,
    },
    window: { __SHINDAN_TEST_HOOKS__: hooks },
  });

  assert.equal(typeof hooks.computeGap, 'function');
  assert.equal(typeof hooks.gapReadingFor, 'function');
  return hooks as ShindanTestHooks;
}

const hooks = loadRuntimeHooks();

describe('shindan gap classification', () => {
  test('classifies the complete 8 x 8 personal and occupation code matrix', () => {
    let coveredPairs = 0;

    for (const selfCode of FAMILY_CODES) {
      for (const [jobIndex, jobCode] of FAMILY_CODES.entries()) {
        const result = hooks.computeGap(selfCode, jobCode);
        assert.equal(result.kind, EXPECTED_KINDS[selfCode][jobIndex], `${selfCode} x ${jobCode}`);
        assert.equal(result.matches + result.gapAxes, 3, `${selfCode} x ${jobCode}`);
        coveredPairs += 1;
      }
    }

    assert.equal(coveredPairs, 64);
  });

  test('prioritizes two occupation-required human-side mismatches in a mixed case', () => {
    const result = hooks.computeGap('RPK', 'CDB');

    assert.equal(result.kind, 'hidden_risk');
    assert.equal(result.riskMismatchLabels.length, 2);
    assert.deepEqual([...result.underusedStrengthLabels], ['対人感覚']);
  });

  test('keeps aligned results, including RDK x RDK, classified as aligned', () => {
    assert.equal(hooks.computeGap('CPB', 'CPK').kind, 'aligned');
    assert.equal(hooks.computeGap('RDK', 'RDK').kind, 'aligned');
  });

  test('browser and server share the same gap verdict for every family pair', () => {
    for (const selfCode of FAMILY_CODES) {
      for (const jobCode of FAMILY_CODES) {
        assert.equal(
          hooks.computeGap(selfCode, jobCode).kind,
          classifyShindanGap(selfCode, jobCode).kind,
          `${selfCode} x ${jobCode}`,
        );
      }
    }
  });
});

describe('hidden-strength reading', () => {
  test('names exactly the personal strengths that the occupation underuses', () => {
    const possibleLabels = ['創造性', '対人感覚', '現場感'];

    for (const selfCode of FAMILY_CODES) {
      for (const jobCode of FAMILY_CODES) {
        const result = hooks.computeGap(selfCode, jobCode);
        if (result.kind !== 'hidden_strength') continue;

        const reading = hooks.gapReadingFor(GAP.hidden_strength, result);
        assert.doesNotMatch(reading, /\{strengths\}/, `${selfCode} x ${jobCode}`);
        for (const label of possibleLabels) {
          assert.equal(
            reading.includes(label),
            result.underusedStrengthLabels.includes(label),
            `${selfCode} x ${jobCode}: ${label}`,
          );
        }
      }
    }
  });
});
