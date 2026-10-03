/**
 * View model for /models/<run-slug>. The Astro page loads the projection
 * and calls this. Pure: no filesystem access.
 */
import type { ModelsByModelProjectionShape } from '@/lib/projection-schemas';
import { siteConfig } from '@/site/config';
import { formatModelDisplay, runFromSlug, type ScoreRunRef } from '@/site/score-attribution';
import { formatEvaluationStandard, formatJapaneseDate, formatProviderDisplay } from './models.js';

export type ModelRunRecord = ModelsByModelProjectionShape['models'][string];

export function bandLabel(band: 'low' | 'mid' | 'high'): string {
  if (band === 'low') return '低';
  if (band === 'mid') return '中';
  return '高';
}

export function scoreText(value: number): string {
  return value.toFixed(1);
}

export function signedScore(value: number): string {
  if (value > 0) return `+${value.toFixed(1)}`;
  return value.toFixed(1);
}

export interface ModelRunPageView {
  readonly modelDisplay: string;
  readonly providerDisplay: string;
  readonly scoringDate: string;
  readonly standardDisplay: string;
  readonly prevModelDisplay: string | null;
  readonly nextModelDisplay: string | null;
  readonly isBaseline: boolean;
  readonly isLegacyBatch: boolean;
  readonly comparisonDescription: string;
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly canonical: string;
  readonly inlinePayload: string;
  readonly driftSummary: string;
  readonly jsonLd: string;
  readonly localCss: string;
  readonly histogramWidth: number;
  readonly histogramHeight: number;
  readonly chartTop: number;
  readonly chartLeft: number;
  readonly plotWidth: number;
  readonly plotHeight: number;
  readonly maxBin: number;
  readonly barGap: number;
  readonly barWidth: number;
}

