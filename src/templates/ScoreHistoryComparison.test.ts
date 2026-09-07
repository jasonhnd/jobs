import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  renderScoreHistoryComparison,
  type ScoreHistoryComparisonEntry,
  type ScoreHistoryComparisonOptions,
} from './ScoreHistoryComparison.js';
import { CONSENSUS_AGING_NOTE, CONSENSUS_HEADLINE_LABEL } from '../site/consensus-copy.js';

const threeRuns: ScoreHistoryComparisonEntry[] = [
  {
    model: 'claude-opus-4-7',
    date: '2026-04-25',
    transformation: 7,
    displacement: null,
    dims: null,
  },
  {
    model: 'claude-opus-4-8',
    date: '2026-05-30',
    transformation: 5,
    displacement: 2,
    dims: { d1: 1, d2: 2, d3: 3, d4: 4, d5: 5, d6: 6, d7: 7, d8: 8, d9: 9, d10: 10 },
  },
  {
    model: 'claude-fable-5',
    date: '2026-06-13',
    transformation: 3,
    displacement: 1,
    dims: { d1: 1, d2: 2, d3: 3, d4: 4, d5: 5, d6: 6, d7: 7, d8: 8, d9: 9, d10: 10 },
  },
];

const opts: ScoreHistoryComparisonOptions = {
  consensusTransformation: 4,
  voteCount: 2,
  latestRunDate: '2026-06-13',
  usedExpiredVotes: false,
};

