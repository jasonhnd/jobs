/**
 * src/pages/q/_q-bindings.ts — bindings for [q].astro.
 * Phase D audit #7 (2026-05-14): page frontmatter ≤30 lines per doc §2.5.
 */
import type { KnowledgeGraph } from '@/graph';
import {
  buildOccupationSetGeoFactSummary,
  renderAiFactParagraph,
} from '@/lib/ai-fact-summary';
import { loadGeoFacts } from '@/page-data/geo-facts-loader';
import { QA_ITEMS, qaGroup, type QAItem } from '@/views/qa-meta.js';
import type { DetailFileMin } from '@/views/genre-hub.js';
import { escapeHtml } from '@/templates/Hub.js';
import { buildLinkRegistry, inlineLinkText } from '@/views/inline-links.js';
import { renderRelatedHubsBlock } from '@/views/hub-hub-graph.js';
import type { GeoFacts } from '@/site/geo-facts';
import { occupationPath } from '@/lib/urls';
import { riskClass } from '@/lib/risk';
import { safeMean } from '@/lib/num';

const SITE = 'https://mirai-shigoto.com';

export interface QSlugBindings {
  readonly canonical: string;
  readonly ogImage: string;
  readonly title: string;
  readonly seoDesc: string;
  readonly shortAnswerHtml: string;
  readonly reasoningHtml: string;
  readonly aiFactHtml: string;
  readonly answerLineHtml: string;
  readonly exampleListHtml: string;
  readonly relatedQAs: ReadonlyArray<QAItem>;
  readonly relatedHtml: string;
  readonly crossHubHtml: string;
  readonly jsonLd: string;
}

function eyebrowStem(qa: QAItem): string {
  return qa.og_eyebrow.replace(/^Q&A · /, '');
}

function scoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—';
  return `${score}/10`;
}

/**
 * First-screen one-sentence answer (#328 family 1).
 *
 * AI-anxiety groups follow Appendix A (`最も高いのは…平均は…`) when row 1
 * is the set max; low-AI-first lists use `最も低いのは` so the named job
 * matches row 1. Sector / life / aptitude / career groups use the issue
 * condition pattern (`{stem}に当てはまる{N}職。先頭は{名}です。`). Stem is
 * the existing `og_eyebrow` without the `Q&A · ` prefix — no new copy.
 */
export function renderQaAnswerLine(
  qa: QAItem,
  examples: ReadonlyArray<DetailFileMin>,
): string {
  if (examples.length === 0) return '';
  const n = examples.length;
  const top = examples[0]!;
  const name = top.title?.ja ?? `#${top.id}`;
  const nameHtml = `<strong>${escapeHtml(name)}</strong>`;
  const stemHtml = escapeHtml(eyebrowStem(qa));
  const group = qaGroup(qa.slug);
  const isAiGroup = group === 'ai-anxiety' || group === 'ai-anxiety-extra';

  if (!isAiGroup) {
    return `<p class="qa-sum">${stemHtml}に当てはまる${n}職。先頭は${nameHtml}です。</p>`;
  }

  const scores = examples
    .map((d) => d.ai_risk?.score)
    .filter((v): v is number => typeof v === 'number');
  const firstScore = top.ai_risk?.score;
  const meanHtml = scores.length === 0 ? '—' : `${safeMean(scores).toFixed(1)}/10`;
  const scoreHtml = escapeHtml(scoreLabel(firstScore ?? null));
  const max = scores.length > 0 ? Math.max(...scores) : null;
  const min = scores.length > 0 ? Math.min(...scores) : null;
  const isMax = typeof firstScore === 'number' && max !== null && firstScore === max;
  const isMin = typeof firstScore === 'number' && min !== null && firstScore === min;
  const split = max !== null && min !== null && max !== min;

  let lead: string;
  if (isMax && split) {
    lead = `最も高いのは${nameHtml}（${scoreHtml}）`;
  } else if (isMin && split) {
    lead = `最も低いのは${nameHtml}（${scoreHtml}）`;
  } else {
    lead = `先頭は${nameHtml}（${scoreHtml}）`;
  }
  return `<p class="qa-sum">${stemHtml}の${n}職。${lead}、${n}職の平均は${meanHtml}です。</p>`;
}

export function renderExampleList(examples: ReadonlyArray<DetailFileMin>): string {
  if (examples.length === 0) return '<p>該当例なし</p>';
  const items = examples.map((d) => {
    const name = d.title?.ja ?? `#${d.id}`;
    const ai = d.ai_risk?.score;
    const aiStr = ai === null || ai === undefined ? '—' : `${ai}/10`;
    const band = riskClass(ai === null || ai === undefined ? null : ai);
    const sec = d.sector?.ja ?? '';
    const salary = d.stats?.salary_man_yen;
    const metaParts: string[] = [];
    if (sec) metaParts.push(escapeHtml(sec));
    if (salary) metaParts.push(`<span class="rl-salary">${Math.trunc(salary)}万円</span>`);
    const metaHtml = metaParts.length
      ? `<span class="rl-meta">${metaParts.join(' · ')}</span>`
      : '';
    return (
      `<li>` +
      `<a class="rl-row" href="${occupationPath(d.id)}" data-track-event="list_row_click">` +
      `<span class="rl-main">` +
      `<span class="rl-name">${escapeHtml(name)}</span>` +
      `${metaHtml}` +
      `</span>` +
      `<span class="rl-end">` +
      `<span class="risk-pill ${band}">${escapeHtml(aiStr)}</span>` +
      `<span class="rl-chevron" aria-hidden="true">›</span>` +
      `</span>` +
      `</a>` +
      `</li>`
    );
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
      { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: qa.question, description: seoDesc, inLanguage: 'ja',
        // Voice / AI-answer-engine extraction hint: the 直答 + 根拠 blocks are
        // the quotable answer to this question.
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.ai-fact', '.qa-direct', '.qa-reasoning'] } },
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
  geoFacts: GeoFacts = loadGeoFacts(),
): QSlugBindings {
  const canonical = `${SITE}/q/${qa.slug}`;
  const ogImage = `${SITE}/api/og?q=${qa.slug}`;
  const title = `${qa.question}｜独自分析で回答【2026 年版】 | 未来の仕事`;
  const seoDesc = qa.short_answer;
  const linkRegistry = buildLinkRegistry(graph);
  const shortAnswerHtml = inlineLinkText(qa.short_answer, linkRegistry, { maxLinks: 4 });
  const reasoningHtml = inlineLinkText(qa.reasoning, linkRegistry, { maxLinks: 6 });
  const aiFactHtml = renderAiFactParagraph(buildOccupationSetGeoFactSummary({
    facts: geoFacts,
    subjectJa: qa.question,
    pageKindJa: 'Q&A',
    occupationIds: examples.map((example) => example.id),
  }));
  const answerLineHtml = renderQaAnswerLine(qa, examples);
  const exampleListHtml = renderExampleList(examples);
  const relatedQAs = QA_ITEMS.filter((other) => qa.related_topics.includes(other.slug)).slice(0, 5);
  const relatedHtml = renderRelatedQAs(relatedQAs);
  const crossHubHtml = renderRelatedHubsBlock('q', qa.slug, 6);
  const jsonLd = renderJsonLd(canonical, qa, seoDesc);
  return {
    canonical, ogImage, title, seoDesc,
    shortAnswerHtml, reasoningHtml, aiFactHtml, answerLineHtml, exampleListHtml,
    relatedQAs, relatedHtml, crossHubHtml, jsonLd,
  };
}
