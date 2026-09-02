/**
 * interests.ts — RIASEC 興味タイプ hub のデータユーティリティ。
 *
 *   - loadHollandRows() reads public/data.holland.json
 *   - loadOccupationsForJoin() reads public/data.treemap.json (for ai_risk + sector + stats)
 *   - buildInterests() returns Map<InterestType, InterestResult> + hub overview
 *
 * data.holland.json (482 records, columnar [id, name_ja, R, I, A, S, E, C])
 * data.treemap.json  (556 records, full per-occ stats)
 *
 * Astro frontmatter で同期的に動かす想定 (readFileSync at module-load)。
 *
 * 各 hub の TOP N: その RIASEC dim の score 降順で 30 個取得。
 * 同点は id 昇順で stable。
 */
// 2026-05-17 R2 fix: fs reads moved to page-data layer.
import { INTEREST_META, type InterestType, type InterestMeta } from './interests-meta.js';
import {
  loadHolland as _loadHolland,
  loadTreemapSummary as _loadTreemap,
} from '../page-data/projection-loaders.js';

const TOP_N = 30;

// ─── Public types ───────────────────────────────────────────────

export interface InterestOccupation {
  id: number;
  name_ja: string;
  primary_score: number; // この hub の主軸 (R/I/A/S/E/C のうち 1 つ) の score
  riasec: { R: number; I: number; A: number; S: number; E: number; C: number };
  ai_risk: number | null;
  risk_band: string | null;
  workers: number | null;
  salary: number | null;
  sector_id: string;
  sector_ja: string;
}

export interface InterestResult {
  meta: InterestMeta;
  items: InterestOccupation[];
  /** 統計サマリー (header の dl.stats 用) */
  stats: ReadonlyArray<readonly [label: string, value: string]>;
  /** TOP 30 中のセクター内訳 (top 5) */
  sectorBreakdown: ReadonlyArray<readonly [sector: string, count: number]>;
  /** ハイライト箇条書き (3-5 項目) */
  highlights: ReadonlyArray<string>;
  /** 関連 Q&A 用 FAQ (3-5 個) */
  faqItems: ReadonlyArray<readonly [q: string, a: string]>;
}

export interface InterestsBundle {
  results: Map<InterestType, InterestResult>;
  /** /interests/ index page 用 */
  hub: {
    cards: Array<{
      slug: InterestType;
      letter: string;
      name_ja: string;
      title_ja: string;
      description_ja: string;
      top_count: number;
      top_preview: string;
    }>;
  };
}

// ─── Loaders ────────────────────────────────────────────────────

export interface HollandRow {
  id: number;
  name_ja: string;
  R: number | null;
  I: number | null;
  A: number | null;
  S: number | null;
  E: number | null;
  C: number | null;
}

export interface TreemapRecord {
  id: number;
  ai_risk: number | null;
  risk_band: string | null;
  workers: number | null;
  salary: number | null;
  sector_id?: string;
  sector_ja?: string;
}

// 2026-05-17 R2: fs reads delegated to page-data. These adapters
// keep the row-typed shapes the rest of the file expects, while
// the raw Zod-validated payloads come from projection-loaders.

let _hollandCache: HollandRow[] | null = null;
let _treemapCache: Map<number, TreemapRecord> | null = null;

function loadHollandRows(): HollandRow[] {
  if (_hollandCache) return _hollandCache;
  const parsed = _loadHolland();
  // cols expected: ['id', 'name_ja', 'R', 'I', 'A', 'S', 'E', 'C']
  // Per-cell casts mirror the existing positional contract; if
  // columns ever change order the audit recommends evolving this
  // into a `z.object()` row schema.
  _hollandCache = parsed.rows.map((row): HollandRow => ({
    id: row[0] as number,
    name_ja: row[1] as string,
    R: row[2] as number | null,
    I: row[3] as number | null,
    A: row[4] as number | null,
    S: row[5] as number | null,
    E: row[6] as number | null,
    C: row[7] as number | null,
  }));
  return _hollandCache;
}

function loadTreemapMap(): Map<number, TreemapRecord> {
  if (_treemapCache) return _treemapCache;
  const records = _loadTreemap();
  _treemapCache = new Map(records.map((r) => [r.id, r as TreemapRecord]));
  return _treemapCache;
}

// ─── Helpers ────────────────────────────────────────────────────

import { fmtInt, safeMean } from '../lib/num.js';
import { CONSENSUS_FAQ_SENTENCE } from '../site/consensus-copy.js';

// ─── FAQ generation (per type, mostly templated from meta) ───────

function buildFaqs(meta: InterestMeta, items: InterestOccupation[]): Array<readonly [string, string]> {
  const faqs: Array<readonly [string, string]> = [];
  const top3Names = items.slice(0, 3).map((o) => o.name_ja).filter(Boolean).join('、');

  // Q1: そもそもどんなタイプか
  faqs.push([
    `${meta.name_ja}タイプ (${meta.letter}) とはどんな人？`,
    meta.description_ja,
  ]);

  // Q2: TOP の職業
  if (top3Names) {
    faqs.push([
      `${meta.name_ja}タイプにおすすめの職業は？`,
      `${meta.letter} スコアが高い職業 TOP 3 は ${top3Names}。` +
        `本ページではさらに ${items.length} 職業を一覧で確認できます。` +
        `分野では ${meta.typical_fields_ja.slice(0, 3).join('・')} などが向いている傾向にあります。`,
    ]);
  }

  // Q3: AI 影響度
  const meanRisk = safeMean(items.map((o) => o.ai_risk));
  if (meanRisk > 0) {
    const tier = meanRisk <= 3.5 ? '低め' : meanRisk <= 5.5 ? '中程度' : 'やや高め';
    faqs.push([
      `${meta.name_ja}タイプの職業は AI に置き換えられる？`,
      `本 hub の TOP ${items.length} の平均 AI 影響度は ${meanRisk.toFixed(1)}/10 で ${tier} の水準です。` +
        `タイプによって AI 適合度の傾向が異なるため、個別の職業ごとの確認が重要です。` +
        CONSENSUS_FAQ_SENTENCE,
    ]);
  }

  // Q4: 現実的な進路
  faqs.push([
    `${meta.name_ja}タイプの特徴は？`,
    `代表的な特徴は: ${meta.characteristics_ja.slice(0, 3).join('・')} など。` +
      `これらの傾向が強い人は、関連分野の職業を検討する際に適性とのフィット感を確認しやすくなります。`,
  ]);

  return faqs;
}

