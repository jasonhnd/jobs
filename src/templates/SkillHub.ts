/**
 * src/templates/SkillHub.ts — HTML / JSON-LD / CSS for the 10 /ja/skills/[skill]
 * hub pages + /ja/skills index.
 *
 * Extracted from src/views/skills-hub.ts on 2026-05-14 (Phase D #2 per
 * docs/architecture.md §8 row 8 "data is view, HTML is template").
 *
 * Templates layer rule (per scripts/check-architecture.cjs): no view-value
 * imports allowed. The previous `renderRelatedSkills` reached into the
 * SKILL_META constant from src/views/skills-meta — this template instead
 * takes the meta list as a function parameter, so the call-site (page)
 * passes it explicitly. Same output byte-for-byte; just different
 * data-flow direction (templates can no longer pull from views).
 */
import type { SkillSlug, SkillMeta } from '../views/skills-meta.js';
import type { SkillOccupation } from '../views/skills-hub.js';
import { escapeHtml } from '../lib/safe-html.js';
import { riskClass } from '../lib/risk.js';
import { fmtInt } from '../lib/num.js';

// Re-export escapeHtml so pages can import it from the template entrypoint.
export { escapeHtml };

// Shared sub-templates already live under src/templates/. Re-export so the
// import-from-template path is one stop for skill-hub pages.
export { renderHighlights } from './Highlights.js';
export { renderSectorChart } from './SectorChart.js';
export { renderFaqSection as renderFaqHtml } from './FaqSection.js';

export function renderSkillItem(o: SkillOccupation, shortJa: string): string {
  const title = o.name_ja || `#${o.id}`;
  const score = o.ai_risk;
  const scoreStr = score === null ? '—' : `${score}/10`;
  const band = riskClass(score);
  const sector = o.sector_ja || '';
  const salary = o.salary;
  const workers = o.workers;

  const stats: string[] = [
    `<span class="skill-score">${escapeHtml(shortJa)} ${o.skill_score.toFixed(2)}</span>`,
    `<span class="risk-pill ${band}">${escapeHtml(scoreStr)}</span>`,
  ];
  if (salary) stats.push(`<span class="rl-salary">${Math.trunc(salary)}万円</span>`);
  if (workers) stats.push(`<span class="rl-workers">${fmtInt(workers)}人</span>`);

  const sectorHtml = sector ? `<span class="rl-sector">${escapeHtml(sector)}</span>` : '';
  return (
    `<li>` +
    `<div class="rl-main">` +
    `<a class="rl-name" href="/ja/${o.id}">${escapeHtml(title)}</a>` +
    `${sectorHtml}` +
    `</div>` +
    `<div class="rl-stats">${stats.join('')}</div>` +
    `</li>`
  );
}

/**
 * Phase D #2 (2026-05-14) signature change: `allMeta` now passed in by
 * caller (the [skill].astro page). Previous version read SKILL_META
 * from view layer; templates cannot import view values.
 */
export function renderRelatedSkills(
  currentSlug: SkillSlug,
  allMeta: ReadonlyArray<SkillMeta>,
): string {
  const items = allMeta
    .filter((m) => m.slug !== currentSlug)
    .map(
      (m) =>
        `<li><a href="/ja/skills/${m.slug}">` +
        `<span class="rs-name">${escapeHtml(m.short_ja)}</span>` +
        `<span class="rs-desc">${escapeHtml(m.description_ja.slice(0, 60))}…</span>` +
        `</a></li>`,
    )
    .join('');
  return `<ul class="related-skills">${items}</ul>`;
}

// ─── JSON-LD ──────────────────────────────────────────────────

const SITE = 'https://mirai-shigoto.com';
const DATE_PUBLISHED = '2026-05-09';
const DATE_MODIFIED = '2026-05-09';

export function renderJsonLd(
  canonical: string,
  meta: SkillMeta,
  items: SkillOccupation[],
  description: string,
  faqItems: ReadonlyArray<readonly [string, string]> | null,
): string {
  const itemList = items.map((o, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE}/ja/${o.id}`,
    name: o.name_ja || `#${o.id}`,
  }));

  const graph: unknown[] = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: meta.title_ja,
      description,
      isPartOf: { '@id': `${SITE}/#website` },
      inLanguage: 'ja',
      datePublished: DATE_PUBLISHED,
      dateModified: DATE_MODIFIED,
      publisher: { '@id': `${SITE}/#organization` },
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
    },
    {
      '@type': 'CollectionPage',
      '@id': `${canonical}#collection`,
      name: meta.title_ja,
      description,
      url: canonical,
      inLanguage: 'ja',
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'スキルから探す', item: `${SITE}/ja/skills` },
        { '@type': 'ListItem', position: 3, name: meta.title_ja, item: canonical },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': `${canonical}#list`,
      name: meta.title_ja,
      numberOfItems: itemList.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: itemList,
    },
  ];

  if (faqItems && faqItems.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: faqItems.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

export function renderHubJsonLd(): string {
  const canonical = `${SITE}/ja/skills`;
  const seoDesc =
    'IPD 39 スキル軸から reader value の高い 10 を選んだスキル別 hub 群。' +
    '各スキルが核となる職業 TOP 30 を AI 影響度・年収と共に一覧。';
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${canonical}#webpage`,
          url: canonical,
          name: 'スキルから探す',
          description: seoDesc,
          isPartOf: { '@id': `${SITE}/#website` },
          inLanguage: 'ja',
          datePublished: DATE_PUBLISHED,
          dateModified: DATE_MODIFIED,
          publisher: { '@id': `${SITE}/#organization` },
          breadcrumb: { '@id': `${canonical}#breadcrumb` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${canonical}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
            { '@type': 'ListItem', position: 2, name: 'スキルから探す', item: canonical },
          ],
        },
      ],
    },
    null,
    2,
  );
}
