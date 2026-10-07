import type { GenreHubConfig } from '../genre-hub.js';

// ─── M. 業務形態 (work_characteristics) — 7 hub ─────────

export const WORK_STYLES_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'indoor-vs-outdoor',
    short_ja: '屋外作業',
    title_ja: '屋外作業中心の職業',
    description_ja: '主たる業務が屋外で行われる職業群。建設・農林・運輸・現場系等。天候や環境への対応が必要。',
    og_eyebrow: 'WORK · 屋外',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'outdoor_work',
  },
  {
    slug: 'desk-vs-genba',
    short_ja: '現場中心',
    title_ja: '現場中心の職業',
    description_ja: 'デスクワークではなく現場での身体作業が中心の職業群。製造・建設・サービス系等。',
    og_eyebrow: 'WORK · 現場',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'standing',
  },
  {
    slug: 'move-required',
    short_ja: '外回り型',
    title_ja: '移動が多い職業',
    description_ja: '営業・配達・訪問等で移動が業務の中心となる職業群。',
    og_eyebrow: 'WORK · 移動',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'walking_running',
  },
  {
    slug: 'shift-work',
    short_ja: 'シフト勤務',
    title_ja: 'シフト勤務 (24h・夜勤・早朝) の職業',
    description_ja: '24 時間体制・夜勤・早朝シフトが業務に組み込まれている職業群。医療・運輸・警備・ホテル・コンビニ等。',
    og_eyebrow: 'WORK · シフト',
    hide_score: true,
    custom_filter: (d) => {
      // Shift-work isn't a single IPD key — approximate via sectors that
      // traditionally operate 24h or in shifts (medical, public safety,
      // service, transportation/maint).
      const sid = d.sector?.id ?? '';
      if (!['iryo', 'hoan', 'service', 'maint'].includes(sid)) return null;
      // Rank by workforce size as a rough proxy for "how many people in
      // shift-work jobs in this sector".
      return d.stats?.workers ?? 0;
    },
  },
  {
    slug: 'solo-vs-team',
    short_ja: 'チーム作業',
    title_ja: 'チーム作業中心の職業',
    description_ja: '複数人での協働が業務の中心となる職業群。建設現場・医療・プロジェクト系等。',
    og_eyebrow: 'WORK · チーム',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'teamwork',
  },
  {
    slug: 'high-physical-load',
    short_ja: '重労働型',
    title_ja: '体力負荷が高い職業',
    description_ja: '長時間の身体負荷が業務に伴う職業群。運輸・建設・介護・警備・製造等。',
    og_eyebrow: 'WORK · 体力',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'physical_proximity',
  },
  {
    slug: 'desk-sitting-work',
    short_ja: '座り仕事',
    title_ja: '座って行う仕事中心の職業',
    description_ja: 'デスクワーク・座位での業務が中心となる職業群。事務・IT・士業・コールセンター等。長時間着座への耐性が必要。',
    og_eyebrow: 'WORK · 座位',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'sitting',
  },
];
