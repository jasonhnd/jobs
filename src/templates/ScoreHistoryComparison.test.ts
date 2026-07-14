import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  renderScoreHistoryComparison,
  type ScoreHistoryComparisonEntry,
} from './ScoreHistoryComparison.js';

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

describe('renderScoreHistoryComparison', () => {
  test('returns empty SafeHtml when no history is present', () => {
    assert.equal(renderScoreHistoryComparison([]), '');
  });

  test('renders three runs in ascending date order with fable as current', () => {
    const html = renderScoreHistoryComparison([threeRuns[2]!, threeRuns[0]!, threeRuns[1]!]);

    assert.ok(html.includes('モデル比較'));
    assert.ok(html.includes('<a href="/models">全モデルを見る</a>'));
    assert.ok(html.includes('<details class="score-history-details">'));
    assert.ok(html.includes('<summary>これまでのモデルを表示（2件）</summary>'));
    assert.ok(html.includes('2026年4月25日'));
    assert.ok(html.includes('2026年5月30日'));
    assert.ok(html.includes('2026年6月13日'));
    assert.ok(html.indexOf('Claude Opus 4.7') < html.indexOf('Claude Opus 4.8'));
    assert.ok(html.includes('<a class="score-history-current-model" href="/models/fable-5">Claude Fable 5</a>'));
    assert.ok(html.includes('<a href="/models/opus-4-7">Claude Opus 4.7</a>'));
    assert.ok(html.includes('<a href="/models/opus-4-8">Claude Opus 4.8</a>'));
    assert.ok(html.includes('<dd class="sh-delta">+4</dd>'));
    assert.ok(html.includes('変化指数'));
    assert.ok(html.includes('現行モデルとの差'));
    assert.ok(!html.includes('<table'));
    assert.ok(!html.includes('<td'));
    assert.ok(!html.includes('<dd class="sh-delta">±0</dd>'));
  });

  test('newer future run automatically becomes current', () => {
    const html = renderScoreHistoryComparison([
      ...threeRuns,
      {
        model: 'gpt-5.6-sol',
        date: '2026-07-20',
        transformation: 4,
        displacement: 2,
        dims: { d1: 1, d2: 2, d3: 3, d4: 4, d5: 5, d6: 6, d7: 7, d8: 8, d9: 9, d10: 10 },
      },
    ]);

    assert.ok(html.includes('<a class="score-history-current-model" href="/models/gpt-5.6-sol">GPT 5.6 SOL</a>'));
    assert.ok(!html.includes('<a class="score-history-current-model" href="/models/fable-5">Claude Fable 5</a>'));
    assert.ok(html.includes('<dd class="sh-delta">-1</dd>'));
  });

  test('missing legacy run renders remaining rows without an error state', () => {
    const html = renderScoreHistoryComparison(threeRuns.slice(1));
    assert.equal((html.match(/<li class="score-history-item">/g) ?? []).length, 1);
    assert.ok(!html.includes('Claude Opus 4.7'));
    assert.ok(!html.includes('データなし'));
    assert.ok(!html.includes('<table'));
  });

  test('single current score does not render an empty disclosure', () => {
    const html = renderScoreHistoryComparison([threeRuns[2]!]);

    assert.ok(html.includes('<a class="score-history-current-model" href="/models/fable-5">Claude Fable 5</a>'));
    assert.ok(!html.includes('<details'));
    assert.ok(!html.includes('<table'));
  });
});
