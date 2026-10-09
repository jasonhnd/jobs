/** Stage-3 ordinary ranking contract, exercised against the real static output. */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadGraph } from '../graph';
import { buildRankings, loadOccupationsFromGraph } from '../views/ranking';
import { formatRiskScoreLabel } from '../lib/score-format';

const dist = join(process.cwd(), 'dist-astro');
const ready = existsSync(join(dist, 'rankings.html'));
const required = process.env.REQUIRE_BUILT_ARTIFACTS === '1';
const slugs = ['ai-risk-high', 'workers', 'ai-risk-low', 'high-demand', 'salary-safe', 'short-hours', 'hourly-wage', 'salary'];
const html = (path: string) => readFileSync(join(dist, path + '.html'), 'utf8');
const nodes = (text: string): any[] => [...text.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => JSON.parse(m[1]!)['@graph'] ?? []);

describe('ordinary rankings stage 3', { skip: !ready && !required }, () => {
  test('index contains exactly the eight ordinary cards and the complete Pro exit', () => {
    const text = html('rankings');
    const cards = [...text.matchAll(/<a\b[^>]*class="ordinary-ranking-card"[^>]*href="([^"]+)"/g)].map(m => m[1]!.split('/').pop());
    assert.deepEqual(cards, slugs);
    assert.ok(text.includes('href="/pro/rankings">全39ランキングは Pro で</a>'));
    for (const removed of ['class="mover-row', 'class="insight-card', 'class="ranking-anchor-nav']) assert.ok(!text.includes(removed), removed);
    const list = nodes(text).find(n => n['@type'] === 'ItemList');
    assert.equal(list.numberOfItems, 8);
    assert.deepEqual(list.itemListElement.map((n: any) => n.url.split('/').pop()), slugs);
  });

  test('each ordinary detail has first-screen explanation and one search CTA, without hidden Pro analysis', () => {
    for (const slug of slugs) {
      const text = html('rankings/' + slug);
      const header = text.match(/<header id="content">([\s\S]*?)<\/header>/)![1]!;
      assert.match(header, /class="ordinary-lead"/);
      assert.match(header, /href="\/me"[^>]*>自分の仕事を探す/);
      assert.equal((header.match(/data-track-event="me_entry_click"/g) ?? []).length, 1, slug);
      for (const removed of ['<details class="chap"', 'class="ai-fact', 'class="highlights', 'class="related-cross-hubs', 'class="escape-route']) assert.ok(!text.includes(removed), slug + ': ' + removed);
      const structured = nodes(text);
      assert.ok(!structured.some(n => n['@type'] === 'FAQPage'), slug);
      assert.deepEqual(structured.find(n => n['@type'] === 'WebPage').speakable.cssSelector, ['.ordinary-lead', '.ordinary-score-reading']);
      assert.match(text, new RegExp(`href="/pro/rankings/${slug}">Pro で詳しく見る`));
    }
  });

  test('all 240 rows retain Pro order and displayed score/band, with the actual ranking metric in row and summary', async () => {
    const graph = await loadGraph();
    const results = buildRankings(() => loadOccupationsFromGraph(graph)).results;
    for (const slug of slugs) {
      const result = results.get(slug as any)!;
      const text = html('rankings/' + slug);
      const rows = [...text.matchAll(/<a class="rl-row"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
      const proIds = nodes(html('pro/rankings/' + slug)).find(n => n['@type'] === 'ItemList').itemListElement.map((n: any) => Number(n.url.split('/').pop()));
      assert.deepEqual(rows.map(m => Number(m[1]!.split('/').pop())), result.items.map(o => o.id));
      assert.deepEqual(proIds, result.items.map(o => o.id));
      const metric = (o: typeof result.items[number]): string => {
        switch (slug) {
          case 'workers': return `${Math.trunc(o.workers!).toLocaleString('en-US')}人`;
          case 'salary': case 'salary-safe': return `${Math.trunc(o.salary!)}万円`;
          case 'short-hours': return `${Math.trunc(o.monthly_hours!)}時間`;
          case 'hourly-wage': return `${o.hourly_wage!.toLocaleString('en-US')}円/時`;
          case 'high-demand': return {hot:'高需要',normal:'通常',cold:'低需要'}[o.demand_band!]!;
          default: return formatRiskScoreLabel(o.ai_risk);
        }
      };
      rows.forEach((row, i) => {
        assert.ok(row[2]!.includes(metric(result.items[i]!)), slug + ': metric ' + i);
        assert.ok(row[2]!.includes(formatRiskScoreLabel(result.items[i]!.ai_risk)), slug + ': score ' + i);
      });
      assert.ok(text.match(/<p class="rk-sum">([\s\S]*?)<\/p>/)![1]!.includes(metric(result.items[0]!)), slug + ': summary metric');
    }
  });

  test('AI-high unsigned title changes only ordinary; hourly conversion and real selection/order are explicit', () => {
    const high = html('rankings/ai-risk-high');
    assert.match(high, /<h1>[^]*?AIで大きく変わる仕事 TOP30/);
    assert.ok(high.includes('/api/og?ranking=ai-risk-high&amp;edition=ordinary'));
    assert.match(html('pro/rankings/ai-risk-high'), /<h1>[^]*?AIに奪われる仕事 TOP30/);
    assert.ok(html('rankings/hourly-wage').includes('求人の月額賃金を160時間で割った換算値'));
    assert.ok(html('rankings/salary-safe').includes('5以下'));
    assert.ok(html('rankings/high-demand').includes('同じ区分では、年収が高い順'));
  });
});
