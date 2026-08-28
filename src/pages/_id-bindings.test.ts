import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildVerdictDoors,
  derivePrevDelta,
  formatPrevDelta,
  formatScoredMonthJa,
  formatVerdictFacts,
  formatVerdictRankLine,
  verdictSentence,
} from './_id-bindings.ts';

describe('derivePrevDelta', () => {
  test('returns null when history has fewer than 2 entries', () => {
    assert.equal(derivePrevDelta([]), null);
    assert.equal(derivePrevDelta([{ date: '2026-07-26', transformation: 3.6 }]), null);
  });

  test('subtracts previous from latest after sorting by date', () => {
    assert.equal(
      derivePrevDelta([
        { date: '2026-05-30', transformation: 3.8 },
        { date: '2026-07-26', transformation: 3.6 },
      ]),
      3.6 - 3.8,
    );
  });
});

describe('formatPrevDelta', () => {
  test('zero renders ±0', () => {
    assert.equal(formatPrevDelta(0), '±0');
    assert.equal(formatPrevDelta(0.04), '±0');
  });
  test('signed one-decimal', () => {
    assert.equal(formatPrevDelta(-0.2), '-0.2');
    assert.equal(formatPrevDelta(1), '+1');
  });
});

describe('formatVerdictRankLine', () => {
  test('joins rank, delta, and scored month', () => {
    assert.equal(
      formatVerdictRankLine({
        rank: 483,
        total: 556,
        prevDelta: 0,
        scoredAtJa: '2026年7月採点',
      }),
      '556職中 第483位 · 先月比 ±0 · 2026年7月採点',
    );
  });
  test('omits 先月比 when prevDelta is null', () => {
    assert.equal(
      formatVerdictRankLine({
        rank: 6,
        total: 556,
        prevDelta: null,
        scoredAtJa: '2026年7月採点',
      }),
      '556職中 第6位 · 2026年7月採点',
    );
  });
});

describe('formatScoredMonthJa', () => {
  test('formats YYYY-MM-DD as 年月採点', () => {
    assert.equal(formatScoredMonthJa('2026-07-26'), '2026年7月採点');
  });
  test('falls back to CONTENT_DATE when missing', () => {
    assert.match(formatScoredMonthJa(undefined), /採点$/);
  });
});

describe('formatVerdictFacts', () => {
  test('skips null fields and uses 万人 rounding', () => {
    assert.equal(
      formatVerdictFacts({ salaryMan: 519.6, workers: 690000, hours: 155.4 }),
      '年収 約519万円 · 就業者 約69万人 · 月155h',
    );
    assert.equal(formatVerdictFacts({ salaryMan: null, workers: null, hours: 160 }), '月160h');
  });
});

describe('verdictSentence', () => {
  test('reuses rationale verbatim and falls back to the callout', () => {
    assert.equal(verdictSentence('現場の判断が残る。', 3.6), '現場の判断が残る。');
    assert.equal(verdictSentence('  ', 3.6), '低 AI 影響。専門性と判断が必要な業務が中心で、当面は安定。');
    assert.equal(verdictSentence('', null), 'AI 影響度未評価。');
  });
});

describe('buildVerdictDoors', () => {
  test('null risk is mid-variant minus the score anchor', () => {
    assert.deepEqual(buildVerdictDoors({ risk: null, hasTransfer: true }), [
      { href: '#sec-similar', label: '似た仕事', kind: 'ghost' },
    ]);
  });
  test('low <5 targets なぜ守られやすいか + 似た仕事', () => {
    const doors = buildVerdictDoors({ risk: 3.6, hasTransfer: true });
    assert.deepEqual(doors, [
      { href: '#sec-aiois', label: 'なぜ守られやすいか', kind: 'solid' },
      { href: '#sec-similar', label: '似た仕事', kind: 'ghost' },
    ]);
  });
  test('high ≥7 uses transfer door, falling back to 似た仕事', () => {
    assert.equal(buildVerdictDoors({ risk: 8.5, hasTransfer: true })[1]?.label, '移り先の候補');
    assert.equal(buildVerdictDoors({ risk: 8.5, hasTransfer: true })[1]?.href, '#sec-transfer');
    assert.equal(buildVerdictDoors({ risk: 8.5, hasTransfer: false })[1]?.href, '#sec-similar');
    assert.equal(buildVerdictDoors({ risk: 8.5, hasTransfer: true })[0]?.href, '#sec-aiois');
  });
  test('mid uses スコアの中身', () => {
    assert.equal(buildVerdictDoors({ risk: 5.5, hasTransfer: false })[0]?.label, 'スコアの中身');
  });
});
