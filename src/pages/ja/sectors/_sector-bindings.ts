/**
 * src/pages/ja/sectors/_sector-bindings.ts — single-entry binding
 * builder for /ja/sectors/[sector].
 *
 * Consolidates ~180 lines of `const x = …` declarations that
 * lived in [sector].astro's frontmatter: data prep (sort,
 * filter, slice), SEO + OG meta, headings, FAQ build, JSON-LD
 * build, section HTML for the 7 page sections, and the
 * keywords/sub-text micro-derivations.
 *
 * The page calls buildSectorBindings once and destructures the
 * result. Sister of src/pages/ja/_id-bindings.ts.
 *
 * Page-local sibling (Astro `_`-prefix → not routed).
 */

import { escapeHtml } from '@/lib/safe-html';
import { fmtInt } from '@/lib/num';
import {
  computeSectorPatterns,
  computeSiteBaseline,
  getSectorEssay,
  type SectorOcc,
} from '../../../data/lib/sector-meta';
import {
  buildLinkRegistry,
  inlineLinkText,
} from '../../../data/lib/inline-links';
import { renderRelatedHubsBlock } from '../../../data/lib/hub-hub-graph';
import { buildSectorFaqs } from '@/data/lib/sector-faqs';
import { renderSectorJsonLd } from '@/templates/SectorJsonLd';
import { renderOccFaq } from '@/templates/OccFaq';
import {
  renderSectorOccupationTopList,
  renderSectorOccupationFullList,
  renderRelatedSectorsList,
} from '@/templates/SectorListings';
import { renderSectorPatterns } from '@/templates/SectorPatterns';
import type {
  SectorOccupationSummary,
  SectorDetailView,
} from '@/views/sector';

const SITE_ORIGIN = 'https://mirai-shigoto.com';
const TOP_N = 5;

export interface SectorBindingsInput {
  readonly view: SectorDetailView;
  readonly datePublished: string;
  readonly dateModified: string;
}

export interface SectorBindings {
  // Identity / paths
  readonly sid: string;
  readonly nameLoc: string;
  readonly canonical: string;
  readonly ogImage: string;
  // Counts / derived stats
  readonly n: number;
  readonly workforceTotal: number;
  readonly meanRisk: number | null;
  // SEO + OG
  readonly title: string;
  readonly ogTitle: string;
  readonly seoDesc: string;
  readonly keywordsStr: string;
  // Section headings (h1, h2s, breadcrumb labels)
  readonly h1Main: string;
  readonly subText: string;
  readonly skipLabel: string;
  readonly crumbRoot: string;
  readonly crumbSectors: string;
  readonly hHigh: string;
  readonly hLow: string;
  readonly hPop: string;
  readonly hFull: string;
  readonly hRelated: string;
  // Pre-rendered section HTML
  readonly topHighHtml: string;
  readonly topLowHtml: string;
  readonly topWorkersHtml: string;
  readonly fullListHtml: string;
  readonly relatedHtml: string;
  readonly faqHtml: string;
  readonly introSection: string;
  readonly aiEraEssayHtml: string;
  readonly patternsHtml: string;
  readonly crossHubHtml: string;
  // Schema.org JSON-LD payload
  readonly jsonLd: string;
}

function toSectorOcc(o: SectorOccupationSummary): SectorOcc {
  return {
    id: o.id as unknown as number,
    title_ja: o.titleJa,
    ai_risk: o.aiRisk,
    workers: o.workers,
    salary: o.salary,
    monthly_hours: o.monthlyHours,
    average_age: o.averageAge,
    recruit_ratio: o.recruitRatio,
  };
}

function toListOcc(o: SectorOccupationSummary) {
  return {
    id: o.id as unknown as number,
    titleJa: o.titleJa,
    aiRisk: o.aiRisk,
    workers: o.workers,
  };
}