describe('renderScoreHistoryComparison', () => {
  test('returns empty SafeHtml when no history is present', () => {
    assert.equal(renderScoreHistoryComparison([], opts), '');
  });

  test('highlights consensus without a model name; votes live in the fold', () => {
    const html = renderScoreHistoryComparison([threeRuns[2]!, threeRuns[0]!, threeRuns[1]!], opts);

    assert.ok(html.includes('モデル比較'));
    assert.ok(html.includes('<a href="/models">全モデルを見る</a>'));
    assert.ok(html.includes(`id="score-history-details"`));
    assert.ok(html.includes('<summary>モデル別の票を表示（3件）</summary>'));
    assert.ok(html.includes('2026年4月25日'));
    assert.ok(html.includes('2026年5月30日'));
    assert.ok(html.includes('2026年6月13日'));
    assert.ok(html.indexOf('Claude Opus 4.7') < html.indexOf('Claude Opus 4.8'));
    assert.ok(html.includes(CONSENSUS_HEADLINE_LABEL));
    assert.ok(html.includes('2票 · 最新採点 2026年6月13日'));
    assert.equal(html.includes('score-history-current-model'), false);
    assert.ok(html.includes('<a href="/models/fable-5@2026-06-13">Claude Fable 5</a>'));
    assert.ok(html.includes('<a href="/models/opus-4-7@2026-04-25">Claude Opus 4.7</a>'));
    assert.ok(html.includes('<a href="/models/opus-4-8@2026-05-30">Claude Opus 4.8</a>'));
    assert.ok(html.includes('総合との差'));
    assert.ok(html.includes('<dd class="sh-delta">+1</dd>'));
    assert.ok(html.includes('<dd class="sh-delta">-1</dd>'));
    assert.ok(html.includes('変化指数'));
    assert.ok(!html.includes('現行モデルとの差'));
    assert.ok(!html.includes('<table'));
    assert.ok(!html.includes('<td'));
  });

  test('puts every vote in the fold, including the newest model', () => {
    const html = renderScoreHistoryComparison([
      ...threeRuns,
      {
        model: 'gpt-5.6-sol',
        date: '2026-07-20',
        transformation: 4,
        displacement: 2,
        dims: { d1: 1, d2: 2, d3: 3, d4: 4, d5: 5, d6: 6, d7: 7, d8: 8, d9: 9, d10: 10 },
      },
    ], { ...opts, latestRunDate: '2026-07-20', voteCount: 3 });

    assert.ok(html.includes('<a href="/models/gpt-5.6-sol@2026-07-20">GPT 5.6 SOL</a>'));
    assert.ok(html.includes('<a href="/models/fable-5@2026-06-13">Claude Fable 5</a>'));
    assert.equal(html.includes('score-history-current-model'), false);
    assert.ok(html.includes('<summary>モデル別の票を表示（4件）</summary>'));
  });

  test('missing legacy run still renders remaining rows (no empty-data banner)', () => {
    const html = renderScoreHistoryComparison(threeRuns.slice(1), opts);
    assert.equal((html.match(/<li class="score-history-item">/g) ?? []).length, 2);
    assert.ok(!html.includes('Claude Opus 4.7'));
    assert.ok(!html.includes('データなし'));
    assert.ok(!html.includes('<table'));
  });

  test('a single vote still opens a disclosure so the model name stays in the fold', () => {
    const html = renderScoreHistoryComparison([threeRuns[2]!], {
      ...opts,
      voteCount: 1,
      consensusTransformation: 3,
    });

    assert.ok(html.includes('<details'));
    assert.ok(html.includes('<a href="/models/fable-5@2026-06-13">Claude Fable 5</a>'));
    assert.equal(html.includes('score-history-current-model'), false);
    assert.ok(!html.includes('<table'));
  });

  test('aging note appears inside the fold only when expired votes were used', () => {
    const without = renderScoreHistoryComparison(threeRuns, opts);
    assert.equal(without.includes(CONSENSUS_AGING_NOTE), false);

    const withNote = renderScoreHistoryComparison(threeRuns, { ...opts, usedExpiredVotes: true });
    assert.ok(withNote.includes(CONSENSUS_AGING_NOTE));
    const detailsAt = withNote.indexOf('<details');
    const agingAt = withNote.indexOf(CONSENSUS_AGING_NOTE);
    assert.ok(detailsAt >= 0 && agingAt > detailsAt);
  });

  // Issue #216: a batch with `dims: null` predates AIOIS-10. Its number is a
  // single-axis ai_risk, so it is neither a 変化指数 nor comparable by subtraction.
  describe('pre-AIOIS legacy entries', () => {
    const legacy = threeRuns[0]!;
    const aiois = threeRuns[1]!;
    const current = threeRuns[2]!;

    test('renders no delta for the legacy row', () => {
      const html = renderScoreHistoryComparison([legacy, current], opts);

      // 7 - 4 = +3 across two different standards. This used to ship.
      assert.equal(html.includes('+3'), false, html);
      assert.ok(html.includes('AIOIS-10 導入前のため比較対象外'));
      assert.ok(html.includes('<dd class="sh-delta">-1</dd>'));
    });

    test('does not label a legacy score 変化指数', () => {
      const html = renderScoreHistoryComparison([legacy, current], opts);

      assert.ok(html.includes('<dt>旧方式スコア</dt>'));
      assert.ok(html.includes('<dt>変化指数</dt>'), 'the AIOIS vote still shows a transformation');
      assert.ok(html.includes('<dd class="sh-num">7<span>/10</span></dd>'));
    });

    test('drops the same-standard claim when a legacy row is present', () => {
      const withLegacy = renderScoreHistoryComparison([legacy, current], opts);
      assert.equal(withLegacy.includes('同じ基準にもとづき'), false, withLegacy);
      assert.ok(withLegacy.includes('基準が異なるため'));
    });

    test('keeps the same-standard claim when every row is AIOIS-10', () => {
      const allAiois = renderScoreHistoryComparison([aiois, current], opts);
      assert.ok(allAiois.includes('同じ基準にもとづき'));
      assert.equal(allAiois.includes('旧方式スコア'), false);
    });

    test('a legacy row and an AIOIS row in the same list are treated differently', () => {
      const html = renderScoreHistoryComparison([legacy, aiois, current], opts);

      assert.ok(html.includes('<dt>旧方式スコア</dt>'), 'legacy row keeps its own label');
      assert.ok(html.includes('<dt>変化指数</dt>'), 'the AIOIS row still shows a transformation');
      assert.equal((html.match(/sh-delta/g) ?? []).length, 2, html);
      assert.ok(html.includes('<dd class="sh-delta">+1</dd>'));
      assert.ok(html.includes('<dd class="sh-delta">-1</dd>'));
    });
  });
});
