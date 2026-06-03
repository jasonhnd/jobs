/**
 * src/pages/q/_q-bindings.ts — bindings for [q].astro.
 * Phase D audit #7 (2026-05-14): page frontmatter ≤30 lines per doc §2.5.
 */
import type { KnowledgeGraph } from '@/graph';
import { QA_ITEMS, type QAItem } from '@/views/qa-meta.js';
import type { DetailFileMin } from '@/views/genre-hub.js';
import { escapeHtml } from '@/templates/Hub.js';
import { buildLinkRegistry, inlineLinkText } from '@/views/inline-links.js';
import { renderRelatedHubsBlock } from '@/views/hub-hub-graph.js';

const SITE = 'https://mirai-shigoto.com';

export interface QSlugBindings {
  readonly canonical: string;
  readonly ogImage: string;
  readonly title: string;
  readonly seoDesc: string;
  readonly shortAnswerHtml: string;
  readonly reasoningHtml: string;
  readonly exampleListHtml: string;
  readonly relatedQAs: ReadonlyArray<QAItem>;
  readonly relatedHtml: string;
  readonly crossHubHtml: string;
  readonly jsonLd: string;
}

function renderExampleList(examples: ReadonlyArray<DetailFileMin>): string {
  if (examples.length === 0) return '<p>該当例なし</p>';
  const items = examples.map((d) => {
    const name = d.title?.ja ?? `#${d.id}`;
    const ai = d.ai_risk?.score;
    const aiStr = ai === null || ai === undefined ? '—' : `${ai}/10`;
    const band = ai === null || ai === undefined ? 'mid' : ai <= 3 ? 'low' : ai <= 6 ? 'mid' : 'high';
    const sec = d.sector?.ja ?? '';
    const salary = d.stats?.salary_man_yen;
    return `<li><div class="rl-main"><a class="rl-name" href="/${d.id}">${escapeHtml(name)}</a>` +
      (sec ? `<span class="rl-sector">${escapeHtml(sec)}</span>` : '') +
      `</div><div class="rl-stats"><span class="risk-pill ${band}">${aiStr}</span>` +
      (salary ? `<span class="rl-salary">${Math.trunc(salary)}万円</span>` : '') +
      `</div></li>`;
  }).join('');
  return '<ol class="rank-list">' + items + '</ol>';
}

function renderRelatedQAs(related: ReadonlyArray<QAItem>): string {
  return '<ul class="related-genre">' + related.map((r) =>
    `<li><a href="/q/${r.slug}"><span class="rg-name">${escapeHtml(r.question)}</span>` +
    `<span class="rg-desc">${escapeHtml(r.short_answer.slice(0, 60))}…</span></a></li>`,
  ).join('') + '</ul>';
}

function renderJsonLd(canonical: string, qa: QAItem, seoDesc: string): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: qa.question, description: seoDesc, inLanguage: 'ja' },
      {
        '@type': 'QAPage',
        '@id': `${canonical}#qa`,
        breadcrumb: { '@id': `${canonical}#breadcrumb` },
        mainEntity: {
          '@type': 'Question',
          name: qa.question,
          text: qa.question,
          acceptedAnswer: { '@type': 'Answer', text: qa.short_answer + ' ' + qa.reasoning },
        },
      },
      // BreadcrumbList carries an `@id` so the QAPage above can reference it
      // via `breadcrumb: { '@id': ... }` — without that pair, schema.org
      // linked-data processors can't connect the two nodes and Google's
      // breadcrumb SERP enrichment is silently dropped (other page families
      // (occupation, ranking) already do this correctly).
      { '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`, itemListElement: [
        { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: '質問で探す', item: `${SITE}/q` },
        { '@type': 'ListItem', position: 3, name: qa.question, item: canonical },
      ] },
    ],
  }, null, 2);
}

export function buildQSlugBindings(
  qa: QAItem,
  examples: ReadonlyArray<DetailFileMin>,
  graph: KnowledgeGraph,
): QSlugBindings {
  const canonical = `${SITE}/q/${qa.slug}`;
  const ogImage = `${SITE}/api/og?q=${qa.slug}`;
  const title = `${qa.question}｜独自分析で回答【2026 年版】 | 未来の仕事`;
  const seoDesc = qa.short_answer;
  const linkRegistry = buildLinkRegistry(graph);
  const shortAnswerHtml = inlineLinkText(qa.short_answer, linkRegistry, { maxLinks: 4 });
  const reasoningHtml = inlineLinkText(qa.reasoning, linkRegistry, { maxLinks: 6 });
  const exampleListHtml = renderExampleList(examples);
  const relatedQAs = QA_ITEMS.filter((other) => qa.related_topics.includes(other.slug)).slice(0, 5);
  const relatedHtml = renderRelatedQAs(relatedQAs);
  const crossHubHtml = renderRelatedHubsBlock('q', qa.slug, 6);
  const jsonLd = renderJsonLd(canonical, qa, seoDesc);
  return {
    canonical, ogImage, title, seoDesc,
    shortAnswerHtml, reasoningHtml, exampleListHtml,
    relatedQAs, relatedHtml, crossHubHtml, jsonLd,
  };
}
