/**
 * View model for /gyakuten. The Astro page reads the JSON files and calls
 * this. Pure: no filesystem access.
 */
import { siteConfig } from '../site/config.js';
import type { WorktypeFamilyCode, WorktypesData } from '@/data/schema/worktypes';
import { CONTENT_DATE } from '@/lib/_content-date';
import type { TreemapRecordSummary } from '@/lib/projection-schemas';
import {
  FAMILIES,
  FAMILY_CODES,
  VARIANTS,
  VARIANT_IDS_BY_FAMILY,
} from '@/site/worktype-copy';
import { stringifyJsonLd } from '../lib/json-for-script.js';

const REPRESENTATIVE_OCCUPATION_COUNT = 4;

interface RepresentativeOccupation {
  readonly id: number;
  readonly name: string;
  readonly workers: number | null;
}

interface VariantView {
  readonly id: string;
  readonly name: string;
  readonly catch: string;
  readonly lockLabel: string;
}

interface FamilyView {
  readonly code: WorktypeFamilyCode;
  readonly name: string;
  readonly share: string;
  readonly aiRelation: string;
  readonly empowerment: string;
  readonly rarityText: string;
  readonly occupations: RepresentativeOccupation[];
  readonly variants: VariantView[];
}

export interface GyakutenPageModel {
  readonly canonical: string;
  readonly title: string;
  readonly seoDesc: string;
  readonly keywords: string;
  readonly jsonLd: string;
  readonly familyViews: readonly FamilyView[];
  readonly variantCount: number;
  readonly occupationCount: number;
  readonly pairViews: readonly { readonly title: string; readonly description: string }[];
}

const LOCKED_VARIANT_LABELS = [
  '？ 診断でめくる',
  'まだ見ぬ1枚',
  '解放待ち',
  'あなたの図鑑に眠る',
  'めくるまで内緒',
  '次のカード候補',
  '未発見タイプ',
  '診断後に開きます',
  '白紙のカード',
  'これから出会う1枚',
  'ロック中',
  '図鑑の奥に待機中',
  '結果でひらく',
  'まだ伏せ札',
  '発見待ち',
  'あなたの番を待つ',
  'めくるチャンスあり',
  '未解放の働き方',
  '次に光るかも',
  '診断で会いにいく',
  '隠れカード',
  'まだ物語の前',
  '開封待ち',
  '9問の先で解放',
] as const;

export function formatWorkers(value: number | null): string {
  if (value === null) return '就業者数不明';
  if (value >= 10000) {
    const unit = value / 10000;
    const text = unit >= 10 ? unit.toFixed(0) : unit.toFixed(1);
    return `約${text}万人`;
  }
  return `約${Math.round(value).toLocaleString('ja-JP')}人`;
}

function treemapName(row: TreemapRecordSummary): string {
  const name = row.name_ja;
  return typeof name === 'string' && name.length > 0 ? name : `職業 ${row.id}`;
}


export function buildGyakutenPageModel(
  worktypes: WorktypesData,
  treemapRows: readonly TreemapRecordSummary[],
): GyakutenPageModel {
  const canonical = `${siteConfig.origin}/gyakuten`;
  const title = 'AI働き方診断 図鑑｜8家族と24タイプを見る | 未来の仕事';
  const seoDesc =
    'AI働き方診断の8家族と24バリアントを一覧できる図鑑ページ。家族ごとのAIとの関係、次の一手、代表職業、職業データ全体での静的な分布を確認できます。';
  const keywords = 'AI働き方診断, 仕事タイプ, 図鑑, 働き方, AI時代, 職業データ';

  const treemapById = new Map(treemapRows.map((row) => [String(row.id), row]));

  const occupationsByFamily: Record<WorktypeFamilyCode, RepresentativeOccupation[]> = {
    CPB: [],
    CPK: [],
    CDB: [],
    CDK: [],
    RPB: [],
    RPK: [],
    RDB: [],
    RDK: [],
  };

  for (const [id, record] of Object.entries(worktypes.occupations)) {
    const row = treemapById.get(id);
    if (!row) continue;
    occupationsByFamily[record.code].push({
      id: Number(id),
      name: treemapName(row),
      workers: typeof row.workers === 'number' ? row.workers : null,
    });
  }

  for (const code of FAMILY_CODES) {
    occupationsByFamily[code].sort((a, b) => (b.workers ?? -1) - (a.workers ?? -1) || a.id - b.id);
  }

  let lockedLabelIndex = 0;

  const familyViews: FamilyView[] = FAMILY_CODES.map((code) => {
    const family = FAMILIES[code];
    const familyMeta = worktypes.families[code];
    const variantCopy = VARIANTS[code] as Record<string, { name: string; catch: string }>;
    return {
      code,
      name: family.name,
      share: family.share,
      aiRelation: family.aiRelation,
      empowerment: family.empowerment,
      // Count first, percentage second — 「{n}職」 names the unit, so the figure
      // cannot be read as a share of people (issue #235).
      rarityText: familyMeta
        ? `${familyMeta.count}職（全体の約${familyMeta.pct.toFixed(1)}%）`
        : '職業数は確認中',
      occupations: occupationsByFamily[code].slice(0, REPRESENTATIVE_OCCUPATION_COUNT),
      variants: VARIANT_IDS_BY_FAMILY[code].map((variantId) => {
        const variant = variantCopy[variantId]!;
        const lockLabel = LOCKED_VARIANT_LABELS[lockedLabelIndex % LOCKED_VARIANT_LABELS.length]!;
        lockedLabelIndex += 1;
        return { id: variantId, name: variant.name, catch: variant.catch, lockLabel };
      }),
    };
  });

  const variantCount = familyViews.reduce((sum, family) => sum + family.variants.length, 0);
  const occupationCount = Object.keys(worktypes.occupations).length;

  const familyPairs = [
    ['CPB', 'CPK'],
    ['CDB', 'CDK'],
    ['RPB', 'RPK'],
    ['RDB', 'RDK'],
    ['CPK', 'RDK'],
    ['CDK', 'RPB'],
  ] as const satisfies ReadonlyArray<readonly [WorktypeFamilyCode, WorktypeFamilyCode]>;

  const pairViews = familyPairs.map(([left, right]) => ({
    title: `${FAMILIES[left].name} × ${FAMILIES[right].name}`,
    description: `${FAMILIES[left].share} / ${FAMILIES[right].share}`,
  }));

  const jsonLd = stringifyJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        name: title,
        url: canonical,
        description: seoDesc,
        inLanguage: 'ja',
        isPartOf: { '@id': `${siteConfig.origin}/#website` },
        about: { '@id': `${siteConfig.origin}/#organization` },
        publisher: { '@id': `${siteConfig.origin}/#organization` },
        datePublished: '2026-07-04',
        // Tracks the data; datePublished stays frozen. Issue #219.
        dateModified: CONTENT_DATE,
        breadcrumb: { '@id': `${canonical}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${siteConfig.origin}/` },
          { '@type': 'ListItem', position: 2, name: 'AI働き方診断 図鑑', item: canonical },
        ],
      },
    ],
  });

  return {
    canonical,
    title,
    seoDesc,
    keywords,
    jsonLd,
    familyViews,
    variantCount,
    occupationCount,
    pairViews,
  };
}
