/**
 * skills-hub.ts — スキル別 hub のデータユーティリティ。
 *
 *   - loadSkillRanking(ipd_key): public/data.skills/<key>.json を読む
 *   - loadTreemapMap(): public/data.treemap.json (ai_risk + sector + stats)
 *   - buildSkillsBundle(): 全 10 hub の result + index 用 cards
 *
 * Naming note: ファイル名が `skills-hub.ts` なのは `skills.ts` (将来の builder)
 * との衝突を避けるため。実体は hub レンダリング専用。
 */
// fs reads are now via strict-load helpers (see below); no direct fs imports needed.
import { join } from 'node:path';
import { SKILL_META, type SkillSlug, type SkillMeta } from '../../views/skills-meta.js';

const REPO_ROOT = process.cwd();
const SKILLS_DIR = join(REPO_ROOT, 'public', 'data.skills');
const TREEMAP_PATH = join(REPO_ROOT, 'public', 'data.treemap.json');

const TOP_N = 30;

// ─── Public types ─────────────────────────────────────────────

export interface SkillOccupation {
  id: number;
  name_ja: string;
  /** スキル score 0-5 (IPD original) */
  skill_score: number;
  ai_risk: number | null;
  risk_band: string | null;
  workers: number | null;
  salary: number | null;
  sector_id: string;
  sector_ja: string;
}

export interface SkillResult {
  meta: SkillMeta;
  items: SkillOccupation[];
  /** d.l.stats 用 */
  stats: ReadonlyArray<readonly [label: string, value: string]>;
  /** TOP 内のセクター内訳 (top 5) */
  sectorBreakdown: ReadonlyArray<readonly [sector: string, count: number]>;
  /** ハイライト箇条書き */
  highlights: ReadonlyArray<string>;
  /** FAQ 4 個 */
  faqItems: ReadonlyArray<readonly [q: string, a: string]>;
}

export interface SkillsBundle {
  results: Map<SkillSlug, SkillResult>;
  hub: {
    cards: Array<{
      slug: SkillSlug;
      short_ja: string;
      title_ja: string;
      description_ja: string;
      top_count: number;
      top_preview: string;
    }>;
  };
}

// ─── Loaders ──────────────────────────────────────────────────

import { strictReadJson } from '../../lib/strict-load.js';
import {
  SkillRankingFileSchema,
  TreemapFileSummarySchema,
  type SkillRankingFileShape,
  type TreemapRecordSummary,
} from '../../lib/projection-schemas.js';

type SkillRankingFile = SkillRankingFileShape;
type TreemapRecord = TreemapRecordSummary;

let _treemapCache: Map<number, TreemapRecord> | null = null;
const _skillCache = new Map<string, SkillRankingFile>();

function loadTreemapMap(): Map<number, TreemapRecord> {
  if (_treemapCache) return _treemapCache;
  const records = strictReadJson(
    TREEMAP_PATH,
    TreemapFileSummarySchema,
    'skills-hub.treemap',
  );
  _treemapCache = new Map(records.map((r) => [r.id, r]));
  return _treemapCache;
}

function loadSkillRanking(ipdKey: string): SkillRankingFile {
  const cached = _skillCache.get(ipdKey);
  if (cached) return cached;
  const path = join(SKILLS_DIR, `${ipdKey}.json`);
  const data = strictReadJson(
    path,
    SkillRankingFileSchema,
    'skills-hub.skill-ranking',
  );
  _skillCache.set(ipdKey, data);
  return data;
}

// ─── Helpers ──────────────────────────────────────────────────

import { fmtInt, safeMean } from '../../lib/num.js';

function buildFaqs(meta: SkillMeta, items: SkillOccupation[]): Array<readonly [string, string]> {
  const faqs: Array<readonly [string, string]> = [];
  const top3Names = items.slice(0, 3).map((o) => o.name_ja).filter(Boolean).join('、');

  faqs.push([
    `${meta.short_ja}が中心となるのはどんな職業？`,
    meta.description_ja,
  ]);

  if (top3Names) {
    faqs.push([
      `${meta.short_ja}スコアが高い職業 TOP 3 は？`,
      `${top3Names} です。本ページでは TOP ${items.length} 職業を AI 影響度・年収・就業者数と共に確認できます。`,
    ]);
  }

  const meanRisk = safeMean(items.map((o) => o.ai_risk));
  if (meanRisk > 0) {
    const tier = meanRisk <= 3.5 ? '低め' : meanRisk <= 5.5 ? '中程度' : 'やや高め';
    faqs.push([
      `${meta.short_ja}が必要な職業は AI に置き換えられる？`,
      `本 hub の TOP ${items.length} の平均 AI 影響度は ${meanRisk.toFixed(1)}/10 で ${tier} の水準です。` +
        `スキル単体の AI 適合度ではなく、職業全体の業務構成で評価されています。` +
        `本サイトの AI 影響度は Claude Opus 4.7 による独自分析（非公式）です。`,
    ]);
  }

  faqs.push([
    `${meta.short_ja}を伸ばすには？`,
    `代表的なトレーニング: ${meta.how_to_train_ja.slice(0, 2).join('。')}。` +
      `本ページの TOP 職業の業務に近づける形で実践を積むのが効果的です。`,
  ]);

  return faqs;
}

