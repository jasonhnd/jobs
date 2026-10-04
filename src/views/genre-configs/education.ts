import type { GenreHubConfig, DetailFileMin } from '../genre-hub.js';

// ─── K. 学歴 (education) — 6 hub ─────────────────────────

function makeEduConfig(
  slug: string,
  short: string,
  title: string,
  desc: string,
  predicate: (d: DetailFileMin) => number | null,
): GenreHubConfig {
  return {
    slug,
    short_ja: short,
    title_ja: title,
    description_ja: desc,
    og_eyebrow: `EDUCATION · ${short}`,
    custom_filter: predicate,
  };
}

export const EDUCATION_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  makeEduConfig(
    'no-school-required',
    '学歴不問',
    '学歴不問で就ける職業',
    '高卒未満からでも就ける、学歴ハードルが最も低い職業群。実務経験と適性が評価軸となる現場職。',
    (d) => {
      const ed = d.education_distribution;
      if (!ed) return null;
      const v = ed['below_high_school'] ?? 0;
      return v >= 0.05 ? v : null;
    },
  ),
  makeEduConfig(
    'high-school-careers',
    '高卒',
    '高卒で目指せる職業',
    '高卒比率が高い職業群。建設・製造・運輸・サービス・公安系の現場職が中心。',
    (d) => {
      const ed = d.education_distribution;
      if (!ed) return null;
      const v = ed['high_school'] ?? 0;
      return v >= 0.3 ? v : null;
    },
  ),
  makeEduConfig(
    'vocational-school-careers',
    '専門学校卒',
    '専門学校卒で目指せる職業',
    '専門学校での技能習得が前提となる職業群。美容・調理・医療技術・IT 等。',
    (d) => {
      const ed = d.education_distribution;
      if (!ed) return null;
      const v = ed['vocational_school'] ?? 0;
      return v >= 0.15 ? v : null;
    },
  ),
  makeEduConfig(
    'university-careers',
    '大卒',
    '大卒以上が中心の職業',
    '大卒比率が高い職業群。専門知識・抽象思考・複雑な意思決定を要する分野。',
    (d) => {
      const ed = d.education_distribution;
      if (!ed) return null;
      const v = ed['university'] ?? 0;
      return v >= 0.5 ? v : null;
    },
  ),
  makeEduConfig(
    'graduate-school-careers',
    '大学院卒',
    '大学院卒中心の職業',
    '修士・博士課程修了が前提の高度専門職。研究・大学教員・専門医等。',
    (d) => {
      const ed = d.education_distribution;
      if (!ed) return null;
      const v = (ed['masters'] ?? 0) + (ed['doctorate'] ?? 0);
      return v >= 0.2 ? v : null;
    },
  ),
  makeEduConfig(
    'lifetime-learning',
    '生涯学習',
    '学歴より生涯学習が重要な職業',
    '初期学歴より継続的な学習・資格更新が重視される職業群。技能職・士業・専門職等。',
    (d) => {
      const certs = (d.related_certs_ja ?? []).length;
      const ai = d.ai_risk?.score;
      if (certs < 1) return null;
      if (ai === null || ai === undefined) return null;
      if (ai > 6) return null;
      return certs;
    },
  ),
];
