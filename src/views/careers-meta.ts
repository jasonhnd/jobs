/**
 * src/views/careers-meta.ts — 10 個のキャリア段階別 persona hub。
 *
 * 各 persona に対して、推薦職業の選定ルール (推薦フィルター) と
 * persona-specific intro / 注意点 を持つ。
 *
 * Migrated from src/data/lib/careers-meta.ts 2026-05-14 as part of
 * Phase B. Lives under src/views/ per §6.2.
 *
 * NOTE: `DetailFileMin` still defined in src/data/lib/genre-hub.ts
 * (temporary cross-directory import; resolves when genre-hub
 * migrates later).
 *
 * Pure-data モジュール、fs imports なし。
 */
import type { DetailFileMin } from '../data/lib/genre-hub.js';

export interface CareerPersona {
  slug: string;
  short_ja: string;
  title_ja: string;
  description_ja: string;
  /** 注意点 (3-5 項目) */
  cautions_ja: ReadonlyArray<string>;
  /** 利点 (3-5 項目) */
  advantages_ja: ReadonlyArray<string>;
  og_eyebrow: string;
  /** Recommendation predicate: returns numeric score (higher = more recommended) or null */
  recommend: (d: DetailFileMin) => number | null;
}

export const CAREER_PERSONAS: ReadonlyArray<CareerPersona> = [
  {
    slug: 'shinsotsu',
    short_ja: '新卒・第二新卒',
    title_ja: '新卒・第二新卒におすすめの職業',
    description_ja: '新卒一括採用が中心で、若手から成長機会が得られる職業群。長期的なキャリア形成の起点として選びやすい分野。',
    cautions_ja: [
      '初任給だけでなく長期年収カーブも確認',
      '希望配属が通らない可能性を考慮',
      '入社後の研修体系が整備されているか',
    ],
    advantages_ja: [
      '一括採用で枠が大きい',
      '研修・OJT が整備されている',
      '若手から責任ある業務に挑戦しやすい',
    ],
    og_eyebrow: 'CAREER · 新卒',
    recommend: (d) => {
      const age = d.stats?.average_age;
      const workers = d.stats?.workers;
      if (!age || !workers) return null;
      if (age > 38) return null;
      if (workers < 30000) return null;
      return -age * 1000 + workers / 10000;
    },
  },
  {
    slug: '20-late',
    short_ja: '20 代後半',
    title_ja: '20 代後半 (第二新卒卒業後) におすすめの職業',
    description_ja: '第二新卒の窓を抜けた後の 20 代後半向け。実務経験 2-5 年を活かして本格的なキャリアを築く段階。',
    cautions_ja: [
      '中途採用は即戦力を求められる',
      '専門スキルの方向性を絞り始める時期',
      'ライフイベント (結婚・出産) と仕事の調和',
    ],
    advantages_ja: [
      '若さと経験のバランスが最良',
      '専門性の確立に時間がある',
      '転職市場での価値が高い時期',
    ],
    og_eyebrow: 'CAREER · 20代後半',
    recommend: (d) => {
      const age = d.stats?.average_age;
      const ai = d.ai_risk?.score;
      if (!age || age > 42 || age < 28) return null;
      if (ai === null || ai === undefined) return null;
      if (ai > 6) return null;
      return 100 - Math.abs(age - 32);
    },
  },
  {
    slug: '30s-early',
    short_ja: '30 代前半転職',
    title_ja: '30 代前半の転職におすすめの職業',
    description_ja: 'ファーストキャリアの専門性を活かしつつ、長期目線で安定 + 成長を両立する 30 代前半向けの職業群。',
    cautions_ja: [
      '管理職パスの有無を確認',
      '住宅ローン等の生活コスト変化を考慮',
      '前職スキルの転用度合い',
    ],
    advantages_ja: [
      '即戦力評価で年収アップしやすい',
      '専門性 + マネジメント素地の評価期',
      '20 代の実績を武器にできる',
    ],
    og_eyebrow: 'CAREER · 30代前半',
    recommend: (d) => {
      const age = d.stats?.average_age;
      const salary = d.stats?.salary_man_yen;
      const ai = d.ai_risk?.score;
      if (!age || !salary) return null;
      if (age < 30 || age > 45) return null;
      if (ai !== null && ai !== undefined && ai > 6) return null;
      return salary;
    },
  },
  {
    slug: '30s-late',
    short_ja: '30 代後半転職',
    title_ja: '30 代後半の転職におすすめの職業',
    description_ja: '30 代後半は転職難度が上がる時期。専門性 + 人脈 + マネジメント実績の総合力を活かす職業群。',
    cautions_ja: [
      '転職回数が多すぎないか確認',
      '次が「最後の転職」になる可能性も',
      '年収維持と長期安定のバランス',
    ],
    advantages_ja: [
      '専門性が成熟し市場価値が安定',
      'マネジメント職への転換可能性',
      '独立・コンサルティングの選択肢',
    ],
    og_eyebrow: 'CAREER · 30代後半',
    recommend: (d) => {
      const age = d.stats?.average_age;
      const certs = (d.related_certs_ja ?? []).length;
      const ai = d.ai_risk?.score;
      if (!age || age < 35 || age > 48) return null;
      if (ai === null || ai === undefined) return null;
      if (ai > 5) return null;
      return certs * 100 + age;
    },
  },
  {
    slug: '40s',
    short_ja: '40 代転職',
    title_ja: '40 代の転職におすすめの職業',
    description_ja: '40 代は専門性と経験が最も評価される一方、転職時の選択肢が絞られる時期。長期維持可能な職業群。',
    cautions_ja: [
      '体力的な持続可能性',
      '若手とのコミュニケーション',
      '第二の人生の準備期間',
    ],
    advantages_ja: [
      '深い専門性で評価される',
      '管理職・指導者ポジション',
      '独立開業の現実性が高い',
    ],
    og_eyebrow: 'CAREER · 40代',
    recommend: (d) => {
      const age = d.stats?.average_age;
      const ai = d.ai_risk?.score;
      const certs = (d.related_certs_ja ?? []).length;
      if (!age || age < 40 || age > 55) return null;
      if (ai === null || ai === undefined) return null;
      if (ai > 4) return null;
      return certs * 50 + age;
    },
  },
  {
    slug: '50s',
    short_ja: '50 代キャリア後期',
    title_ja: '50 代キャリア後期に活躍できる職業',
    description_ja: '50 代は経験を活かして次世代を育成し、退職後を見据えた働き方にシフトする時期。',
    cautions_ja: [
      '健康面の維持が必須条件',
      '退職金・年金との兼ね合い',
      '若手との価値観ギャップ',
    ],
    advantages_ja: [
      '蓄積した知見の伝承価値',
      'マイペースで継続可能な仕事',
      '社会的意義のある役割',
    ],
    og_eyebrow: 'CAREER · 50代',
    recommend: (d) => {
      const age = d.stats?.average_age;
      const ai = d.ai_risk?.score;
      const hours = d.stats?.monthly_hours;
      if (!age || age < 45) return null;
      if (ai === null || ai === undefined) return null;
      if (ai > 4) return null;
      if (hours && hours > 175) return null;
      return age;
    },
  },
  {
    slug: '60s-shinia',
    short_ja: 'シニア再就職',
    title_ja: '60 代以上シニアの再就職におすすめ',
    description_ja: '定年後の継続雇用や別分野での再スタートに向く職業群。健康・経験を活かして無理なく続けられる仕事。',
    cautions_ja: [
      '体力的負荷の評価',
      '勤務時間の柔軟性',
      'デジタル業務への対応度',
    ],
    advantages_ja: [
      '長年の経験が直接価値に',
      '指導者・相談役のポジション',
      '社会的孤立の予防',
    ],
    og_eyebrow: 'CAREER · シニア',
    recommend: (d) => {
      const age = d.stats?.average_age;
      const hours = d.stats?.monthly_hours;
      const ai = d.ai_risk?.score;
      if (!age || age < 50) return null;
      if (ai === null || ai === undefined) return null;
      if (ai > 4) return null;
      if (hours && hours > 165) return null;
      return age;
    },
  },
  {
    slug: 'gakusei-arbeit',
    short_ja: '学生バイト→正社員',
    title_ja: '学生バイトから正社員化が多い職業',
    description_ja: '学生時代のアルバイトから正社員登用ルートが整備されている職業群。サービス・販売・製造系等。',
    cautions_ja: [
      '正社員化までの期間と条件確認',
      'バイト時の評価が問われる',
      '本業 (学業) との両立',
    ],
    advantages_ja: [
      '実務経験を積んだ状態で就職',
      '社風・業務内容を理解した上で選択',
      '採用ハードルが比較的低い',
    ],
    og_eyebrow: 'CAREER · 学生バイト',
    recommend: (d) => {
      const sid = d.sector?.id;
      const workers = d.stats?.workers ?? 0;
      const certs = (d.related_certs_ja ?? []).length;
      if (!['service', 'hanbai', 'seizo', 'keiseki'].includes(sid ?? '')) return null;
      if (certs >= 2) return null;
      if (workers < 10000) return null;
      return workers / 1000;
    },
  },
  {
    slug: 'shufu-fukki',
    short_ja: '主婦復職・育休復帰',
    title_ja: '主婦復職・育休復帰におすすめの職業',
    description_ja: 'ブランクからの復帰や時短勤務に対応しやすい職業群。育児・家庭との両立を前提とした働き方。',
    cautions_ja: [
      '正社員 vs 派遣・パートの選択',
      '保育園・学童との連携',
      'スキル更新のための学習時間',
    ],
    advantages_ja: [
      'ブランク許容度が高い分野',
      '時短勤務・在宅可能性',
      '同じ立場の同僚が多い',
    ],
    og_eyebrow: 'CAREER · 主婦復職',
    recommend: (d) => {
      const hours = d.stats?.monthly_hours;
      const ai = d.ai_risk?.score;
      if (!hours || hours > 165) return null;
      if (ai === null || ai === undefined) return null;
      if (ai > 5) return null;
      return -hours;
    },
  },
  {
    slug: 'career-change',
    short_ja: '他業種からのキャリアチェンジ',
    title_ja: '他業種からのキャリアチェンジにおすすめ',
    description_ja: '異業種からの参入が現実的で、過去スキルの一部が活かせる職業群。完全未経験からも可能性のある分野。',
    cautions_ja: [
      '前職スキルの転用可能性',
      '一時的な年収ダウンの覚悟',
      '学び直し期間 (1-3 年) の前提',
    ],
    advantages_ja: [
      '異分野の視点が価値に',
      '人手不足分野は中途歓迎',
      '40 代以降の参入も可能な分野あり',
    ],
    og_eyebrow: 'CAREER · 転換',
    recommend: (d) => {
      const ai = d.ai_risk?.score;
      const workers = d.stats?.workers ?? 0;
      const certs = (d.related_certs_ja ?? []).length;
      if (ai === null || ai === undefined) return null;
      if (ai > 5) return null;
      if (certs >= 3) return null;
      if (workers < 30000) return null;
      return workers / 10000;
    },
  },
];
