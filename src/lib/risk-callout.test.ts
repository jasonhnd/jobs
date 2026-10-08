/**
 * risk-callout.test.ts — pin the 5-band risk callout copy.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pickRiskOneLineCallout } from './risk-callout.js';

describe('pickRiskOneLineCallout', () => {
  test('null → 未評価 copy', () => {
    assert.equal(pickRiskOneLineCallout(null), 'AI 影響度未評価。');
  });

  test('0..3 → 変化は小さい copy', () => {
    for (const r of [0, 1, 2, 3]) {
      assert.ok(pickRiskOneLineCallout(r).startsWith('変化は小さい。'), `risk=${r}`);
    }
  });

  test('4..6 → 中程度 copy', () => {
    for (const r of [4, 5, 6]) {
      assert.ok(pickRiskOneLineCallout(r).startsWith('変化は中くらい。'), `risk=${r}`);
    }
  });

  test('7..8 → 高い copy', () => {
    for (const r of [7, 8]) {
      assert.ok(pickRiskOneLineCallout(r).startsWith('変化は大きい。'), `risk=${r}`);
    }
  });

  test('9..10 → 定型業務 copy', () => {
    for (const r of [9, 10]) {
      assert.ok(pickRiskOneLineCallout(r).startsWith('定型業務が中心'), `risk=${r}`);
    }
  });

  test('boundary 3→4: switches from 低 to 中程度', () => {
    assert.ok(pickRiskOneLineCallout(3).startsWith('変化は小さい。'));
    assert.ok(pickRiskOneLineCallout(4).startsWith('変化は中くらい。'));
  });

  test('boundary 6→7: switches from 中程度 to 高い', () => {
    assert.ok(pickRiskOneLineCallout(6).startsWith('変化は中くらい。'));
    assert.ok(pickRiskOneLineCallout(7).startsWith('変化は大きい。'));
  });

  test('boundary 8→9: switches from 高い to 定型業務', () => {
    assert.ok(pickRiskOneLineCallout(8).startsWith('変化は大きい。'));
    assert.ok(pickRiskOneLineCallout(9).startsWith('定型業務が中心'));
  });
});
