import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../../graph';
import { buildRankings, loadOccupationsFromGraph } from '../ranking';
import { buildOrdinaryRankingView, ordinaryRankingMetric } from './ordinary';
import { ORDINARY_RANKING_SLUGS } from '../../site/ordinary-ranking-copy';
import manifest from '../../../docs/pro-split/route-manifest.json';

test('ordinary projection preserves all input rows and limits itself to the route-policy selections', async () => {
  assert.deepEqual([...ORDINARY_RANKING_SLUGS].sort(), manifest.rankings.filter(r => r.ordinaryPath).map(r => r.slug).sort());
  const graph = await loadGraph();
  const results = buildRankings(() => loadOccupationsFromGraph(graph)).results;
  assert.equal(results.size, 39);
  for (const result of results.values()) {
    const before = JSON.stringify(result);
    if ((ORDINARY_RANKING_SLUGS as readonly string[]).includes(result.slug)) {
      const view = buildOrdinaryRankingView(result);
      assert.deepEqual(view.rows.map(r => r.id), result.items.map(r => r.id));
      assert.equal(JSON.stringify(result), before);
    } else assert.throws(() => buildOrdinaryRankingView(result), /No ordinary presentation/);
  }
});

test('missing metrics and zero values are distinct; rounded band boundaries match the shared score label', async () => {
  const graph = await loadGraph();
  const result = buildRankings(() => loadOccupationsFromGraph(graph)).results.get('workers')!;
  const o = result.items[0]!;
  for (const value of [null, NaN, Infinity]) {
    assert.equal(ordinaryRankingMetric({ ...o, workers: value }, 'workers'), '—');
    assert.equal(ordinaryRankingMetric({ ...o, hourly_wage: value }, 'hourly-wage'), '—');
    assert.equal(ordinaryRankingMetric({ ...o, salary: value }, 'salary-safe'), '—');
  }
  assert.equal(ordinaryRankingMetric({ ...o, workers: 0 }, 'workers'), '0人');
  assert.equal(ordinaryRankingMetric({ ...o, hourly_wage: 1531.25 }, 'hourly-wage'), '1,531.25円/時');
  assert.equal(ordinaryRankingMetric({ ...o, demand_band: null }, 'high-demand'), '—');
  for (const [score, word] of [[3.97, '中くらい'], [6.97, '大きい'], [3.94, '小さい']] as const) {
    const row = buildOrdinaryRankingView({ ...result, items: [{ ...o, ai_risk: score }] }).rows[0]!;
    assert.ok(row.score.includes('変化 ' + word), row.score);
  }
  assert.equal(buildOrdinaryRankingView({ ...result, items: [{ ...o, ai_risk: null }] }).rows[0]!.score, '—');
});

