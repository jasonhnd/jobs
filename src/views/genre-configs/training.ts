import type { GenreHubConfig, DetailFileMin } from '../genre-hub.js';

// ─── L. 習熟期間 (training) — 5 hub ─────────────────────

/**
 * Helper for training-period genres.
 *
 * The data uses snake_case English keys (e.g. `1_to_2_years`) and groups
 * are sometimes split across multiple keys (1-3 years = 1_to_2_years +
 * 2_to_3_years). We use a custom_filter that selects items whose
 * `training_post_top5` contains ANY of the matching keys, ranked by score.
 */
function makeTrainingFilter(matchKeys: ReadonlyArray<string>): GenreHubConfig['custom_filter'] {
  return (d: DetailFileMin) => {
    const arr = d.training_post_top5;
    if (!arr) return null;
    let bestScore = -Infinity;
    for (const e of arr) {
      if (matchKeys.includes(e.key)) {
        if (e.score > bestScore) bestScore = e.score;
      }
    }
    return bestScore === -Infinity ? null : bestScore;
  };
}

export const TRAINING_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'quick-start',
    short_ja: '即一人前',
    title_ja: '入職後すぐ一人前になれる職業',
    description_ja: '入職後 1 年以内に一人前の業務遂行が可能な職業群。サービス・販売・軽作業・運輸の一部等。',
    og_eyebrow: 'TRAINING · 即一人前',
    custom_filter: makeTrainingFilter(['up_to_1_month', '1_to_6_months', '6_months_to_1_year', 'not_required']),
  },
  {
    slug: '1-3-years',
    short_ja: '1-3年',
    title_ja: '1-3 年で一人前になる職業',
    description_ja: '1-3 年の入職後訓練で独立業務が可能になる職業群。事務・営業・技術系の中堅水準。',
    og_eyebrow: 'TRAINING · 1-3年',
    custom_filter: makeTrainingFilter(['1_to_2_years', '2_to_3_years']),
  },
  {
    slug: '3-5-years',
    short_ja: '3-5年',
    title_ja: '3-5 年で熟達する職業',
    description_ja: '3-5 年の修行・経験で熟練レベルに到達する職業群。中堅職人・技術職・専門事務・営業の上位等。',
    og_eyebrow: 'TRAINING · 3-5年',
    custom_filter: makeTrainingFilter(['3_to_5_years']),
  },
  {
    slug: '5-10-years',
    short_ja: '5-10年',
    title_ja: '5-10 年の修行が必要な職業',
    description_ja: '5 年以上の長い修行を経て一人前となる職業群。職人・専門医・士業・職長等。',
    og_eyebrow: 'TRAINING · 5-10年',
    custom_filter: makeTrainingFilter(['5_to_10_years']),
  },
  {
    slug: 'lifelong-craft',
    short_ja: '生涯修行',
    title_ja: '生涯修行型の職業',
    description_ja: '10 年超または生涯にわたる継続学習が前提となる職業群。伝統工芸・最先端医療・士業の上位等。',
    og_eyebrow: 'TRAINING · 生涯',
    custom_filter: makeTrainingFilter(['over_10_years']),
  },
];

