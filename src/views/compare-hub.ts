/**
 * src/views/compare-hub.ts — 職業比較 hub のデータユーティリティ。
 *
 * 各 compare hub は 2 職業を side-by-side で比較する。
 *
 *   - loadDetail(id): public/data.detail/<padded>.json
 *   - buildComparePair(meta): 2 職業の比較データを揃える
 *   - buildCompareBundle(): 全 12 hub の result + index 用 cards
 *
 * Migrated from src/data/lib/compare-hub.ts 2026-05-14 (Phase B).
 * Lives under src/views/ — note: mixes pure-data (buildCompareBundle)
 * with HTML rendering (multiple render* functions). Phase C polish
 * should extract renderers to src/templates/; for now (Phase B
 * "retire data/lib" scope) kept as one file.
 *
 * `strict-load` resolved 2026-05-14 (Phase C #3) to src/lib/.
 */
// 2026-05-17 R2 fix: fs reads moved to page-data layer.
import { COMPARE_META, type CompareSlug, type CompareMeta } from './compare-meta.js';
import { loadDetailById as _loadDetailFromPageData } from '../page-data/projection-loaders.js';

// ─── Public types ──────────────────────────────────────────────

export interface CompareSide {
  id: number;
  name_ja: string;
  ai_risk: number | null;
  risk_band: string | null;
  rationale_ja: string | null;
  summary_ja: string | null;
  salary: number | null;
  workers: number | null;
  monthly_hours: number | null;
  average_age: number | null;
  recruit_ratio: number | null;
  sector_id: string | null;
  sector_ja: string | null;
  related_certs_ja: ReadonlyArray<string>;
  top_skills: ReadonlyArray<{ key: string; label_ja: string; score: number }>;
}

export interface CompareResult {
  meta: CompareMeta;
  a: CompareSide;
  b: CompareSide;
  /** 比較表の行 (label, a の値, b の値, 差分注釈) */
  rows: ReadonlyArray<{ label: string; a_val: string; b_val: string; note: string }>;
  /** FAQ 4 個 */
  faqItems: ReadonlyArray<readonly [q: string, a: string]>;
}

export interface CompareBundle {
  results: Map<CompareSlug, CompareResult>;
  hub: {
    cards: Array<{
      slug: CompareSlug;
      title_ja: string;
      description_ja: string;
      a_name: string;
      b_name: string;
      a_risk: number | null;
      b_risk: number | null;
    }>;
  };
}

// ─── Loader ────────────────────────────────────────────────────

export interface DetailFile {
  id: number;
  title?: { ja?: string };
  ai_risk?: { score?: number; rationale_ja?: string };
  risk_band?: string;
  description?: { summary_ja?: string };
  stats?: {
    salary_man_yen?: number | null;
    workers?: number | null;
    monthly_hours?: number | null;
    average_age?: number | null;
    recruit_ratio?: number | null;
  };
  sector?: { id?: string; ja?: string };
  related_certs_ja?: string[];
  skills_top10?: Array<{ key: string; label_ja: string; score: number }>;
}

// 2026-05-17 R2 fix: delegate to page-data loader (cache is shared
// with loadAllDetails, so warming one warms the other).
function loadDetail(id: number): DetailFile {
  return _loadDetailFromPageData(id) as unknown as DetailFile;
}

function detailToSide(d: DetailFile): CompareSide {
  return {
    id: d.id,
    name_ja: d.title?.ja ?? `#${d.id}`,
    ai_risk: d.ai_risk?.score ?? null,
    risk_band: d.risk_band ?? null,
    rationale_ja: d.ai_risk?.rationale_ja ?? null,
    summary_ja: d.description?.summary_ja ?? null,
    salary: d.stats?.salary_man_yen ?? null,
    workers: d.stats?.workers ?? null,
    monthly_hours: d.stats?.monthly_hours ?? null,
    average_age: d.stats?.average_age ?? null,
    recruit_ratio: d.stats?.recruit_ratio ?? null,
    sector_id: d.sector?.id ?? null,
    sector_ja: d.sector?.ja ?? null,
    related_certs_ja: d.related_certs_ja ?? [],
    top_skills: (d.skills_top10 ?? []).slice(0, 5),
  };
}

// ─── Helpers ───────────────────────────────────────────────────

import { fmtInt } from '../lib/num.js';

function fmtDiff(a: number | null, b: number | null, suffix = ''): string {
  if (a === null || b === null) return '';
  const diff = a - b;
  if (Math.abs(diff) < 0.01) return '';
  const sign = diff > 0 ? '+' : '';
  return `A は B より ${sign}${diff.toFixed(diff % 1 === 0 ? 0 : 1)}${suffix}`;
}

