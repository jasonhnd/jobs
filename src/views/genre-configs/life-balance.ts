import type { GenreHubConfig } from '../genre-hub.js';

// ─── P. ライフバランス (life-balance) — 6 hub ────────────────

export const LIFE_BALANCE_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'child-care-balance',
    short_ja: '育児両立',
    title_ja: '育児と両立しやすい職業',
    description_ja: '労働時間が短く、シフト柔軟性のある、育児中の親が続けやすい職業群。',
    og_eyebrow: 'LIFE · 育児',
    custom_filter: (d) => {
      const hours = d.stats?.monthly_hours;
      const ai = d.ai_risk?.score;
      if (!hours || hours > 165) return null;
      if (ai !== null && ai !== undefined && ai > 6) return null;
      return -hours; // lower hours rank higher
    },
  },
  {
    slug: 'elderly-care-balance',
    short_ja: '介護両立',
    title_ja: '介護と両立しやすい職業',
    description_ja: '勤務時間の柔軟性・有給取得・リモート可能性で介護と両立しやすい職業群。',
    og_eyebrow: 'LIFE · 介護',
    custom_filter: (d) => {
      const hours = d.stats?.monthly_hours;
      if (!hours || hours > 170) return null;
      return -hours;
    },
  },
  {
    slug: 'health-friendly',
    short_ja: '体に優しい',
    title_ja: '体力に自信がない人にも続けられる職業',
    description_ja: '体力負荷が低く、長く続けられる職業群。事務系・専門職・知的労働中心。',
    og_eyebrow: 'LIFE · 健康',
    custom_filter: (d) => {
      const hours = d.stats?.monthly_hours;
      if (!hours || hours > 175) return null;
      return -hours;
    },
  },
  {
    slug: 'mental-health-friendly',
    short_ja: '精神負担小',
    title_ja: '精神的負担が軽い職業',
    description_ja: '対人ストレスや即断のプレッシャーが比較的少ない職業群。研究・技能・データ系等。',
    og_eyebrow: 'LIFE · 精神',
    custom_filter: (d) => {
      const hours = d.stats?.monthly_hours;
      const ai = d.ai_risk?.score;
      if (!hours || hours > 170) return null;
      if (ai === null || ai === undefined) return null;
      return -hours;
    },
  },
  {
    slug: 'hobby-balance',
    short_ja: '趣味両立',
    title_ja: '趣味・私生活と両立しやすい職業',
    description_ja: '労働時間が比較的短く、平日の余暇や週末の活動が確保しやすい職業群。',
    og_eyebrow: 'LIFE · 趣味',
    custom_filter: (d) => {
      const hours = d.stats?.monthly_hours;
      if (!hours || hours > 160) return null;
      return -hours;
    },
  },
  {
    slug: 'senior-friendly',
    short_ja: 'シニア活躍',
    title_ja: '60 代以降も続けやすい職業',
    description_ja: '平均年齢が高めで体力負荷が控えめ、AI 影響度も低く、定年後も継続しやすい職業群。経験・人脈が活きる分野。',
    og_eyebrow: 'LIFE · シニア',
    custom_filter: (d) => {
      const age = d.stats?.average_age;
      const ai = d.ai_risk?.score;
      if (!age || age < 45) return null;
      if (ai !== null && ai !== undefined && ai > 5) return null;
      return age;
    },
  },
];
