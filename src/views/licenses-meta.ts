/**
 * src/views/licenses-meta.ts — 15 個の資格 hub の定義。
 *
 * data.detail/<id>.json の related_certs_ja 配列に対してキーワード照合で
 * 各 hub に該当する職業を抽出する。Pure-data モジュール。
 *
 * Migrated from src/data/lib/licenses-meta.ts 2026-05-14 as part of
 * Phase B. Lives under src/views/ per §6.2.
 *
 * NOTE: `DetailFileMin` is still defined in src/views/genre-hub.ts
 * (cross-directory import) — will resolve when genre-hub itself
 * migrates later in Phase B.
 */
import type { DetailFileMin } from './genre-hub.js';

export interface LicenseHub {
  slug: string;
  short_ja: string;
  title_ja: string;
  description_ja: string;
  /** 該当 cert を含むかどうかの判定。複数 keyword の OR. */
  cert_keywords: ReadonlyArray<string>;
  /** 上位 cert キーワードを除外したい場合 (例: 「人気資格」hub で他が含まれないように) */
  exclude_keywords?: ReadonlyArray<string>;
  og_eyebrow: string;
  /** 説明用の項目 */
  cert_examples_ja: ReadonlyArray<string>;
  /** 取得難度ヒント */
  difficulty_ja: string;
}