// ─── Main builder ───────────────────────────────────────────────

/**
 * Optional loaders for dependency injection — Step 7 of the architecture
 * migration uses these to route interest-hub pages through the knowledge
 * graph instead of reading projection JSON files. Both default to the
 * file-reading legacy paths.
 */
export interface InterestsLoaders {
  holland?: () => HollandRow[];
  treemap?: () => Map<number, TreemapRecord>;
}

export function buildInterests(loaders: InterestsLoaders = {}): InterestsBundle {
  const hollandLoad = loaders.holland ?? loadHollandRows;
  const treemapLoad = loaders.treemap ?? loadTreemapMap;
  const holland = hollandLoad();
  const treemap = treemapLoad();

  const results = new Map<InterestType, InterestResult>();

  for (const meta of INTEREST_META) {
    const dim = meta.letter;

    // Score >= 0 でフィルター (null 除外)、その dim 降順、id 昇順 tie-break
    const scored = holland
      .map((h) => {
        const score = h[dim];
        if (score == null) return null;
        const tm = treemap.get(h.id);
        return {
          row: h,
          score,
          tm,
        };
      })
      .filter((x): x is { row: HollandRow; score: number; tm: TreemapRecord | undefined } => x !== null);

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.row.id - b.row.id;
    });

    const top = scored.slice(0, TOP_N);

    const items: InterestOccupation[] = top.map(({ row, score, tm }) => ({
      id: row.id,
      name_ja: row.name_ja,
      primary_score: score,
      riasec: {
        R: row.R ?? 0,
        I: row.I ?? 0,
        A: row.A ?? 0,
        S: row.S ?? 0,
        E: row.E ?? 0,
        C: row.C ?? 0,
      },
      ai_risk: tm?.ai_risk ?? null,
      risk_band: tm?.risk_band ?? null,
      workers: tm?.workers ?? null,
      salary: tm?.salary ?? null,
      sector_id: tm?.sector_id ?? '',
      sector_ja: tm?.sector_ja ?? '',
    }));

    // セクター内訳 (TOP N 内)
    const sectorCounts = new Map<string, number>();
    for (const o of items) {
      if (o.sector_ja) {
        sectorCounts.set(o.sector_ja, (sectorCounts.get(o.sector_ja) ?? 0) + 1);
      }
    }
    const sectorBreakdown: Array<readonly [string, number]> = Array.from(sectorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // 統計サマリー
    const meanRisk = safeMean(items.map((o) => o.ai_risk));
    const meanSalary = safeMean(items.map((o) => o.salary));
    const meanScore = safeMean(items.map((o) => o.primary_score));
    const totalWorkers = items.reduce((s, o) => s + (o.workers ?? 0), 0);

    const stats: Array<readonly [string, string]> = [
      [`平均 ${meta.letter} スコア`, `${meanScore.toFixed(2)} / 5`],
      ['平均 AI 影響', meanRisk > 0 ? `${meanRisk.toFixed(1)} / 10` : '—'],
      ['平均年収', meanSalary > 0 ? `${Math.trunc(meanSalary)} 万円` : '—'],
      ['TOP30 合計就業者数', `${fmtInt(totalWorkers)} 人`],
    ];

    // ハイライト
    const top3 = items.slice(0, 3).map((o) => o.name_ja).join('、');
    const dominantSector = sectorBreakdown[0]?.[0] ?? '';
    const dominantCount = sectorBreakdown[0]?.[1] ?? 0;

    const highlights: string[] = [
      `1 位は「${items[0]?.name_ja ?? '—'}」（${meta.letter}スコア ${items[0]?.primary_score.toFixed(2) ?? '—'}）`,
      top3 ? `TOP 3 は ${top3}` : '',
      dominantSector ? `セクターは「${dominantSector}」が ${dominantCount} 件と最多` : '',
      meanRisk > 0 ? `TOP30 の平均 AI 影響は ${meanRisk.toFixed(1)}/10` : '',
      meta.characteristics_ja.length ? `特徴: ${meta.characteristics_ja[0]}` : '',
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

  // Hub index 用 cards
  const cards = INTEREST_META.map((meta) => {
    const r = results.get(meta.slug)!;
    const top1 = r.items[0]?.name_ja ?? '';
    return {
      slug: meta.slug,
      letter: meta.letter,
      name_ja: meta.name_ja,
      title_ja: meta.title_ja,
      description_ja: meta.description_ja,
      top_count: r.items.length,
      top_preview: top1 ? `1位 ${top1}（${meta.letter}スコア ${r.items[0]!.primary_score.toFixed(2)}）` : '',
    };
  });

  return {
    results,
    hub: { cards },
  };
}