function buildRows(a: CompareSide, b: CompareSide): CompareResult['rows'] {
  const rows: CompareResult['rows'] = [
    {
      label: 'AI 影響度',
      a_val: a.ai_risk !== null ? `${a.ai_risk}/10` : '—',
      b_val: b.ai_risk !== null ? `${b.ai_risk}/10` : '—',
      note: fmtDiff(a.ai_risk, b.ai_risk),
    },
    {
      label: '年収 (平均)',
      a_val: a.salary !== null ? `${Math.trunc(a.salary)} 万円` : '—',
      b_val: b.salary !== null ? `${Math.trunc(b.salary)} 万円` : '—',
      note: fmtDiff(a.salary, b.salary, ' 万円'),
    },
    {
      label: '就業者数',
      a_val: `${fmtInt(a.workers)} 人`,
      b_val: `${fmtInt(b.workers)} 人`,
      note: '',
    },
    {
      label: '月労働時間',
      a_val: a.monthly_hours !== null ? `${a.monthly_hours} 時間` : '—',
      b_val: b.monthly_hours !== null ? `${b.monthly_hours} 時間` : '—',
      note: fmtDiff(a.monthly_hours, b.monthly_hours, ' 時間'),
    },
    {
      label: '平均年齢',
      a_val: a.average_age !== null ? `${a.average_age.toFixed(1)} 歳` : '—',
      b_val: b.average_age !== null ? `${b.average_age.toFixed(1)} 歳` : '—',
      note: fmtDiff(a.average_age, b.average_age, ' 歳'),
    },
    {
      label: '求人倍率',
      a_val: a.recruit_ratio !== null ? `${a.recruit_ratio.toFixed(2)} 倍` : '—',
      b_val: b.recruit_ratio !== null ? `${b.recruit_ratio.toFixed(2)} 倍` : '—',
      note: fmtDiff(a.recruit_ratio, b.recruit_ratio, ' 倍'),
    },
    {
      label: 'セクター',
      a_val: a.sector_ja || '—',
      b_val: b.sector_ja || '—',
      note: a.sector_id !== b.sector_id ? '異なるセクター' : '',
    },
    {
      label: '関連資格',
      a_val: a.related_certs_ja.length ? a.related_certs_ja.slice(0, 2).join('、') + (a.related_certs_ja.length > 2 ? ' 他' : '') : '—',
      b_val: b.related_certs_ja.length ? b.related_certs_ja.slice(0, 2).join('、') + (b.related_certs_ja.length > 2 ? ' 他' : '') : '—',
      note: '',
    },
  ];
  return rows;
}

function buildFaqs(meta: CompareMeta, a: CompareSide, b: CompareSide): Array<readonly [string, string]> {
  const faqs: Array<readonly [string, string]> = [];

  // Q1: 違いは何か
  faqs.push([
    `${a.name_ja} と ${b.name_ja} の違いは？`,
    meta.description_ja,
  ]);

  // Q2: AI 影響度
  if (a.ai_risk !== null && b.ai_risk !== null) {
    const winner = a.ai_risk < b.ai_risk ? a : b;
    const loser = a.ai_risk < b.ai_risk ? b : a;
    if (a.ai_risk !== b.ai_risk) {
      faqs.push([
        `AI 影響度はどちらが低い？`,
        `${winner.name_ja} (${winner.ai_risk}/10) の方が ${loser.name_ja} (${loser.ai_risk}/10) より AI 影響度が低い傾向です。` +
          `本サイトの AI 影響度は Claude Opus 4.8 による独自分析（非公式）です。`,
      ]);
    } else {
      faqs.push([
        `AI 影響度はどちらが低い？`,
        `両者とも ${a.ai_risk}/10 で同程度の AI 影響度。具体的な業務内容での違いを見る必要があります。`,
      ]);
    }
  }

  // Q3: 年収
  if (a.salary !== null && b.salary !== null) {
    const winner = a.salary > b.salary ? a : b;
    const diff = Math.abs(a.salary - b.salary);
    faqs.push([
      `年収はどちらが高い？`,
      `${winner.name_ja} の方が約 ${Math.trunc(diff)} 万円高い傾向です（${a.name_ja}: ${Math.trunc(a.salary)} 万円、${b.name_ja}: ${Math.trunc(b.salary)} 万円）。` +
        `これは厚労省 jobtag のデータで、勤務先・地域・経験により幅があります。`,
    ]);
  }

  // Q4: 選び方
  faqs.push([
    `どちらを選ぶべき？`,
    `判断ヒント: ${meta.decision_hints_ja.join('。')}。` +
      `本ページの比較表と関連リンクから、それぞれの詳細をご確認ください。`,
  ]);

  return faqs;
}

// ─── Main builder ──────────────────────────────────────────────

/**
 * `loader` lets callers inject a graph-based DetailFile producer instead
 * of the default file-reading `loadDetail()`. Step 6 of the architecture
 * migration uses this to route compare pages through the knowledge graph.
 */
export function buildCompareBundle(
  loader: (id: number) => DetailFile = loadDetail,
): CompareBundle {
  const results = new Map<CompareSlug, CompareResult>();

  for (const meta of COMPARE_META) {
    const detailA = loader(meta.occ_a_id);
    const detailB = loader(meta.occ_b_id);
    const a = detailToSide(detailA);
    const b = detailToSide(detailB);
    const rows = buildRows(a, b);
    const faqItems = buildFaqs(meta, a, b);
    results.set(meta.slug, { meta, a, b, rows, faqItems });
  }

  const cards = COMPARE_META.map((meta) => {
    const r = results.get(meta.slug)!;
    return {
      slug: meta.slug,
      title_ja: meta.title_ja,
      description_ja: meta.description_ja,
      a_name: r.a.name_ja,
      b_name: r.b.name_ja,
      a_risk: r.a.ai_risk,
      b_risk: r.b.ai_risk,
    };
  });

  return { results, hub: { cards } };
}

// ─── HTML rendering helpers ────────────────────────────────────
