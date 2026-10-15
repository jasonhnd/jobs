import type { RankingResult } from '@/views/ranking';
import { buildOrdinaryRankingView } from '@/views/ranking/ordinary';
import { renderOrdinaryRankingItem, renderOrdinaryMetricSummary } from '@/templates/OrdinaryRanking';
import { renderRankingSummary, renderJsonLd } from '@/templates/Ranking';
import { stringifyJsonLd } from '@/lib/json-for-script';
import { rankingCanonicalUrl } from '@/lib/urls';
import { siteConfig } from '@/site/config';

export function buildOrdinaryRankingsBindings(result: RankingResult) {
  const view = buildOrdinaryRankingView(result);
  const canonical = rankingCanonicalUrl(view.slug);
  const ogImage = `${siteConfig.origin}/api/og?ranking=${view.slug}&edition=ordinary`;
  const jsonLd = JSON.parse(renderJsonLd(canonical, view.title, view.description, result.items, null));
  jsonLd['@graph'].find((n: any) => n['@type'] === 'WebPage').speakable.cssSelector = ['.ordinary-lead', '.ordinary-score-reading'];
  jsonLd['@graph'].find((n: any) => n['@type'] === 'Article').image = ogImage;
  jsonLd['@graph'].find((n: any) => n['@type'] === 'ItemList').itemListOrder =
    `https://schema.org/ItemListOrder${['ai-risk-low', 'short-hours'].includes(view.slug) ? 'Ascending' : 'Descending'}`;
  return {
    ...view, canonical, ogImage,
    rankItems: view.rows.map(row => renderOrdinaryRankingItem(row, view.isAiRanking)).join(''),
    summaryHtml: view.isAiRanking ? renderRankingSummary(result.items) : renderOrdinaryMetricSummary(view.rows[0]),
    jsonLd: stringifyJsonLd(jsonLd, 2),
  };
}