export function buildModelRunPageModel(
  page: ModelRunRecord,
  navRuns: readonly ScoreRunRef[],
): ModelRunPageView {
  const modelDisplay = formatModelDisplay(page.model);
  const providerDisplay = formatProviderDisplay(page.provider);
  const scoringDate = formatJapaneseDate(page.date);
  const standardDisplay = formatEvaluationStandard(page.prompt_version);
  // nav targets are run slugs, so resolve them as runs. The stored display name
  // is the fallback when a neighbouring batch is not in the known set.
  const navDisplay = (target: { slug: string; modelDisplay: string } | null): string | null => {
    if (target === null) return null;
    const run = runFromSlug(target.slug, navRuns);
    return run ? formatModelDisplay(run.model) : target.modelDisplay;
  };
  const prevModelDisplay = navDisplay(page.nav.prev);
  const nextModelDisplay = navDisplay(page.nav.next);
  const drift = page.drift;
  const isBaseline = 'baseline' in drift;
  const isLegacyBatch = 'baseline' in drift && drift.note_id === 'legacy_batch';
  const isBackfillBatch = 'baseline' in drift && drift.note_id === 'backfill_batch';

  const pageTitle = `${modelDisplay} の職業スコア | モデル比較 | 未来の仕事`;
  const comparisonDescription = isLegacyBatch
    ? '旧方式スコアとして公開し、AIOIS-10モデル間比較の対象には含めません。'
    : isBackfillBatch
      ? '補完採点として履歴に公開し、前回モデルとの変化は掲載していません。'
      : isBaseline
        ? 'AIOIS-10系列の最初の基準点で、比較可能な前回モデルはありません。'
        : `前回の${formatModelDisplay(drift.predecessor.model)}との変化も掲載しています。`;
  const pageDescription =
    `${modelDisplay}（${scoringDate}）が採点した日本の職業${page.covered_count}件のAI影響度分布と上位・下位職業。${comparisonDescription}`;
  const canonical = `${siteConfig.origin}/models/${page.slug}`;
  const inlinePayload = JSON.stringify(page)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  const histogramWidth = 720;
  const histogramHeight = 260;
  const chartTop = 26;
  const chartLeft = 34;
  const chartRight = 16;
  const chartBottom = 42;
  const plotWidth = histogramWidth - chartLeft - chartRight;
  const plotHeight = histogramHeight - chartTop - chartBottom;
  const maxBin = Math.max(1, ...page.distribution.histogram.map((bin) => bin.count));
  const barGap = 3;
  const barWidth = plotWidth / page.distribution.histogram.length - barGap;

  const driftSummary = isLegacyBatch
    ? `${modelDisplay} は AIOIS-10 導入前の旧方式スコアです。記録として公開していますが、D1〜D10 や置換指数を補完せず、AIOIS-10 モデル間比較の対象には含めません。`
    : isBackfillBatch
      ? `${modelDisplay} は、公開後に日をあけて補完した採点です。公開値と「最新のAI」の行には含めず、履歴として公開しています。前回モデルとの変化は掲載していません。`
      : isBaseline
        ? `${modelDisplay} は AIOIS-10 系列で最初の採点です。比較可能な前回モデルがないため、以後の変化を見るための基準点として扱います。`
        : `${modelDisplay} は ${formatModelDisplay(drift.predecessor.model)}（${formatJapaneseDate(drift.predecessor.date)}）と比べて、平均変化指数が ${signedScore(drift.mean_delta_t)} ポイント動きました。共通して比較できた職業は ${drift.compared_count} 件です。`;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        name: pageTitle,
        url: canonical,
        description: pageDescription,
        inLanguage: 'ja',
        isPartOf: { '@id': `${siteConfig.origin}/#website` },
        datePublished: page.date,
        dateModified: page.date,
        breadcrumb: { '@id': `${canonical}#breadcrumb` },
      },
      {
        '@type': 'Dataset',
        '@id': `${canonical}#dataset`,
        name: `${modelDisplay} の職業スコア`,
        description: pageDescription,
        inLanguage: 'ja',
        isPartOf: { '@id': `${canonical}#webpage` },
        dateModified: page.date,
        temporalCoverage: page.date,
        creator: { '@type': 'Organization', name: siteConfig.siteName },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${siteConfig.origin}/` },
          { '@type': 'ListItem', position: 2, name: 'モデル比較', item: `${siteConfig.origin}/models` },
          { '@type': 'ListItem', position: 3, name: modelDisplay, item: canonical },
        ],
      },
    ],
  });

  return {
    modelDisplay,
    providerDisplay,
    scoringDate,
    standardDisplay,
    prevModelDisplay,
    nextModelDisplay,
    isBaseline,
    isLegacyBatch,
    comparisonDescription,
    pageTitle,
    pageDescription,
    canonical,
    inlinePayload,
    driftSummary,
    jsonLd,
    localCss: MODEL_RUN_PAGE_CSS,
    histogramWidth,
    histogramHeight,
    chartTop,
    chartLeft,
    plotWidth,
    plotHeight,
    maxBin,
    barGap,
    barWidth,
  };
}

export const MODEL_RUN_PAGE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{font-size:16px}
html body.models-surface{margin:0;background:var(--bg);color:var(--fg);font-family:var(--font-sans);line-height:1.75;line-break:strict}
a{color:var(--accent-deep);text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
a:hover{color:var(--orange-hot)}
#wrapper{max-width:var(--content-max);margin:0 auto;padding:32px var(--gutter) 80px}
.crumb{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 26px;color:var(--ink-meta);font-size:var(--t-sm);line-height:1.5;overflow-wrap:anywhere}
.crumb a{color:var(--ink-meta);text-decoration:none}
.crumb a:hover{color:var(--orange-hot);text-decoration:underline}
.crumb span[aria-hidden]{color:var(--fg3)}
.model-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,340px);gap:28px;align-items:end;padding:18px 0 30px;border-bottom:1px solid var(--border)}
.eyebrow{margin:0 0 12px;color:var(--accent-deep);font-weight:700;font-size:var(--t-xs)}
h1{margin:0;letter-spacing:0;color:var(--fg);overflow-wrap:break-word;word-break:normal}
.lead{max-width:720px;margin:18px 0 0;color:var(--fg2);font-size:var(--t-h3);line-height:1.9;overflow-wrap:break-word;word-break:normal}
.profile-box{border:1px solid var(--border);border-radius:8px;background:var(--bg2);padding:18px}
.profile-box dl{display:grid;grid-template-columns:104px 1fr;gap:10px 14px;margin:0}
.profile-box dt{color:var(--ink-meta);font-size:var(--t-sm);font-weight:600;}
.profile-box dd{margin:0;font-weight:700;overflow-wrap:break-word;word-break:normal}
.profile-links{margin:16px 0 0;display:flex;flex-wrap:wrap;gap:10px}
.profile-links a,.nav-links a,.back-link{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:1px solid var(--border);border-radius:6px;padding:0 12px;background:var(--bg);font-weight:700;text-decoration:none;color:var(--fg)}
.profile-links a:hover,.nav-links a:hover,.back-link:hover{border-color:var(--accent);color:var(--orange-hot)}
.section{padding:38px 0;border-bottom:1px solid var(--border)}
.section h2{margin:0 0 16px;color:var(--fg);letter-spacing:0;overflow-wrap:break-word;word-break:normal}
.section-intro{max-width:760px;margin:0 0 22px;color:var(--fg2);line-height:1.9;overflow-wrap:break-word;word-break:normal}
.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 24px}
.stat{border:1px solid var(--border);border-radius:8px;background:var(--bg2);padding:14px;min-width:0}
.stat dt{margin:0 0 6px;color:var(--ink-meta);font-size:var(--t-xs);font-weight:600;}
.stat dd{margin:0;font-family:var(--font-serif);font-size:var(--t-h2);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;color:var(--ink);}
.histogram-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg2);padding:12px}
.histogram-wrap:focus-visible{outline:2px solid var(--orange-hot);outline-offset:2px}
.histogram{display:block;min-width:680px;width:100%;height:auto}
.histogram text{font-family:var(--font-sans);fill:var(--fg2);font-size:var(--t-xs)}
.histogram .axis{stroke:var(--border)}
.histogram .bar{fill:var(--accent)}
.fallback{margin:14px 0 0;color:var(--fg2);font-size:var(--t-sm)}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.rank-card{border:1px solid var(--border);border-radius:8px;background:var(--bg2);padding:18px}
.rank-card h3{margin:0 0 12px}
.rank-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.rank-list li{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(92,82,60,.16)}
.rank-list li:last-child{border-bottom:0}
.rank-no{color:var(--ink-meta);font-variant-numeric:tabular-nums;font-weight:700;text-align:right}
.rank-title{font-weight:700;min-width:0;overflow-wrap:anywhere;text-decoration:none;color:var(--fg)}
.rank-title:hover{color:var(--orange-hot);text-decoration:underline}
.score-pill,.band-pill{display:inline-flex;align-items:center;justify-content:center;min-height:26px;border-radius:999px;padding:0 10px;font-size:var(--t-xs);font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.score-pill{background:var(--bg);border:1px solid var(--border);color:var(--fg)}
.band-pill.low{background:var(--risk-pill-low-bg);color:var(--risk-pill-low-fg)}
.band-pill.mid{background:var(--risk-pill-mid-bg);color:var(--risk-pill-mid-fg)}
.band-pill.high{background:var(--risk-pill-high-bg);color:var(--risk-pill-high-fg)}
.drift-panel{border:1px solid var(--border);border-radius:8px;background:var(--bg2);padding:20px}
.drift-panel p{margin:0;color:var(--fg2);line-height:1.9}
.drift-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}
.mini-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.mini-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:baseline;border-bottom:1px solid rgba(92,82,60,.16);padding:8px 0}
.mini-list li:last-child{border-bottom:0}
.mini-list a{font-weight:700;color:var(--fg);overflow-wrap:anywhere}
.delta{font-weight:700;font-variant-numeric:tabular-nums;color:var(--accent-deep)}
.nav-links{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
template{display:none}
@media(max-width:860px){
  .model-hero,.two-col,.drift-grid{grid-template-columns:1fr}
  .stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:560px){
  #wrapper{padding:22px var(--gutter) 64px}
  .profile-box dl{grid-template-columns:1fr}
  .stats-grid{grid-template-columns:1fr}
  .rank-list li{grid-template-columns:24px minmax(0,1fr);align-items:start}
  .rank-list .score-pill{grid-column:2}
}
`;