// ─── Main builder ─────────────────────────────────────────────

/**
 * Optional loaders for dependency injection — Step 7 of the architecture
 * migration uses these to route skill-hub pages through the knowledge
 * graph instead of reading projection JSON files. Both default to the
 * file-reading legacy paths.
 */
export interface SkillsLoaders {
  skillRanking?: (ipdKey: string) => SkillRankingFile;
  treemap?: () => Map<number, TreemapRecord>;
}

export function buildSkillsBundle(loaders: SkillsLoaders = {}): SkillsBundle {
  const skillRankingLoad = loaders.skillRanking ?? loadSkillRanking;
  const treemapLoad = loaders.treemap ?? loadTreemapMap;
  const treemap = treemapLoad();
  const results = new Map<SkillSlug, SkillResult>();

  for (const meta of SKILL_META) {
    const ranking = skillRankingLoad(meta.ipd_key);
    // ranking.occupations は既に score 降順 (build:data の skills.ts で sort 済)
    const top = ranking.occupations.slice(0, TOP_N);

    const items: SkillOccupation[] = top.map((o) => {
      const tm = treemap.get(o.id);
      return {
        id: o.id,
        name_ja: o.name_ja,
        skill_score: o.score,
        ai_risk: tm?.ai_risk ?? null,
        risk_band: tm?.risk_band ?? null,
        workers: tm?.workers ?? null,
        salary: tm?.salary ?? null,
        sector_id: tm?.sector_id ?? '',
        sector_ja: tm?.sector_ja ?? '',
      };
    });

    // セクター内訳
    const sectorCounts = new Map<string, number>();
    for (const o of items) {
      if (o.sector_ja) sectorCounts.set(o.sector_ja, (sectorCounts.get(o.sector_ja) ?? 0) + 1);
    }
    const sectorBreakdown: Array<readonly [string, number]> = Array.from(sectorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const meanRisk = safeMean(items.map((o) => o.ai_risk));
    const meanSalary = safeMean(items.map((o) => o.salary));
    const meanScore = safeMean(items.map((o) => o.skill_score));
    const totalWorkers = items.reduce((s, o) => s + (o.workers ?? 0), 0);

    const stats: Array<readonly [string, string]> = [
      [`平均 ${meta.short_ja}スコア`, `${meanScore.toFixed(2)} / 5`],
      ['平均 AI 影響', meanRisk > 0 ? `${meanRisk.toFixed(1)} / 10` : '—'],
      ['平均年収', meanSalary > 0 ? `${Math.trunc(meanSalary)} 万円` : '—'],
      ['TOP30 合計就業者数', `${fmtInt(totalWorkers)} 人`],
    ];

    const top3 = items.slice(0, 3).map((o) => o.name_ja).join('、');
    const dominantSector = sectorBreakdown[0]?.[0] ?? '';
    const dominantCount = sectorBreakdown[0]?.[1] ?? 0;

    const highlights: string[] = [
      `1 位は「${items[0]?.name_ja ?? '—'}」（${meta.short_ja}スコア ${items[0]?.skill_score.toFixed(2) ?? '—'}）`,
      top3 ? `TOP 3 は ${top3}` : '',
      dominantSector ? `セクターは「${dominantSector}」が ${dominantCount} 件と最多` : '',
      meanRisk > 0 ? `TOP30 の平均 AI 影響は ${meanRisk.toFixed(1)}/10` : '',
      meta.use_cases_ja.length ? `典型的な活躍場面: ${meta.use_cases_ja[0]}` : '',
    ].filter(Boolean);

    const faqItems = buildFaqs(meta, items);

    results.set(meta.slug, {
      meta,
      items,
      stats,
      sectorBreakdown,
      highlights,
      faqItems,
    });
  }

  const cards = SKILL_META.map((meta) => {
    const r = results.get(meta.slug)!;
    const top1 = r.items[0]?.name_ja ?? '';
    return {
      slug: meta.slug,
      short_ja: meta.short_ja,
      title_ja: meta.title_ja,
      description_ja: meta.description_ja,
      top_count: r.items.length,
      top_preview: top1 ? `1位 ${top1}（${meta.short_ja}スコア ${r.items[0]!.skill_score.toFixed(2)}）` : '',
    };
  });

  return { results, hub: { cards } };
}

// ─── HTML rendering helpers ────────────────────────────────────

// Single source of truth lives at src/lib/safe-html.ts.
import { escapeHtml } from '../../lib/safe-html.js';
export { escapeHtml };

// Single source of truth lives at src/lib/risk.
import { riskClass } from '../../lib/risk.js';

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

// Shared Highlights + SectorChart templates — single source of truth.
export { renderHighlights } from '../../templates/Highlights.js';
export { renderSectorChart } from '../../templates/SectorChart.js';

// Shared FAQ template — single source of truth in src/templates/FaqSection.
export { renderFaqSection as renderFaqHtml } from '../../templates/FaqSection.js';

export function renderRelatedSkills(currentSlug: SkillSlug): string {
  const items = SKILL_META
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
