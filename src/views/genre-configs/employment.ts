import type { GenreHubConfig } from '../genre-hub.js';

// ─── N. 雇用形態 (employment_type) — 4 hub ─────────────

export const EMPLOYMENT_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'full-time-mainstream',
    short_ja: '正社員',
    title_ja: '正社員が多い職業',
    description_ja: '正規雇用比率が高い職業群。安定的な雇用と福利厚生を求める人向け。',
    og_eyebrow: 'EMPLOY · 正社員',
    custom_filter: (d) => {
      const et = d.employment_type;
      if (!et) return null;
      const v = et['regular_employee'] ?? 0;
      return v >= 0.6 ? v : null;
    },
  },
  {
    slug: 'freelance-friendly',
    short_ja: 'フリーランス',
    title_ja: 'フリーランス・個人事業向きの職業',
    description_ja: '自営・フリーランス比率が高く、独立しやすい職業群。',
    og_eyebrow: 'EMPLOY · フリーランス',
    custom_filter: (d) => {
      const et = d.employment_type;
      if (!et) return null;
      const v = et['self_employed_freelance'] ?? 0;
      return v >= 0.15 ? v : null;
    },
  },
  {
    slug: 'part-time-mainstream',
    short_ja: 'パート・派遣',
    title_ja: 'パート・派遣が多い職業',
    description_ja: 'パートタイム・派遣の比率が高い職業群。短時間・柔軟な働き方の選択肢。',
    og_eyebrow: 'EMPLOY · パート',
    custom_filter: (d) => {
      const et = d.employment_type;
      if (!et) return null;
      const v = (et['part_time'] ?? 0) + (et['dispatched'] ?? 0);
      return v >= 0.2 ? v : null;
    },
  },
  {
    slug: 'public-employee',
    short_ja: '公務員',
    title_ja: '公務員系の職業',
    description_ja: '公的機関で働く職業群。保安・公安系を中心に、地方公務員・国家公務員職。',
    og_eyebrow: 'EMPLOY · 公務員',
    custom_filter: (d) => {
      // Approximate via sector_id == 'hoan' or large workforce + low ai
      const sid = d.sector?.id;
      if (sid === 'hoan') return 1;
      return null;
    },
  },
];

