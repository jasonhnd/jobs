import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOrdinaryRankingItem, renderOrdinaryMetricSummary } from './OrdinaryRanking';

test('ordinary row escapes data and retains full long names', () => {
  const html = renderOrdinaryRankingItem({ id: 404, href: '/occupations/404', name: '<script>"長い職業名"</script>', metricLabel: '就業者数', metric: '1,234人', score: '4/10 変化 中くらい', band: 'mid' }, false);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;&quot;長い職業名&quot;&lt;/script&gt;'));
  assert.ok(html.includes('href="/occupations/404"'));
  assert.ok(html.includes('<span class="ordinary-band">変化 中くらい</span>'));
  assert.equal(renderOrdinaryMetricSummary(undefined), '');
});