export function buildSectorBindings(input: SectorBindingsInput): SectorBindings {
  const { view, datePublished, dateModified } = input;
  const sector = view.sector;
  const occs = view.occupations;
  const allOccs = view.allOccupations;
  const relatedSectors = view.relatedSectors;

  // ── Phase 2 derivations: AI era essay + auto-pattern observations ──
  const sectorEssay = getSectorEssay(sector.id as unknown as string);
  const allSectorOccs: SectorOcc[] = allOccs.map(toSectorOcc);
  const baseline = computeSiteBaseline(allSectorOccs);
  const sectorOccsForPattern: SectorOcc[] = occs.map(toSectorOcc);
  const patterns = computeSectorPatterns(sectorOccsForPattern, baseline, sector.nameJa);

  // ── Identity + path consts ──
  const sid = sector.id as unknown as string;
  const nameLoc = sector.nameJa;
  const descIntro = sector.descriptionJa ?? '';
  const canonical = `${SITE_ORIGIN}/ja/sectors/${sid}`;
  const ogImage = `${SITE_ORIGIN}/api/og?sector=${sid}`;
  const n = occs.length;

  // ── Stat aggregates ──
  const workforceTotal = occs.reduce((s, o) => s + (o.workers || 0), 0);
  const risks = occs.map((o) => o.aiRisk).filter((x): x is number => x !== null && x !== undefined);
  const meanRisk: number | null = risks.length ? risks.reduce((a, b) => a + b, 0) / risks.length : null;

  // ── Sort/slice variants used by SEO + listings + JSON-LD ──
  const sortedByWorkers = [...occs].sort((a, b) => {
    const wb = b.workers || 0;
    const wa = a.workers || 0;
    if (wb !== wa) return wb - wa;
    return (a.id as unknown as number) - (b.id as unknown as number);
  });
  const sampleTitles: string[] = [];
  for (const o of sortedByWorkers.slice(0, 3)) {
    if (o.titleJa) sampleTitles.push(o.titleJa);
  }
  const samplesStr = sampleTitles.join(' / ');

  const occsWithRisk = occs.filter((o) => o.aiRisk !== null && o.aiRisk !== undefined);
  const sortedByRiskDesc = [...occsWithRisk].sort((a, b) => (b.aiRisk as number) - (a.aiRisk as number));
  const topHigh = sortedByRiskDesc.slice(0, TOP_N);
  const topLow = [...sortedByRiskDesc].reverse().slice(0, TOP_N);
  const topWorkers = occs
    .filter((o) => o.workers)
    .sort((a, b) => (b.workers as number) - (a.workers as number))
    .slice(0, TOP_N);
  const fullSorted = [...occs].sort((a, b) => {
    const ar = -(a.aiRisk ?? -1);
    const br = -(b.aiRisk ?? -1);
    if (ar !== br) return ar - br;
    return (a.id as unknown as number) - (b.id as unknown as number);
  });

  // ── SEO + OG meta ──
  const title = `${nameLoc}の職業一覧 — ${n}職業｜AI 影響度ランキング・年収・就業者数 | 未来の仕事`;
  const ogTitle = `${nameLoc}の職業一覧 — ${n}職業｜AI 影響度ランキング`;
  const seoDesc =
    `${nameLoc} 業界の${n}職業をAI影響度・年収・就業者数で一覧。` +
    `代表職業：${samplesStr}。Claude Opus 4.7 による独自分析（非公式）。`;
  const keywordsList: string[] = [nameLoc, ...sampleTitles];
  keywordsList.push(`${nameLoc} 仕事`, `${nameLoc} 職業`, `${nameLoc} AI 影響`);
  const keywordsStr = keywordsList.join(', ');

  // ── Section headings ──
  const crumbRoot = '未来の仕事';
  const crumbSectors = 'セクター';
  const skipLabel = '本文へスキップ';
  const h1Main = `${nameLoc}の職業`;
  const subText =
    `<strong>${n} 職業</strong>` +
    (meanRisk !== null ? ` · 平均 AI 影響 <strong>${meanRisk.toFixed(1)}/10</strong>` : '') +
    ` · 就業者数 計 <strong>${fmtInt(workforceTotal)}</strong> 人`;
  const hHigh = `${nameLoc} の AI 影響 が高い職業 TOP 5`;
  const hLow = `${nameLoc} の AI 影響 が低い職業 TOP 5`;
  const hPop = `${nameLoc} の 就業者数 TOP 5`;
  const hFull = `${nameLoc} の全 ${n} 職業（AI 影響度 高い順）`;
  const hRelated = '他のセクター';

  // ── FAQ data + JSON-LD ──
  const faqs = buildSectorFaqs({
    nameJa: nameLoc,
    occupationCount: n,
    workforceTotal,
    meanRisk,
    topWorkers: topWorkers.map((o) => ({ titleJa: o.titleJa, aiRisk: o.aiRisk })),
    topHigh: topHigh.map((o) => ({ titleJa: o.titleJa, aiRisk: o.aiRisk })),
    topLow: topLow.map((o) => ({ titleJa: o.titleJa, aiRisk: o.aiRisk })),
  });
  const jsonLd = renderSectorJsonLd({
    canonical,
    nameJa: nameLoc,
    sectorId: sid,
    siteOrigin: SITE_ORIGIN,
    occupationCount: n,
    occupations: fullSorted.map((o) => ({
      id: o.id as unknown as number,
      titleJa: o.titleJa,
    })),
    faqs,
    breadcrumbRoot: crumbRoot,
    breadcrumbSectors: crumbSectors,
    datePublished,
    dateModified,
  });

  // ── Pre-rendered list HTML ──
  const topHighHtml = renderSectorOccupationTopList(topHigh.map(toListOcc));
  const topLowHtml = renderSectorOccupationTopList(topLow.map(toListOcc));
  const topWorkersHtml = renderSectorOccupationTopList(topWorkers.map(toListOcc));
  const fullListHtml = renderSectorOccupationFullList(fullSorted.map(toListOcc));
  const relatedHtml = renderRelatedSectorsList(
    relatedSectors.map((s) => ({
      id: s.id as unknown as string,
      nameJa: s.ja,
      occupationCount: s.occupationCount,
    })),
  );
  const faqHtml = renderOccFaq(faqs);

  // ── Inline-linked intro + AI era essay ──
  const linkRegistry = buildLinkRegistry();
  const crossHubHtml = renderRelatedHubsBlock('sectors', sid, 6);
  const introInlined = descIntro
    ? inlineLinkText(descIntro, linkRegistry, { maxLinks: 3 })
    : '';
  const introSection = introInlined ? `<p class="intro">${introInlined}</p>` : '';
  const aiEraEssayInlined = sectorEssay
    ? inlineLinkText(sectorEssay.ai_era_essay_ja, linkRegistry, { maxLinks: 5 })
    : '';
  const aiEraEssayHtml = sectorEssay
    ? `<section class="ai-era-essay" aria-label="AI 時代の特性">
       <h2>AI 時代の${escapeHtml(sector.nameJa)}の特性</h2>
       <p>${aiEraEssayInlined}</p>
     </section>`
    : '';

  // ── データから見えるパターン ──
  const patternsHtml = renderSectorPatterns({
    aiLowCount: patterns.ai_low_count,
    aiMidCount: patterns.ai_mid_count,
    aiHighCount: patterns.ai_high_count,
    aiLowPct: patterns.ai_low_pct,
    aiMidPct: patterns.ai_mid_pct,
    aiHighPct: patterns.ai_high_pct,
    observations: patterns.observations,
  });

  return {
    sid,
    nameLoc,
    canonical,
    ogImage,
    n,
    workforceTotal,
    meanRisk,
    title,
    ogTitle,
    seoDesc,
    keywordsStr,
    h1Main,
    subText,
    skipLabel,
    crumbRoot,
    crumbSectors,
    hHigh,
    hLow,
    hPop,
    hFull,
    hRelated,
    topHighHtml,
    topLowHtml,
    topWorkersHtml,
    fullListHtml,
    relatedHtml,
    faqHtml,
    introSection,
    aiEraEssayHtml,
    patternsHtml,
    crossHubHtml,
    jsonLd,
  };
}
