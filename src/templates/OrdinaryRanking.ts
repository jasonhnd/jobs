import { escapeHtml, type SafeHtml } from '../lib/safe-html';
import { CONTENT_DATE } from '../lib/_content-date';
import { stringifyJsonLd } from '../lib/json-for-script';
import { siteConfig } from '../site/config';
import type { OrdinaryRankingRow } from '../views/ranking/ordinary';
import { renderHubJsonLd } from './Ranking';

export function renderOrdinaryRankingItem(row: OrdinaryRankingRow, isAiRanking: boolean): SafeHtml {
  return (`<li><a class="rl-row" href="${escapeHtml(row.href)}" data-track-event="list_row_click">` +
    `<span class="rl-main"><span class="rl-name">${escapeHtml(row.name)}</span>` +
    // AI ranking's primary metric is already the same score shown on the right.
    `<span class="rl-meta rl-metric">${escapeHtml(row.metricLabel)}${isAiRanking ? '' : ` ${escapeHtml(row.metric)}`}</span></span>` +
    `<span class="rl-end"><span class="risk-pill ${escapeHtml(row.band)}">${escapeHtml(row.score)}</span>` +
    `<span class="rl-chevron" aria-hidden="true">›</span></span></a></li>`) as SafeHtml;
}

export function renderOrdinaryMetricSummary(top: OrdinaryRankingRow | undefined): SafeHtml {
  if (!top) return '' as SafeHtml;
  const [year, month] = CONTENT_DATE.split('-');
  return (`<p class="rk-sum">1位は<strong>${escapeHtml(top.name)}</strong>（<strong>${escapeHtml(top.metric)}</strong>）` +
    ` · ${year}年${Number(month)}月更新</p>`) as SafeHtml;
}

export function renderOrdinaryRankingIndexJsonLd(title: string, description: string, cards: ReadonlyArray<{slug: string; h1: string}>): string {
  const payload = JSON.parse(renderHubJsonLd());
  Object.assign(payload['@graph'][0], { name: title, description });
  payload['@graph'].push({
    '@type': 'ItemList', '@id': `${siteConfig.origin}/rankings#list`, name: title,
    numberOfItems: cards.length,
    itemListElement: cards.map((card, i) => ({ '@type': 'ListItem', position: i + 1, name: card.h1, url: `${siteConfig.origin}/rankings/${card.slug}` })),
  });
  return stringifyJsonLd(payload, 2);
}
