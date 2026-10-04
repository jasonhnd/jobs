import type { GenreHubConfig } from '../genre-hub.js';

// ─── Q. 入職経路 (entry-paths) — 5 hub ───────────────────

export const ENTRY_PATHS_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'new-grad-mainstream',
    short_ja: '新卒採用',
    title_ja: '新卒採用が中心の職業',
    description_ja: '新卒一括採用が主流で、若年層からのキャリア形成が前提となる職業群。',
    og_eyebrow: 'ENTRY · 新卒',
    custom_filter: (d) => {
      const age = d.stats?.average_age;
      if (!age || age > 38) return null;
      return -age; // younger ranks higher
    },
  },
  {
    slug: 'mid-career-mainstream',
    short_ja: '転職組',
    title_ja: '転職組が多い職業',
    description_ja: '中途採用・転職での入職が主流の職業群。実務経験を活かした参入が一般的。',
    og_eyebrow: 'ENTRY · 中途',
    custom_filter: (d) => {
      const age = d.stats?.average_age;
      if (!age || age < 35) return null;
      return age; // older ranks higher (mature workforce)
    },
  },
  {
    slug: 'from-arbeit',
    short_ja: 'バイト出身',
    title_ja: 'バイト・派遣から正社員化が多い職業',
    description_ja: 'アルバイト・派遣からの正社員登用ルートが整備されている職業群。サービス・販売・製造等。',
    og_eyebrow: 'ENTRY · バイト',
    custom_filter: (d) => {
      // Approximation: large workforce + medium age + low cert
      const workers = d.stats?.workers ?? 0;
      const age = d.stats?.average_age ?? 99;
      const certs = (d.related_certs_ja ?? []).length;
      if (workers < 30000) return null;
      if (certs >= 2) return null;
      if (age > 50) return null;
      return workers;
    },
  },
  {
    slug: 'independent-typical',
    short_ja: '独立典型',
    title_ja: '独立・開業が典型の職業',
    description_ja: '独立・開業がキャリアの自然な到達点となる職業群。美容・調理・建設職人・士業等。',
    og_eyebrow: 'ENTRY · 独立',
    custom_filter: (d) => {
      const certs = (d.related_certs_ja ?? []).length;
      const ai = d.ai_risk?.score;
      if (certs === 0) return null;
      if (ai === null || ai === undefined) return null;
      if (ai > 6) return null;
      return certs;
    },
  },
  {
    slug: 'apprenticeship',
    short_ja: '徒弟制',
    title_ja: '徒弟制・OJT が中心の職業',
    description_ja: '師匠について長期的に技を継承する徒弟型キャリアが残る職業群。伝統工芸・建設職人・調理・美容等。形式教育より OJT が中心。',
    og_eyebrow: 'ENTRY · 徒弟',
    custom_filter: (d) => {
      const ed = d.education_distribution;
      const ai = d.ai_risk?.score;
      if (!ed) return null;
      const lowEdu = (ed['below_high_school'] ?? 0) + (ed['high_school'] ?? 0);
      if (lowEdu < 0.4) return null;
      if (ai !== null && ai !== undefined && ai > 5) return null;
      return lowEdu;
    },
  },
];