export const LICENSE_HUBS: ReadonlyArray<LicenseHub> = [
  {
    slug: 'national-vs-private',
    short_ja: '国家資格メタ',
    title_ja: '国家資格が必要な職業 (メタ)',
    description_ja: '国家資格を保有することが業務の前提となる職業群。法的な業務独占・名称独占により AI 代替リスクから守られている。',
    cert_keywords: ['弁護士', '医師', '歯科医師', '司法書士', '行政書士', '弁理士', '公認会計士', '税理士', '看護師', '准看護師', '助産師', '保健師', '薬剤師', '建築士', '一級建築士', '二級建築士', '介護福祉士', '社会福祉士', '精神保健福祉士', '保育士', '管理栄養士', '理学療法士', '作業療法士', '言語聴覚士', '視能訓練士', '臨床検査技師', '臨床工学技士', '診療放射線技師', '救急救命士', '柔道整復師', 'はり師', 'きゅう師', 'あん摩マッサージ指圧師', '介護支援専門員', '気象予報士', '社会保険労務士', '中小企業診断士', '宅地建物取引士', '電気工事士', '電気主任技術者', '土木施工管理技士', '建築施工管理技士', '管工事施工管理技士'],
    og_eyebrow: 'LICENSE · 国家資格',
    cert_examples_ja: ['弁護士', '医師', '公認会計士', '税理士', '看護師'],
    difficulty_ja: '難度に幅があるが、業務独占資格は数年単位の準備が必要',
  },
  {
    slug: 'gyoumu-dokusen',
    short_ja: '業務独占',
    title_ja: '業務独占資格が必須の職業',
    description_ja: '法律で「資格保有者しかできない」と定められた業務範囲を持つ職業群。最強の参入障壁。',
    cert_keywords: ['弁護士', '医師', '司法書士', '弁理士', '公認会計士', '税理士', '看護師', '薬剤師', '建築士'],
    og_eyebrow: 'LICENSE · 業務独占',
    cert_examples_ja: ['弁護士', '医師', '看護師', '薬剤師', '建築士'],
    difficulty_ja: '高難度の国家試験、合格までに 3-10 年',
  },
  {
    slug: 'meishou-dokusen-hicchi',
    short_ja: '名称独占・必置',
    title_ja: '名称独占・必置資格の職業',
    description_ja: '資格保有者だけが「名乗れる」または「設置義務」がある職業群。業務独占ほど強くないが市場価値は高い。',
    cert_keywords: ['介護福祉士', '保育士', '管理栄養士', '社会福祉士', '理学療法士', '作業療法士', '言語聴覚士'],
    og_eyebrow: 'LICENSE · 名称独占',
    cert_examples_ja: ['介護福祉士', '保育士', '管理栄養士', '社会福祉士'],
    difficulty_ja: '養成課程修了 + 国家試験、2-4 年',
  },
  {
    slug: 'medical-licenses',
    short_ja: '医療系',
    title_ja: '医療系資格と職業',
    description_ja: '医療従事者として働くための資格を要する職業群。医師・看護師・薬剤師から技師・療法士まで多彩。',
    cert_keywords: ['医師', '看護師', '薬剤師', '臨床検査', '臨床工学', '救急救命', '歯科', '助産', '保健師', '理学療法', '作業療法', '言語聴覚', 'はり', 'きゅう', 'あん摩マッサージ', '柔道整復', '視能訓練'],
    og_eyebrow: 'LICENSE · 医療',
    cert_examples_ja: ['医師', '看護師', '薬剤師', '臨床検査技師', '理学療法士'],
    difficulty_ja: '国家試験、養成課程 3-6 年',
  },
  {
    slug: 'welfare-licenses',
    short_ja: '福祉系',
    title_ja: '福祉・介護系資格と職業',
    description_ja: '福祉・介護の現場で働く資格を要する職業群。需要が継続的に拡大している分野。',
    cert_keywords: ['介護福祉士', '社会福祉士', '精神保健福祉士', '介護支援専門員', 'ホームヘルパー', '介護職員初任者', '居宅介護'],
    og_eyebrow: 'LICENSE · 福祉',
    cert_examples_ja: ['介護福祉士', '社会福祉士', 'ケアマネジャー', '訪問介護員'],
    difficulty_ja: '実務経験 + 試験、または養成課程',
  },
  {
    slug: 'education-licenses',
    short_ja: '教育系',
    title_ja: '教育系資格と職業',
    description_ja: '教育・指導の現場で働くための教員免許や指導者資格を要する職業群。',
    cert_keywords: ['教員免許', '保育士', '幼稚園教諭', '学校', '教諭', '司書', '学芸員'],
    og_eyebrow: 'LICENSE · 教育',
    cert_examples_ja: ['教員免許', '保育士', '幼稚園教諭', '学芸員'],
    difficulty_ja: '大学での教職課程修了 + 採用試験',
  },
  {
    slug: 'legal-licenses',
    short_ja: '法務系',
    title_ja: '法務系資格と職業',
    description_ja: '法律業務に従事するための資格を要する職業群。難関資格が多い高度専門職。',
    cert_keywords: ['弁護士', '司法書士', '行政書士', '弁理士', '社会保険労務士'],
    og_eyebrow: 'LICENSE · 法務',
    cert_examples_ja: ['弁護士', '司法書士', '行政書士', '弁理士'],
    difficulty_ja: '高難度の国家試験、合格率 3-15%',
  },
  {
    slug: 'accounting-licenses',
    short_ja: '会計系',
    title_ja: '会計系資格と職業',
    description_ja: '会計・財務の専門業務を行うための資格を要する職業群。',
    cert_keywords: ['公認会計士', '税理士', '簿記', '中小企業診断士'],
    og_eyebrow: 'LICENSE · 会計',
    cert_examples_ja: ['公認会計士', '税理士', '簿記 1 級'],
    difficulty_ja: '高難度の国家試験、5-10 年の準備',
  },
  {
    slug: 'construction-licenses',
    short_ja: '建設系',
    title_ja: '建築・建設系資格と職業',
    description_ja: '建築・土木の現場で技能・管理業務を行うための資格を要する職業群。',
    cert_keywords: ['建築士', '建築施工管理', '土木施工管理', '造園施工管理', '電気工事士', '管工事施工管理', '測量士'],
    og_eyebrow: 'LICENSE · 建設',
    cert_examples_ja: ['一級建築士', '建築施工管理技士', '電気工事士'],
    difficulty_ja: '実務経験 + 国家試験',
  },
  {
    slug: 'it-licenses',
    short_ja: 'IT 系',
    title_ja: 'IT 系資格と職業',
    description_ja: '情報処理・ネットワーク・セキュリティの専門業務を行うための資格を要する職業群。',
    cert_keywords: ['情報処理', 'ITストラテジスト', 'プロジェクトマネージャ', 'システム監査', 'データベース', 'ネットワークスペシャリスト', '情報セキュリティ', '応用情報', '基本情報'],
    og_eyebrow: 'LICENSE · IT',
    cert_examples_ja: ['応用情報技術者', 'IT ストラテジスト', '情報処理安全確保支援士'],
    difficulty_ja: '国家試験 (区分により難度差大)',
  },
  {
    slug: 'realestate-licenses',
    short_ja: '不動産系',
    title_ja: '不動産系資格と職業',
    description_ja: '不動産取引・管理の専門業務を行うための資格を要する職業群。',
    cert_keywords: ['宅地建物取引士', '不動産鑑定士', 'マンション管理士', '管理業務主任者'],
    og_eyebrow: 'LICENSE · 不動産',
    cert_examples_ja: ['宅地建物取引士', '不動産鑑定士', 'マンション管理士'],
    difficulty_ja: '国家試験、難度に幅がある',
  },
  {
    slug: 'food-safety-licenses',
    short_ja: '食品衛生系',
    title_ja: '食品・衛生系資格と職業',
    description_ja: '食品製造・販売・衛生管理の業務を行うための資格を要する職業群。',
    cert_keywords: ['食品衛生', '調理師', '製菓衛生師', '栄養士', '管理栄養士', 'パン製造技能'],
    og_eyebrow: 'LICENSE · 食品衛生',
    cert_examples_ja: ['食品衛生責任者', '調理師', '管理栄養士'],
    difficulty_ja: '養成課程または実務経験 + 試験',
  },
  {
    slug: 'easy-licenses',
    short_ja: '短期取得',
    title_ja: '短期間で取れる資格を活かす職業',
    description_ja: '比較的短期間 (数ヶ月~1 年) で取得できる資格で就ける職業群。',
    cert_keywords: ['介護職員初任者', '食品衛生責任者', '危険物取扱者', '簿記 3 級', '簿記 2 級', '医療事務', 'ホームヘルパー'],
    og_eyebrow: 'LICENSE · 短期取得',
    cert_examples_ja: ['介護職員初任者研修', '食品衛生責任者', '危険物取扱者乙種'],
    difficulty_ja: '数ヶ月の通信講座 + 試験',
  },
  {
    slug: 'no-degree-licenses',
    short_ja: '学歴不要',
    title_ja: '学歴不要で取れる資格を活かす職業',
    description_ja: '受験資格に学歴を要さず、年齢・実務経験ベースで取得できる資格を活かす職業群。',
    cert_keywords: ['介護職員初任者', '食品衛生責任者', '危険物取扱者', '宅地建物取引士', '簿記', '行政書士', '電気工事士'],
    og_eyebrow: 'LICENSE · 学歴不要',
    cert_examples_ja: ['宅地建物取引士', '行政書士', '電気工事士'],
    difficulty_ja: '学歴不問だが内容は本格的、独学合格者多数',
  },
  {
    slug: 'popular-licenses',
    short_ja: '人気資格',
    title_ja: '人気資格と関連職業 TOP',
    description_ja: '受験者数・市場需要・キャリア波及効果が大きい人気資格を活かす職業群。',
    cert_keywords: ['宅地建物取引士', '簿記', 'TOEIC', '基本情報', '応用情報', 'FP', 'ファイナンシャル', '日商簿記', '英検', '中小企業診断士', '社会保険労務士'],
    og_eyebrow: 'LICENSE · 人気',
    cert_examples_ja: ['宅地建物取引士', '日商簿記', 'FP 技能士', '社労士'],
    difficulty_ja: 'バリエーション豊富、入門～難関まで',
  },
];

export function matchLicense(d: DetailFileMin, hub: LicenseHub): boolean {
  const certs = d.related_certs_ja ?? [];
  if (certs.length === 0) return false;
  for (const cert of certs) {
    for (const kw of hub.cert_keywords) {
      if (cert.includes(kw)) {
        if (hub.exclude_keywords) {
          if (hub.exclude_keywords.some((ex) => cert.includes(ex))) continue;
        }
        return true;
      }
    }
  }
  return false;
}

export function rankLicense(d: DetailFileMin, hub: LicenseHub): number {
  // Sort: more matching certs = higher rank, fallback to salary
  const certs = d.related_certs_ja ?? [];
  let matches = 0;
  for (const cert of certs) {
    for (const kw of hub.cert_keywords) {
      if (cert.includes(kw)) { matches++; break; }
    }
  }
  return matches * 10000 + (d.stats?.salary_man_yen ?? 0);
}
