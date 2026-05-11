/**
 * rankings.ts — data utilities for the ja/rankings/* pages.
 *
 *   - loadOccupations()      reads public/data.treemap.json
 *   - buildRankings()        applies top-N sort/filter rules per ranking slug
 *   - buildHubData()         global stats / sector insights for the hub page
 *
 * Source: public/data.treemap.json (552 records). Field names differ from the
 * per-occupation detail files: name_ja → title_ja, hours → monthly_hours,
 * age → average_age (a quirk preserved for backward-compat with downstream).
 *
 * Reads the file via fs at import time (Astro frontmatter).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const TREEMAP_PATH = join(REPO_ROOT, 'public', 'data.treemap.json');
const DETAIL_DIR = join(REPO_ROOT, 'public', 'data.detail');

export const TOP_N = 30;

export interface Occupation {
  id: number;
  title_ja: string | null;
  ai_risk: number | null;
  risk_band: string | null;
  workers: number | null;
  salary: number | null;
  monthly_hours: number | null;
  average_age: number | null;
  recruit_wage: number | null;
  /** 有効求人倍率 (Phase 2 で必要) */
  recruit_ratio: number | null;
  demand_band: string | null;
  sector_id: string;
  sector_ja: string;
  /** Phase 2: 学歴分布 (JA-key %、treemap.json の education_pct から) */
  education_pct: Record<string, number> | null;
  /** Phase 2: 雇用形態分布 (JA-key %、treemap.json の employment_type から) */
  employment_type: Record<string, number> | null;
  /** Phase 2: 関連資格リスト (data.detail/<id>.json の related_certs_ja から、別 fetch) */
  certs: ReadonlyArray<string>;
  /** Phase 2: 派生時給 (recruit_wage_man_yen × 10000 / 160h、なければ null) */
  hourly_wage: number | null;
}

interface TreemapRecord {
  id: number;
  name_ja: string | null;
  salary: number | null;
  workers: number | null;
  hours: number | null;
  age: number | null;
  recruit_wage: number | null;
  recruit_ratio: number | null;
  ai_risk: number | null;
  risk_band: string | null;
  demand_band: string | null;
  sector_id: string;
  sector_ja: string;
  education_pct: Record<string, number> | null;
  employment_type: Record<string, number> | null;
}

interface DetailFileMinimal {
  id: number;
  related_certs_ja?: string[];
}

let cached: Occupation[] | null = null;

/**
 * Phase 2: load related_certs_ja for every occupation by reading
 * data.detail/<padded>.json. Cached. Detail files are small (~3.5 KB gz)
 * and we only need 1 field, but fs reads at module-init keep the API
 * synchronous (Astro frontmatter requirement).
 */
let _certsById: Map<number, ReadonlyArray<string>> | null = null;
function loadCertsById(): Map<number, ReadonlyArray<string>> {
  if (_certsById) return _certsById;
  const out = new Map<number, ReadonlyArray<string>>();
  let files: string[];
  try {
    files = readdirSync(DETAIL_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    _certsById = out;
    return out;
  }
  for (const f of files) {
    try {
      const raw = readFileSync(join(DETAIL_DIR, f), 'utf-8');
      const d = JSON.parse(raw) as DetailFileMinimal;
      out.set(d.id, d.related_certs_ja ?? []);
    } catch {
      // ignore — corrupted file shouldn't crash module init
    }
  }
  _certsById = out;
  return out;
}

export function loadOccupations(): Occupation[] {
  if (cached) return cached;
  const raw = readFileSync(TREEMAP_PATH, 'utf-8');
  const records = JSON.parse(raw) as TreemapRecord[];
  const certsById = loadCertsById();
  cached = records.map((d) => {
    // 派生時給: recruit_wage は 月 万円。160h/month で割って 時給(円) に変換。
    // null や 0 のときは null。
    const hourly = d.recruit_wage && d.recruit_wage > 0
      ? Math.round((d.recruit_wage * 10000) / 160)
      : null;
    return {
      id: d.id,
      title_ja: d.name_ja ?? null,
      ai_risk: d.ai_risk ?? null,
      risk_band: d.risk_band ?? null,
      workers: d.workers ?? null,
      salary: d.salary ?? null,
      monthly_hours: d.hours ?? null,
      average_age: d.age ?? null,
      recruit_wage: d.recruit_wage ?? null,
      recruit_ratio: d.recruit_ratio ?? null,
      demand_band: d.demand_band ?? null,
      sector_id: d.sector_id ?? '',
      sector_ja: d.sector_ja ?? '',
      education_pct: d.education_pct ?? null,
      employment_type: d.employment_type ?? null,
      certs: certsById.get(d.id) ?? [],
      hourly_wage: hourly,
    };
  });
  return cached;
}

// ---------------------------------------------------------------------------
// Phase 2: filter / classification helpers (sector groups, education tiers,
// employment-type pivots). These keep the buildRankings() body readable —
// new rankings should use these helpers instead of inline boolean conditions.
// ---------------------------------------------------------------------------

/** Sector groups used by physical / interpersonal / craft rankings. */
const PHYSICAL_SECTORS: ReadonlySet<string> = new Set([
  'seizo', 'maint', 'kensetu', 'noringyo', 'keiseki',
]);
const INTERPERSONAL_SECTORS: ReadonlySet<string> = new Set([
  'iryo', 'fukushi', 'kyoiku', 'hanbai', 'service',
]);
const CRAFT_SECTORS: ReadonlySet<string> = new Set([
  'seizo', 'maint', 'kensetu', 'keiseki', 'noringyo',
]);
const PUBLIC_SECTORS: ReadonlySet<string> = new Set([
  'hoan', // 保安・公安 (police/fire/etc)
]);

function inSectorSet(o: Occupation, set: ReadonlySet<string>): boolean {
  return set.has(o.sector_id);
}

/**
 * Pull a 学歴 key from education_pct (JA keys: 高卒 / 大卒 / 修士 etc.).
 * Returns 0 when missing — safe for sort comparisons.
 */
function eduPct(o: Occupation, key: string): number {
  return o.education_pct?.[key] ?? 0;
}

/**
 * 大学院卒比率 = 修士 + 博士 (combined).
 */
function gradPct(o: Occupation): number {
  return eduPct(o, '修士課程卒（修士と同等の専門職学位を含む）') + eduPct(o, '博士課程卒');
}

/**
 * Pull 雇用形態 key (JA: 正規 / パートタイマー / 自営、フリーランス etc.).
 */
function empPct(o: Occupation, key: string): number {
  return o.employment_type?.[key] ?? 0;
}

// ---------------------------------------------------------------------------
// Constants and metadata (mirrors scripts/build_rankings.py).
// ---------------------------------------------------------------------------

export const DEMAND_SCORE: Record<string, number> = {
  hot: 4,
  warm: 3,
  cool: 2,
  cold: 1,
};

export const DEMAND_JA: Record<string, string> = {
  hot: '需要高',
  warm: 'やや高',
  cool: '安定',
  cold: '低',
};

// Slug + display metadata live in rankings-meta.ts (a pure-data module
// with no fs imports) so api/og.tsx can also consume them without
// pulling fs into the Edge Function bundle. Re-exported here for
// back-compat with existing consumers of `RankingSlug` and
// `ALL_RANKINGS` from this file.
import { RANKING_META, type RankingSlug as RankingSlugMeta } from './rankings-meta.js';

export type RankingSlug = RankingSlugMeta;

export const ALL_RANKINGS: ReadonlyArray<readonly [RankingSlug, string, string]> =
  RANKING_META.map((m) => [m.slug, m.name_ja, m.description_ja] as const);

export const FAQS: Record<RankingSlug, ReadonlyArray<readonly [string, string]>> = {
  'ai-risk-high': [
    ['AIに奪われやすい仕事の特徴は？', 'データ入力・定型処理・パターン認識が中心の業務はAI代替リスクが高い傾向にあります。反復的なルーティンワークほどスコアが高くなります。'],
    ['AIリスクが高い仕事は将来なくなりますか？', '「なくなる」のではなく「変わる」可能性が高いです。AIはタスクの一部を代替・補助しますが、職業そのものが消滅するとは限りません。'],
    ['AIリスクが高い職業から転職するには？', '身体性・対人スキル・創造性を活かせる職種への転換が有効です。同セクター内でより安全な職業を探すのも一つの方法です。'],
  ],
  'ai-risk-low': [
    ['AIに奪われない仕事の共通点は？', '身体的な動作、対面での人間関係構築、高度な状況判断が必要な職業はAI代替が難しい傾向にあります。'],
    ['AI影響度が低い仕事は将来安泰ですか？', 'AI代替リスクは低いですが、少子高齢化や産業構造変化など他の要因も考慮が必要です。'],
    ['AIリスクが低くて年収も高い職業は？', '医師・弁護士・建設系専門職などが該当します。「高年収×低AIリスク」ランキングもご覧ください。'],
  ],
  'salary-safe': [
    ['年収が高くてAIに奪われにくい仕事は？', '医師・法律専門家・建設系技術者などが代表的です。専門性と対人スキルの組み合わせが強みになっています。'],
    ['高年収×低AIリスクの職業に就くには？', '多くが国家資格や高度な専門教育を必要としますが、建設・保安分野では実務経験重視のキャリアパスもあります。'],
    ['AIリスクが低くても年収に差があるのはなぜ？', '必要な資格の難易度、労働条件、需給バランスなどが年収を左右します。'],
  ],
  workers: [
    ['日本で最も就業者が多い職業は？', '一般事務職が最も多く、次いで販売・接客系の職業が続きます。生活に密接な職業ほど就業者が多い傾向です。'],
    ['就業者が多い職業のAIリスクは？', '事務・販売系は比較的AI影響度が高い傾向にあり、大規模な職業構造の変化が予想されます。'],
    ['就業者数と求人数は比例しますか？', '必ずしも比例しません。就業者が多くても離職率が低ければ求人は少なく、人手不足の分野では就業者が少なくても求人が多い場合があります。'],
  ],
  salary: [
    ['日本で最も年収が高い職業は？', '医師・パイロット・弁護士など高度な専門資格を必要とする職業が上位に入ります。'],
    ['高年収の職業に共通する特徴は？', '高度な資格・長期の教育投資・強い参入障壁のいずれかを持つ職業が多い傾向にあります。'],
    ['AI時代でも高年収を維持できる職業は？', '身体性や対人関係が重要な高専門職はAI影響度が低く、高年収を維持しやすいと考えられます。'],
  ],
  'entry-salary': [
    ['初任給が高い職業は？', 'IT系エンジニア・医療系専門職・法律系など、即戦力としての専門知識が評価される職業が上位です。'],
    ['初任給と平均年収の関係は？', '初任給が高い職業は平均年収も高い傾向にありますが、昇給カーブは職種によって大きく異なります。'],
    ['新卒で高い初任給を得るには？', '理工系・医療系の専門学位、IT関連の資格やスキルが評価される傾向にあります。'],
  ],
  'young-workforce': [
    ['若い人が多い職業の特徴は？', 'IT・クリエイティブ・サービス業など、比較的新しい産業や体力を要する職種で平均年齢が低い傾向にあります。'],
    ['平均年齢が低い職業は離職率が高い？', '一概には言えませんが、若年層が多い職種では業界内の流動性が高い傾向にあります。'],
    ['若い人が多い職業のAIリスクは？', 'IT系は高め、サービス・建設系は低めと、業種によって二極化しています。'],
  ],
  'short-hours': [
    ['残業が少ない職業は？', '教育系・公務系・一部の専門職で月間労働時間が短い傾向にあります。データは統計上の平均値です。'],
    ['労働時間が短くて年収が高い職業は？', '医師（一部の科）・大学教員・法律専門家などが該当しますが、個人差が大きい点に注意が必要です。'],
    ['ワークライフバランスの良い職業の見つけ方は？', '労働時間だけでなく、勤務時間帯の柔軟性やリモートワーク可否なども合わせて検討すると良いでしょう。'],
  ],
  'high-demand': [
    ['今、最も求人が多い職業は？', '介護・建設・IT系が人手不足の傾向が強く、求人需要が高い状態が続いています。'],
    ['人手不足の職業は年収が上がる？', '需要と供給のバランスから、人手不足の職業では賃金上昇圧力が生じやすい傾向にあります。'],
    ['求人需要が高い職業に転職するメリットは？', '採用されやすく待遇改善の交渉もしやすい傾向にあります。ただし人手不足の理由も確認が重要です。'],
  ],

  // ── Phase 2: 単軸 (5) ──
  'hourly-wage': [
    ['時給ベースが高い職業の特徴は？', '専門資格を要する医療系・士業、もしくは深夜・危険勤務手当が出る職業が時給ベースで高くなる傾向にあります。'],
    ['時給と年収はどちらを見るべき？', '時短勤務やパート選択が前提なら時給、フルタイム正社員なら年収を比較するのが基本です。本ページの時給は求人賃金 (月) を 160 時間で割った推計値です。'],
    ['時給が高くて AI に強い職業は？', '医療系専門職や士業など、現場判断や対人スキルを伴う職業は時給が高く AI 影響度も低めの傾向です。'],
  ],
  'recruit-ratio': [
    ['求人倍率が高いとはどういうこと？', '求人倍率が 1.0 を超えると 1 人の求職者に対して複数の求人がある「売り手市場」状態。介護や建設、運輸業などで顕著です。'],
    ['求人倍率と年収の関係は？', '人手不足が深刻な業種では時給・賃金の上昇圧力が強くなる傾向ですが、過酷さがその一因のことも多いため労働条件全般の確認が必要です。'],
    ['求人倍率が高い職業に転職するメリットは？', '採用されやすく交渉余地も大きい一方、なぜ人手不足なのかを必ず確認しましょう。'],
  ],
  'aging-workforce': [
    ['シニア中心の職業の特徴は？', '長年の経験・人脈・現場判断が価値を持つ職業、または若手の参入が少ない伝統的な業種で平均年齢が高くなる傾向です。'],
    ['平均年齢が高い職業は将来性が低い？', '一概には言えません。継承課題はあるものの、需要側がまだ強い分野では中高年からの参入チャンスでもあります。'],
    ['シニア中心の職業は AI 影響度が低い？', '熟練判断や対人信頼を要する分野で平均年齢も AI リスクも低い傾向。ただし業種ごとの個別確認が重要です。'],
  ],
  'monthly-hours-long': [
    ['労働時間が長い職業の特徴は？', '建設・運輸・医療・サービス業など、現場稼働時間や緊急対応が必要な職業で月間労働時間が長くなる傾向にあります。'],
    ['労働時間が長くても年収が高ければ良い？', '時給換算で見ると年収だけでは判断できません。長時間労働が常態化している業種は健康面・継続可能性の観点でも要検討。'],
    ['労働時間を短くするには？', '同じセクター内でも事業所規模や雇用形態でバラつきがあります。短時間で年収が高い職業を探すなら「労働時間が短い職業」ランキングをご覧ください。'],
  ],
  'recruit-ratio-low': [
    ['求人倍率が低い職業とは？', '1.0 を下回る「買い手市場」の職業。応募者数に対して求人数が少なく、採用競争が厳しい状態です。'],
    ['なぜ求人倍率が低い職業が存在する？', '人気職業 (クリエイティブ系・士業など)、参入障壁が高い職業、または市場規模が縮小傾向の職業で求人倍率が低くなる傾向です。'],
    ['倍率が低い職業を狙うコツは？', '専門性・資格・実績を前もって積み、新卒や第二新卒のチャンスを狙うのが基本戦略です。'],
  ],

  // ── Phase 2: AI 軸派生 (6) ──
  'ai-replaced-soon': [
    ['AI 影響度 8/10 以上の職業はもうすぐなくなる？', '「業務再設計が急務」というシグナル。職業そのものが消えるとは限りませんが、5 年以内に業務内容が大きく変わる可能性が高い職業群です。'],
    ['AI 高暴露職業から転職するには？', '身体性・対人スキル・現場判断を活かせる関連職や、AI を使いこなす側 (AI フロンティア) への移行が選択肢です。'],
    ['AI 影響度はどう測定された？', 'Claude Opus 4.7 が IPD タスク情報を基にタスクレベル代替可能性を 0-10 で評価。本サイトの独自分析 (非公式) です。'],
  ],
  'ai-resistant-craft': [
    ['伝統技能職が AI 抗性が高い理由は？', '手技・経験的判断・現場の身体的調整は AI で代替しにくく、製造・建設・メンテ・農林の現場職が低 AI 影響度のまま残りやすい傾向です。'],
    ['技能職への参入は今からでも遅くない？', '需要が安定し人手不足の領域も多く、中途参入のルートが整備されている分野もあります。資格・徒弟制度の有無を確認しましょう。'],
    ['技能職の年収はどうですか？', '個別性が大きく独立後は青天井ですが、雇われ職人の段階では 300-500 万円帯が中心。本ページの年収データを参照してください。'],
  ],
  'ai-at-risk-but-paid': [
    ['「AI リスク高だが高年収」とはどういう状態？', 'AI で代替可能性が高い (8+/10) のに現状の年収はまだ高い職業群。今は稼げるが、5-10 年での再設計が前提の「要注意組」です。'],
    ['なぜ年収を下げずに済んでいる？', '専門性の認知バイアス、企業の人件費構造、規制保護、人材転換コストなど複合要因。AI コーディングの普及で IT 系の一部が該当します。'],
    ['今からこの分野に入るのは危険？', '5-10 年の時間軸で計画。AI を使いこなす側に立つ・上流業務にシフトするなど、職業内での再ポジショニングが鍵です。'],
  ],
  'ai-augmented': [
    ['AI で「補強される」とはどういう意味？', 'AI が業務を一部肩代わりすることで生産性が上がり、その分だけ人がより複雑な部分に注力できる状態。AI 影響度 4-6 の職業に多く見られます。'],
    ['AI 補強域の職業は将来安定？', '完全代替されるリスクは低めですが、AI ツールを使いこなせるかどうかでパフォーマンス差が広がります。学習意欲が継続的に必要です。'],
    ['AI 補強職業に向くスキルは？', 'AI ツールを評価・編集する判断力、複数案の比較・統合力。基礎的な批判的思考と業界経験の組合せが優位性になります。'],
  ],
  'ai-frontier': [
    ['AI を使いこなす側の職業とは？', 'IT・通信セクターで AI 影響度が中〜高 (5+) の職業。AI で業務効率を上げる側に立っており、AI 自体を活用・開発する立場です。'],
    ['AI フロンティア職に必要なスキルは？', 'プログラミング基礎、データリテラシー、AI ツール (LLM, AI コーディング等) の使いこなし、新技術への継続学習。'],
    ['AI フロンティア職の AI 影響度は何故高い？', 'AI を使う側でもタスク自体が「AI で完結可能」なので影響度自体は高めに出ます。ただし業務内容が AI と共進化する形で残る可能性が高い分野です。'],
  ],
  'ai-stable-employment': [
    ['正規雇用率が高くて AI 安全な職業は？', '医療・福祉・建設・公安系など、低 AI 影響かつ正社員が中心の分野。長期的なキャリア安定性が期待できる職業群です。'],
    ['正社員以外の働き方は不利？', '一概に不利とは言えませんが、企業独自の福利厚生や昇給機会への接点は正社員の方が多い傾向です。'],
    ['この組合せで稼げる職業は？', '医師・薬剤師・看護師・建築士など、専門資格 + 正規雇用 + 低 AI リスクが揃う職業群です。'],
  ],

  // ── Phase 2: 組合せ (8) ──
  'ai-safe-high-demand': [
    ['人手不足かつ AI 安全な職業の魅力は？', '採用されやすく賃金交渉余地もあり、かつ AI 代替リスクが低い「鉄板」キャリア候補。介護・建設・医療系が中心です。'],
    ['この組合せの落とし穴は？', '需要が高くても労働強度や緊急対応の負担が大きいことが多い。健康面・ライフバランスとの整合性を必ず確認しましょう。'],
    ['未経験でも参入できる？', '介護・建設の入口職は資格・年齢を問わない求人が多く、未経験参入のルートが比較的整備されています。'],
  ],
  'ai-safe-short-hours': [
    ['労働時間が短くて AI 安全な職業は？', '教育系・公務系・一部の専門職で、月間労働時間が短く AI 影響度も低い職業が該当します。'],
    ['短時間 × 安全 × 高年収は両立できる？', '医師の一部の科や大学教員、士業の一部が該当しますが、いずれも参入難度が高い専門職です。'],
    ['短時間で安全な職業の見分け方は？', '勤務時間の柔軟性、リモート可能性、シフトの安定性も合わせて確認すると見えやすくなります。'],
  ],
  'ai-safe-young-workforce': [
    ['若手中心 × AI 安全な職業の特徴は？', 'IT 補助系・サービス系・現場系で平均年齢が低く、対人や身体性で AI 抗性も持つ職業群です。'],
    ['若手中心ということは離職率が高い？', '一概には言えませんが、業界の流動性が高い・体力的負荷が大きいケースが多く、長期キャリアの設計は別途必要です。'],
    ['新卒で狙うべき安全分野は？', '看護・介護・建設技能職・教育系などの低 AI リスク × 安定需要の領域です。'],
  ],
  'ai-safe-no-license': [
    ['資格不要で AI に強い職業は？', '身体性・対人スキル・現場判断を要する職業の多くで、資格よりも実務経験が重視されます。'],
    ['資格なしで稼げる職業は？', '建設技能職・運輸・接客・営業・サービス系の一部で、無資格スタート + 経験で稼ぐパターンが見られます。'],
    ['資格を取った方が安全？', '長期的なキャリア安全度を上げますが、無資格でも始めて働きながら資格取得するルートも一般的です。'],
  ],
  'ai-safe-physical': [
    ['身体性が必要な職業は AI に強い？', '手の感覚・現場判断・身体的調整を要する職業は、AI で代替されにくい構造的優位性を持ちます。'],
    ['身体性 × AI 安全の代表例は？', '建設職人・整備士・農林漁業・配管工・電気工事士など、製造・建設・メンテナンス系が中心です。'],
    ['身体性職業の弱点は？', '体力依存の継続可能性が課題。年齢を重ねると独立・指導側に回るキャリアパスが一般的です。'],
  ],
  'ai-safe-interpersonal': [
    ['対人スキル中心の職業は AI に強い？', '感情の機微・信頼関係・即興的な調整を要する職業は AI で代替しにくく、医療・福祉・教育・販売・サービス系が該当します。'],
    ['対人 × AI 安全の代表例は？', '看護師・介護福祉士・保育士・教師・販売員・接客スタッフなどです。'],
    ['対人職の課題は？', '感情労働の負荷、シフト勤務の身体負担。長期継続には自己ケアの設計が重要です。'],
  ],
  'high-salary-high-demand': [
    ['高年収 × 高需要の職業は？', '医療系・建設系の専門職、IT 系の上流職など、専門性 + 人手不足が重なる分野。賃金上昇圧力も働きます。'],
    ['この組合せに就くには？', '長期の専門教育 (国家資格・学位) または現場経験の積み上げが基本。タイムフレームは 5-10 年。'],
    ['高需要が続くか見極める方法は？', '少子高齢化の影響を強く受ける医療・介護系は中長期で高需要が継続見込み。技術系は技術トレンドに敏感です。'],
  ],
  'high-salary-young-entry': [
    ['初任給が高くて若手が活躍できる職業は？', 'IT エンジニア系・コンサル・金融系の一部で、新卒から高めの初任給かつ平均年齢が若い分野です。'],
    ['初任給が高ければ将来も安泰？', '初任給は出発点。年収カーブと AI 影響度を併せて確認しないと長期的な評価はできません。'],
    ['新卒で狙うべき分野は？', 'IT 系は AI 影響度が高めの面もありますが、AI を使いこなす側に立てば優位性を持続できます。'],
  ],

  // ── Phase 2: 教育・資格軸 (5) ──
  'license-required': [
    ['国家資格が必要な職業の特徴は？', '医療・士業・建設・福祉・教育系の専門職で、参入障壁が明確に設定されている職業群です。'],
    ['資格があれば AI に強い？', '法的に「資格保有者しかできない」業務範囲があるため、参入障壁的に AI 代替が起きにくい傾向があります。ただし業務内訳の AI 化は別途進行します。'],
    ['資格職の年収は本当に高い？', '資格取得コストとリターンの非対称性は大きく、難関資格ほど年収が高い傾向。ただし市場の需給状況にも左右されます。'],
  ],
  'no-license-required': [
    ['無資格で就けて AI 安全な職業は？', '建設技能職・運輸・対人サービス・農林水産系などの一部で、資格不要かつ AI 影響度も低い職業が存在します。'],
    ['資格なしで始める利点は？', 'スタート時の参入コストが低く、向き不向きを実務経験で確認しながら専門性を積み上げられます。'],
    ['無資格 × 安全からのキャリアアップは？', '勤務しながら関連資格取得、実績ベースの独立、管理職昇進など複数のルートがあります。'],
  ],
  'high-school-ok': [
    ['高卒で目指せる職業の特徴は？', '建設・製造・運輸・サービス・公安系の現場職で、実務能力と適性が学歴より重視される職業群です。'],
    ['高卒で AI に強い職業は？', '身体技能・対人スキル中心の職業は学歴ハードルが低く AI 影響度も低めです。本ランキングは AI 安全度も併記しています。'],
    ['高卒からのキャリアアップは？', '勤務年数による昇進・資格取得・独立開業など、学歴に依存しないキャリア形成のルートが多くあります。'],
  ],
  'university-required': [
    ['大卒以上が中心の職業の特徴は？', '専門知識・抽象的思考・複雑な意思決定を要する職業で、医療・士業・研究・上流 IT 等が該当します。'],
    ['大卒比率が高い = AI リスクが高い？', '一概には言えません。研究や臨床判断を要する分野は AI 影響度が低めですが、事務系・分析系の一部は AI 影響度が高い傾向です。'],
    ['大卒で安定 × 高年収な分野は？', '医師・士業・公務員・大企業総合職など、教育投資のリターンが見込める分野が候補です。'],
  ],
  'graduate-school-required': [
    ['大学院卒が必要な職業は？', '研究職・大学教員・専門医・特定の士業など、博士・修士課程修了が前提となる高度専門職です。'],
    ['大学院投資のリターンは？', '長期教育コストは大きいですが、専門領域での独占的なキャリアが構築でき、AI 影響度も低めの傾向です。'],
    ['大学院卒中心職に向く人は？', '長期の探究を厭わず、抽象概念や複雑な体系に取り組むことを楽しめる人。学位は通過点で、その先の研究実績が本番です。'],
  ],

  // ── Phase 2: ニッチ (6) ──
  'public-sector': [
    ['公的機関・公務員系職業の特徴は？', '保安・公安・公共サービス系で、安定雇用・年功的昇進・福利厚生が手厚い反面、業務範囲は法令で定められています。'],
    ['公務員系は AI に置き換わる？', '法的な存在意義から職業自体が消えるリスクは低めですが、業務内訳のうち事務的な部分は AI 化が進行する見込みです。'],
    ['公的機関を目指すには？', '公務員試験 (国家・地方・専門職) が基本ルート。試験対策は 1-2 年の準備が標準的です。'],
  ],
  'freelance-friendly': [
    ['フリーランス向きの職業は？', '専門スキルが個人ベースで完結する職業 (デザイン・執筆・IT・コンサル等) と、現場直結の自営業 (技能職・士業) が二大分類です。'],
    ['フリーランスのメリットは？', '時間・場所・取引先の選択肢が広く、上限年収が高い反面、収入の不安定さと自己管理が前提となります。'],
    ['フリーランス参入のハードルは？', 'クライアント獲得経路、技能の市場価値、税務・社保の自己管理がハードル。独立前の業務委託経験が現実的な準備期間です。'],
  ],
  'self-employed-typical': [
    ['独立・開業が典型の職業とは？', '美容師・調理師・建設職人・士業など、雇用形態として独立がキャリアの自然な到達点とされる職業群です。'],
    ['独立すると年収は上がる？', '上限が大きく上がる一方、軌道に乗るまで 3-5 年は逆に下がるケースが多いです。事業計画と資金繰りの設計が重要。'],
    ['独立を目指すならどう準備する？', '現職での技能・人脈・顧客の蓄積、副業ステップ、開業に必要な資金 200-1000 万円帯の準備が王道です。'],
  ],
  'large-workforce-stable': [
    ['大規模 × AI 安全な職業の意義は？', '日本全体の労働人口に占める比重が大きく、かつ AI 影響度も低い「日本の中軸を支える」職業群です。'],
    ['大規模職業の典型は？', '看護師・介護福祉士・建設職人・運輸・小売・サービス系など、生活に密着した広範な職業が該当します。'],
    ['この組合せの将来は？', '少子高齢化の影響で人手不足が継続見込み。需要側が強く、待遇改善の圧力も働きやすい構造です。'],
  ],
  'regulated-protected': [
    ['規制で守られた職業とは？', '関連資格が複数必要かつ AI 影響度も低い、参入障壁と AI 抗性の両方を備えた職業群です。'],
    ['規制保護があれば安泰？', '法的に守られている業務範囲がある一方、規制緩和や業務内訳の自動化は時間軸で進行します。職業自体ではなく業務再設計が課題。'],
    ['規制保護職の代表例は？', '医師・薬剤師・士業 (弁護士・公認会計士等)・建築士など、複数の国家資格を要する高度専門職が中心です。'],
  ],
  'low-stress-stable': [
    ['低ストレスで安定的な職業は？', '労働時間が短く AI 影響度も低い職業群。教育系・専門職の一部・公務系の一部などです。'],
    ['ストレスが低い職業は給料も低い？', '一概にトレードオフではなく、専門性が高ければ低時間 × 高年収も両立可能。本ランキングは年収も併記しています。'],
    ['長く続けられる職業を見極めるには？', '労働時間・対人ストレス・身体負担・学習継続性の 4 軸で評価。本サイトの 5 軸プロファイルも参考にしてください。'],
  ],
};

// ---------------------------------------------------------------------------
// Sort / filter rules per ranking (mirrors scripts/build_rankings.py:main).
// ---------------------------------------------------------------------------

function byKeyDesc<T>(items: T[], key: (o: T) => number | null | undefined, tie: (o: T) => number = () => 0): T[] {
  return [...items].sort((a, b) => {
    const av = key(a) ?? 0;
    const bv = key(b) ?? 0;
    if (bv !== av) return bv - av;
    return tie(a) - tie(b);
  });
}

function byKeyAsc<T>(items: T[], key: (o: T) => number | null | undefined, tie: (o: T) => number = () => 0): T[] {
  return [...items].sort((a, b) => {
    const av = key(a) ?? 0;
    const bv = key(b) ?? 0;
    if (av !== bv) return av - bv;
    return tie(a) - tie(b);
  });
}

export interface RankingResult {
  slug: RankingSlug;
  items: Occupation[];
  /** Stats prepared for the page header `<dl class="stats">`. */
  statBlocks: ReadonlyArray<readonly [string, string]>;
  /** Optional extra metric per item, rendered before salary. Mirrors extra_col_fn. */
  extraColFn?: (o: Occupation) => string[];
  /** Whether to show the salary chip. */
  showSalary: boolean;
  faqItems: ReadonlyArray<readonly [string, string]>;
  // Page metadata (mirrors render_page args).
  title: string;
  seoDesc: string;
  h1Text: string;
  /** Allowed to contain inline <strong> markup; rendered raw. */
  subText: string;
  introText: string;
}

function safeMean(items: Occupation[], key: keyof Occupation): number {
  const vals = items
    .map((o) => o[key])
    .filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return Math.trunc(n).toLocaleString('en-US');
}

export interface RankingsBundle {
  results: Map<RankingSlug, RankingResult>;
  hub: {
    globalStats: ReadonlyArray<readonly [string, string]>;
    insights: string[];
    cards: Array<{ slug: RankingSlug; name: string; desc: string; count: number; preview: string }>;
  };
}

export function buildRankings(): RankingsBundle {
  const occs = loadOccupations();
  const scored = occs.filter((o) => o.ai_risk !== null);
  const withSalary = occs.filter((o) => o.salary && o.ai_risk !== null);

  const allMeanRisk = safeMean(scored, 'ai_risk');
  const allMeanSalary = safeMean(occs.filter((o) => o.salary), 'salary');
  const allWorkers = occs.reduce((s, o) => s + (o.workers ?? 0), 0);

  // 1. AI risk high — sort -ai_risk, id asc
  const aiHigh = byKeyDesc(scored, (o) => o.ai_risk, (o) => o.id).slice(0, TOP_N);
  const meanHigh = safeMean(aiHigh, 'ai_risk');

  // 2. AI risk low — sort ai_risk asc, id asc
  const aiLow = byKeyAsc(scored, (o) => o.ai_risk, (o) => o.id).slice(0, TOP_N);
  const meanLow = safeMean(aiLow, 'ai_risk');

  // 3. Salary x safe — filter ai_risk<=5, sort -salary then ai_risk then id
  const salarySafe = withSalary
    .filter((o) => (o.ai_risk ?? 0) <= 5)
    .sort((a, b) => {
      const sa = a.salary ?? 0;
      const sb = b.salary ?? 0;
      if (sb !== sa) return sb - sa;
      const ra = a.ai_risk ?? 0;
      const rb = b.ai_risk ?? 0;
      if (ra !== rb) return ra - rb;
      return a.id - b.id;
    })
    .slice(0, TOP_N);
  const meanSalarySS = safeMean(salarySafe, 'salary');
  const meanRiskSS = safeMean(salarySafe, 'ai_risk');

  // 4. Workers
  const byWorkers = byKeyDesc(
    occs.filter((o) => o.workers),
    (o) => o.workers,
  ).slice(0, TOP_N);
  const totalWorkersTop = byWorkers.reduce((s, o) => s + (o.workers ?? 0), 0);

  // 5. Salary (pure)
  const bySalary = byKeyDesc(
    occs.filter((o) => o.salary),
    (o) => o.salary,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanSalaryTop = safeMean(bySalary, 'salary');

  // 6. Entry salary
  const byEntry = byKeyDesc(
    occs.filter((o) => o.recruit_wage),
    (o) => o.recruit_wage,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanEntry = safeMean(byEntry, 'recruit_wage');

  // 7. Young workforce
  const byYoung = byKeyAsc(
    occs.filter((o) => o.average_age),
    (o) => o.average_age,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanAgeYoung = safeMean(byYoung, 'average_age');

  // 8. Short hours
  const byHours = byKeyAsc(
    occs.filter((o) => o.monthly_hours),
    (o) => o.monthly_hours,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanHours = safeMean(byHours, 'monthly_hours');

  // 9. High demand
  let withDemand = occs.filter((o) => o.demand_band && (DEMAND_SCORE[o.demand_band] ?? 0) >= 3);
  if (withDemand.length < TOP_N) {
    withDemand = occs.filter((o) => o.demand_band);
  }
  const byDemand = [...withDemand]
    .sort((a, b) => {
      const ds = (DEMAND_SCORE[b.demand_band ?? ''] ?? 0) - (DEMAND_SCORE[a.demand_band ?? ''] ?? 0);
      if (ds !== 0) return ds;
      const ss = (b.salary ?? 0) - (a.salary ?? 0);
      if (ss !== 0) return ss;
      return a.id - b.id;
    })
    .slice(0, TOP_N);
  const hotCount = byDemand.filter((o) => o.demand_band === 'hot').length;
  const warmCount = byDemand.filter((o) => o.demand_band === 'warm').length;

  // ---- Build per-ranking page metadata ----

  const results = new Map<RankingSlug, RankingResult>();

  results.set('ai-risk-high', {
    slug: 'ai-risk-high',
    items: aiHigh,
    showSalary: true,
    faqItems: FAQS['ai-risk-high'],
    title: 'AIに奪われる仕事ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `AI影響度が最も高い職業TOP${TOP_N}。平均スコア${meanHigh.toFixed(1)}/10。AI代替リスク・年収・就業者数を一覧比較。Claude Opus 4.7独自分析（非公式）。`,
    h1Text: `AIに奪われる仕事 TOP${TOP_N}`,
    subText: `AI 影響度が最も <strong>高い</strong> 職業ランキング（${scored.length} 職業中）`,
    introText: '厚労省の職業データに基づき、Claude Opus 4.7がタスクレベルでAI影響度を分析。10段階中スコアが高い職業ほど、業務の多くがAIで代替・補助される可能性があります。ただし「仕事がなくなる」という意味ではありません。',
    statBlocks: [
      ['対象職業数', `${scored.length}`],
      ['TOP30 平均 AI 影響', `${meanHigh.toFixed(1)} / 10`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(aiHigh, 'salary'))} 万円`],
      ['TOP30 平均年齢', `${safeMean(aiHigh, 'average_age').toFixed(1)} 歳`],
    ],
  });

  results.set('ai-risk-low', {
    slug: 'ai-risk-low',
    items: aiLow,
    showSalary: true,
    faqItems: FAQS['ai-risk-low'],
    title: 'AI影響が少ない仕事ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `AIに代替されにくい職業TOP${TOP_N}。平均スコア${meanLow.toFixed(1)}/10。将来性が高くAIリスクの低い仕事を年収・就業者数と共に一覧。`,
    h1Text: `AI影響が少ない仕事 TOP${TOP_N}`,
    subText: `AI 影響度が最も <strong>低い</strong> 職業ランキング（${scored.length} 職業中）`,
    introText: '身体性・対人関係・創造性が求められる職業はAIによる代替が難しく、スコアが低くなる傾向があります。「AIに奪われない仕事」をお探しの方に、将来性の高い職業を年収データと共に紹介します。',
    statBlocks: [
      ['対象職業数', `${scored.length}`],
      ['TOP30 平均 AI 影響', `${meanLow.toFixed(1)} / 10`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(aiLow, 'salary'))} 万円`],
      ['TOP30 平均年齢', `${safeMean(aiLow, 'average_age').toFixed(1)} 歳`],
    ],
  });

  results.set('salary-safe', {
    slug: 'salary-safe',
    items: salarySafe,
    showSalary: true,
    faqItems: FAQS['salary-safe'],
    title: '高年収×低AIリスクの職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `年収が高くAI代替リスクが低い職業TOP${TOP_N}。平均年収${Math.trunc(meanSalarySS)}万円・平均AI影響${meanRiskSS.toFixed(1)}/10。将来性と収入を両立できる仕事を一覧。`,
    h1Text: `高年収×低AIリスク TOP${TOP_N}`,
    subText: '年収が高く、かつ AI 影響度が <strong>5以下</strong> の職業',
    introText: '高い年収を得ながらAIに代替されにくい——そんな職業を探している方へ。AI影響度5以下（10段階）かつ年収が高い順にランキングしました。',
    statBlocks: [
      ['TOP30 平均年収', `${Math.trunc(meanSalarySS)} 万円`],
      ['TOP30 平均 AI 影響', `${meanRiskSS.toFixed(1)} / 10`],
      ['TOP30 平均年齢', `${safeMean(salarySafe, 'average_age').toFixed(1)} 歳`],
    ],
  });

  results.set('workers', {
    slug: 'workers',
    items: byWorkers,
    showSalary: true,
    faqItems: FAQS['workers'],
    title: '就業者数が多い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `日本で最も就業者が多い職業TOP${TOP_N}。合計${fmtInt(totalWorkersTop)}人。年収・AI影響度と合わせて比較。厚労省データに基づく独自分析。`,
    h1Text: `就業者数ランキング TOP${TOP_N}`,
    subText: '日本で最も <strong>就業者が多い</strong> 職業',
    introText: '厚労省の職業情報データベース（job tag）に基づく就業者数ランキング。最も多くの人が従事している職業をAI影響度・年収データと共に一覧できます。',
    statBlocks: [
      ['TOP30 合計就業者数', `${fmtInt(totalWorkersTop)} 人`],
      ['TOP30 平均 AI 影響', `${safeMean(byWorkers, 'ai_risk').toFixed(1)} / 10`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byWorkers, 'salary'))} 万円`],
    ],
  });

  results.set('salary', {
    slug: 'salary',
    items: bySalary,
    showSalary: true,
    faqItems: FAQS['salary'],
    title: '年収が高い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `日本で最も年収が高い職業TOP${TOP_N}。平均年収${Math.trunc(meanSalaryTop)}万円。AI影響度・就業者数も合わせて比較。`,
    h1Text: `年収ランキング TOP${TOP_N}`,
    subText: '年収が最も <strong>高い</strong> 職業ランキング',
    introText: '厚労省の職業情報データベースに基づく年収ランキング。年収が高い職業をAI影響度・就業者数と共に一覧できます。',
    statBlocks: [
      ['TOP30 平均年収', `${Math.trunc(meanSalaryTop)} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(bySalary, 'ai_risk').toFixed(1)} / 10`],
      ['TOP30 平均年齢', `${safeMean(bySalary, 'average_age').toFixed(1)} 歳`],
      ['TOP30 平均月間労働', `${Math.trunc(safeMean(bySalary, 'monthly_hours'))} 時間`],
    ],
  });

  results.set('entry-salary', {
    slug: 'entry-salary',
    items: byEntry,
    showSalary: true,
    extraColFn: (o) => (o.recruit_wage ? [`<span class="rl-extra">初任給 ${Math.trunc(o.recruit_wage)}万円</span>`] : []),
    faqItems: FAQS['entry-salary'],
    title: '初任給が高い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `初任給が最も高い職業TOP${TOP_N}。平均初任給${Math.trunc(meanEntry)}万円。年収・AI影響度も合わせて比較。就活・転職の参考に。`,
    h1Text: `初任給ランキング TOP${TOP_N}`,
    subText: '初任給が最も <strong>高い</strong> 職業ランキング',
    introText: '新卒・未経験からのスタート時の給与が高い職業をランキング。平均年収やAI影響度も合わせて確認できます。',
    statBlocks: [
      ['TOP30 平均初任給', `${Math.trunc(meanEntry)} 万円`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byEntry, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byEntry, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  results.set('young-workforce', {
    slug: 'young-workforce',
    items: byYoung,
    showSalary: true,
    extraColFn: (o) => (o.average_age ? [`<span class="rl-extra">${o.average_age.toFixed(1)}歳</span>`] : []),
    faqItems: FAQS['young-workforce'],
    title: '平均年齢が若い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `平均年齢が最も低い職業TOP${TOP_N}。平均${meanAgeYoung.toFixed(1)}歳。若手が活躍する職業を年収・AI影響度と共に一覧。`,
    h1Text: `平均年齢が若い職業 TOP${TOP_N}`,
    subText: '平均年齢が最も <strong>低い</strong> 職業ランキング',
    introText: '若い世代が多く活躍する職業をランキング。IT・クリエイティブ・サービス業など、比較的新しい産業や体力を要する職種で平均年齢が低い傾向にあります。',
    statBlocks: [
      ['TOP30 平均年齢', `${meanAgeYoung.toFixed(1)} 歳`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byYoung, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byYoung, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  results.set('short-hours', {
    slug: 'short-hours',
    items: byHours,
    showSalary: true,
    extraColFn: (o) => (o.monthly_hours ? [`<span class="rl-extra">月${Math.trunc(o.monthly_hours)}h</span>`] : []),
    faqItems: FAQS['short-hours'],
    title: '労働時間が短い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `月間労働時間が最も短い職業TOP${TOP_N}。平均${Math.trunc(meanHours)}時間。ワークライフバランスに優れた職業を年収・AI影響度と共に一覧。`,
    h1Text: `労働時間が短い職業 TOP${TOP_N}`,
    subText: '月間労働時間が最も <strong>短い</strong> 職業ランキング',
    introText: 'ワークライフバランスを重視する方向けに、月間労働時間が短い職業をランキング。年収やAI影響度も合わせて確認できます。',
    statBlocks: [
      ['TOP30 平均月間労働', `${Math.trunc(meanHours)} 時間`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byHours, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byHours, 'ai_risk').toFixed(1)} / 10`],
      ['TOP30 平均年齢', `${safeMean(byHours, 'average_age').toFixed(1)} 歳`],
    ],
  });

  results.set('high-demand', {
    slug: 'high-demand',
    items: byDemand,
    showSalary: true,
    extraColFn: (o) => {
      const db = o.demand_band ?? '';
      const label = DEMAND_JA[db];
      return label ? [`<span class="demand-pill ${escapeHtml(db)}">${escapeHtml(label)}</span>`] : [];
    },
    faqItems: FAQS['high-demand'],
    title: '人手不足の職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `求人需要が最も高い職業TOP${TOP_N}。「需要高」${hotCount}件・「やや高」${warmCount}件。転職・就活の参考に。`,
    h1Text: `人手不足の職業 TOP${TOP_N}`,
    subText: '求人需要が最も <strong>高い</strong> 職業ランキング',
    introText: '人手不足が深刻な職業を求人需要の高い順にランキング。採用されやすく待遇改善も期待できる職業を年収・AI影響度と共に確認できます。',
    statBlocks: [
      ['「需要高」職業数', `${hotCount}`],
      ['「やや高」職業数', `${warmCount}`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byDemand, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byDemand, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // ════════════════════════════════════════════════════════════════════════
  // Phase 2 (2026-05-09): +30 new rankings — see rankings-meta.ts for slugs.
  // ════════════════════════════════════════════════════════════════════════

  // ── 単軸 (5) ──

  // 10. 時給ランキング (派生: recruit_wage / 160h、円)
  const byHourly = byKeyDesc(occs.filter((o) => o.hourly_wage), (o) => o.hourly_wage, (o) => o.id).slice(0, TOP_N);
  const meanHourly = safeMean(byHourly, 'hourly_wage');
  results.set('hourly-wage', {
    slug: 'hourly-wage',
    items: byHourly,
    showSalary: true,
    extraColFn: (o) => (o.hourly_wage ? [`<span class="rl-extra">時給 ¥${o.hourly_wage.toLocaleString('en-US')}</span>`] : []),
    faqItems: FAQS['hourly-wage'],
    title: '時給が高い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `時給ベースで報酬が高い職業 TOP${TOP_N}。平均時給 ¥${Math.round(meanHourly).toLocaleString('en-US')}。AI 影響度・年収と共に一覧。`,
    h1Text: `時給が高い職業 TOP${TOP_N}`,
    subText: '時給ベースで報酬が <strong>高い</strong> 職業ランキング (求人賃金 ÷ 160h 推計)',
    introText: '時給ベースで報酬が高い職業をランキング。求人賃金 (月) を 160 時間で割った推計値で、フルタイム前提の参考値です。AI 影響度・年収も合わせて確認できます。',
    statBlocks: [
      ['TOP30 平均時給', `¥${Math.round(meanHourly).toLocaleString('en-US')}`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byHourly, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byHourly, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 11. 求人倍率 (recruit_ratio desc)
  const byRecruitRatio = byKeyDesc(occs.filter((o) => o.recruit_ratio !== null), (o) => o.recruit_ratio, (o) => o.id).slice(0, TOP_N);
  const meanRecruitRatio = safeMean(byRecruitRatio, 'recruit_ratio');
  results.set('recruit-ratio', {
    slug: 'recruit-ratio',
    items: byRecruitRatio,
    showSalary: true,
    extraColFn: (o) => (o.recruit_ratio !== null ? [`<span class="rl-extra">${o.recruit_ratio.toFixed(2)} 倍</span>`] : []),
    faqItems: FAQS['recruit-ratio'],
    title: '求人倍率が高い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `求人倍率が最も高い職業 TOP${TOP_N}。平均 ${meanRecruitRatio.toFixed(2)} 倍。人手不足が顕著な売り手市場の職業一覧。`,
    h1Text: `求人倍率が高い職業 TOP${TOP_N}`,
    subText: '求人倍率が最も <strong>高い</strong> 職業ランキング',
    introText: '1 人の求職者あたり何件の求人があるかを表す「有効求人倍率」が高い職業をランキング。1.0 を超えると売り手市場、人手不足を示唆します。',
    statBlocks: [
      ['TOP30 平均求人倍率', `${meanRecruitRatio.toFixed(2)} 倍`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byRecruitRatio, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byRecruitRatio, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 12. シニア中心 (average_age desc)
  const byAging = byKeyDesc(occs.filter((o) => o.average_age), (o) => o.average_age, (o) => o.id).slice(0, TOP_N);
  const meanAgeAging = safeMean(byAging, 'average_age');
  results.set('aging-workforce', {
    slug: 'aging-workforce',
    items: byAging,
    showSalary: true,
    extraColFn: (o) => (o.average_age ? [`<span class="rl-extra">${o.average_age.toFixed(1)} 歳</span>`] : []),
    faqItems: FAQS['aging-workforce'],
    title: 'シニア中心の職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `平均年齢が最も高い職業 TOP${TOP_N}。平均 ${meanAgeAging.toFixed(1)} 歳。経験者が活躍する職業一覧。`,
    h1Text: `シニア中心の職業 TOP${TOP_N}`,
    subText: '平均年齢が最も <strong>高い</strong> 職業ランキング',
    introText: '長年の経験・人脈・現場判断が価値を持つ職業や、若手参入が少ない伝統的な職業で平均年齢が高くなる傾向。中高年からの参入チャンスとも読み取れます。',
    statBlocks: [
      ['TOP30 平均年齢', `${meanAgeAging.toFixed(1)} 歳`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byAging, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byAging, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 13. 月労働時間が長い (monthly_hours desc)
  const byHoursLong = byKeyDesc(occs.filter((o) => o.monthly_hours), (o) => o.monthly_hours, (o) => o.id).slice(0, TOP_N);
  const meanHoursLong = safeMean(byHoursLong, 'monthly_hours');
  results.set('monthly-hours-long', {
    slug: 'monthly-hours-long',
    items: byHoursLong,
    showSalary: true,
    extraColFn: (o) => (o.monthly_hours ? [`<span class="rl-extra">月${Math.trunc(o.monthly_hours)}h</span>`] : []),
    faqItems: FAQS['monthly-hours-long'],
    title: '労働時間が長い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `月間労働時間が最も長い職業 TOP${TOP_N}。平均 ${Math.trunc(meanHoursLong)} 時間。年収・AI 影響度と共に確認。`,
    h1Text: `労働時間が長い職業 TOP${TOP_N}`,
    subText: '月間労働時間が最も <strong>長い</strong> 職業ランキング',
    introText: '建設・運輸・医療・サービス業など、現場稼働や緊急対応が必要な職業で月間労働時間が長くなる傾向。長時間労働の常態化は健康面・継続性の観点でも要検討です。',
    statBlocks: [
      ['TOP30 平均月間労働', `${Math.trunc(meanHoursLong)} 時間`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byHoursLong, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byHoursLong, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 14. 求人倍率が低い (recruit_ratio asc, 買い手市場)
  const byRecruitLow = byKeyAsc(occs.filter((o) => o.recruit_ratio !== null), (o) => o.recruit_ratio, (o) => o.id).slice(0, TOP_N);
  const meanRecruitLow = safeMean(byRecruitLow, 'recruit_ratio');
  results.set('recruit-ratio-low', {
    slug: 'recruit-ratio-low',
    items: byRecruitLow,
    showSalary: true,
    extraColFn: (o) => (o.recruit_ratio !== null ? [`<span class="rl-extra">${o.recruit_ratio.toFixed(2)} 倍</span>`] : []),
    faqItems: FAQS['recruit-ratio-low'],
    title: '求人倍率が低い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `求人倍率が最も低い職業 TOP${TOP_N}。平均 ${meanRecruitLow.toFixed(2)} 倍。採用競争が厳しい買い手市場の職業一覧。`,
    h1Text: `求人倍率が低い職業 TOP${TOP_N}`,
    subText: '求人倍率が最も <strong>低い</strong> 職業ランキング (買い手市場)',
    introText: '応募者数に対して求人数が少ない買い手市場の職業をランキング。人気職業や参入障壁が高い分野、市場縮小傾向の業種が含まれます。',
    statBlocks: [
      ['TOP30 平均求人倍率', `${meanRecruitLow.toFixed(2)} 倍`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byRecruitLow, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byRecruitLow, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // ── AI 軸派生 (6) ──

  // 15. AI 置き換えが進行中 (ai_risk >= 8 desc, salary as tie)
  const aiReplacedSoon = scored
    .filter((o) => (o.ai_risk ?? 0) >= 8)
    .sort((a, b) => {
      const ra = b.ai_risk ?? 0; const rb = a.ai_risk ?? 0;
      if (ra !== rb) return ra - rb;
      return (b.workers ?? 0) - (a.workers ?? 0);
    })
    .slice(0, TOP_N);
  const meanAiReplaced = safeMean(aiReplacedSoon, 'ai_risk');
  results.set('ai-replaced-soon', {
    slug: 'ai-replaced-soon',
    items: aiReplacedSoon,
    showSalary: true,
    faqItems: FAQS['ai-replaced-soon'],
    title: 'AI 置き換えが進む職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `AI 影響度 8/10 以上の職業 TOP${TOP_N}。業務再設計が急務な分野を AI 影響度・年収と共に一覧。`,
    h1Text: `AI 置き換えが進む職業 TOP${TOP_N}`,
    subText: 'AI 影響度 <strong>8/10 以上</strong> の職業ランキング',
    introText: '5-10 年で業務内容が大きく変わる可能性が高い、AI 影響度 8 以上の職業群。職業自体が消えるわけではなく、業務再設計が急務であるシグナルです。',
    statBlocks: [
      ['対象職業数', `${aiReplacedSoon.length}`],
      ['TOP30 平均 AI 影響', `${meanAiReplaced.toFixed(1)} / 10`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(aiReplacedSoon, 'salary'))} 万円`],
    ],
  });

  // 16. 伝統技能で AI 抗性が高い (ai_risk <= 3 + craft sectors)
  const aiResistantCraft = scored
    .filter((o) => (o.ai_risk ?? 999) <= 3 && inSectorSet(o, CRAFT_SECTORS))
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || a.id - b.id)
    .slice(0, TOP_N);
  results.set('ai-resistant-craft', {
    slug: 'ai-resistant-craft',
    items: aiResistantCraft,
    showSalary: true,
    faqItems: FAQS['ai-resistant-craft'],
    title: '伝統技能で AI 抗性が高い職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `製造・建設・メンテ・農林系で AI 影響度が低い職業 TOP${aiResistantCraft.length}。手技中心で AI 代替が難しい分野を一覧。`,
    h1Text: `伝統技能で AI 抗性が高い職業 TOP${aiResistantCraft.length}`,
    subText: '製造・建設・メンテ系で AI 影響度 <strong>3 以下</strong> の技能職',
    introText: '手技・経験的判断・身体的調整を要する技能職は AI で代替しにくく、製造・建設・メンテ・農林の現場職が低 AI 影響度のまま安定する傾向にあります。',
    statBlocks: [
      ['対象職業数', `${aiResistantCraft.length}`],
      ['TOP 平均 AI 影響', `${safeMean(aiResistantCraft, 'ai_risk').toFixed(1)} / 10`],
      ['TOP 平均年収', `${Math.trunc(safeMean(aiResistantCraft, 'salary'))} 万円`],
    ],
  });

  // 17. AI リスク高 × 高年収
  const aiAtRiskPaid = scored
    .filter((o) => (o.ai_risk ?? 0) >= 7 && (o.salary ?? 0) >= 500)
    .sort((a, b) => {
      const sa = b.salary ?? 0; const sb = a.salary ?? 0;
      if (sa !== sb) return sa - sb;
      return (b.ai_risk ?? 0) - (a.ai_risk ?? 0);
    })
    .slice(0, TOP_N);
  results.set('ai-at-risk-but-paid', {
    slug: 'ai-at-risk-but-paid',
    items: aiAtRiskPaid,
    showSalary: true,
    faqItems: FAQS['ai-at-risk-but-paid'],
    title: 'AI リスク高 × 高年収の職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `AI 影響度 7+ かつ年収 500 万円以上の「要注意組」TOP${aiAtRiskPaid.length}。今は稼げるが業務再設計が前提の分野。`,
    h1Text: `AI リスク高 × 高年収 TOP${aiAtRiskPaid.length}`,
    subText: 'AI 影響度 <strong>7 以上</strong> × 年収 <strong>500 万円以上</strong> の要注意組',
    introText: 'AI で代替されやすいが現状の年収はまだ高い職業群。今は稼げるが、5-10 年での業務再設計や AI を使いこなす側へのシフトが鍵です。',
    statBlocks: [
      ['対象職業数', `${aiAtRiskPaid.length}`],
      ['平均年収', `${Math.trunc(safeMean(aiAtRiskPaid, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(aiAtRiskPaid, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 18. AI で補強される (ai_risk 4-6, sort by salary desc)
  const aiAugmented = scored
    .filter((o) => (o.ai_risk ?? -1) >= 4 && (o.ai_risk ?? -1) <= 6)
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || a.id - b.id)
    .slice(0, TOP_N);
  results.set('ai-augmented', {
    slug: 'ai-augmented',
    items: aiAugmented,
    showSalary: true,
    faqItems: FAQS['ai-augmented'],
    title: 'AI で補強される職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `AI 影響度 4-6 で AI で業務が増強される職業 TOP${TOP_N}。年収順で並べた「AI 共存域」の職業一覧。`,
    h1Text: `AI で補強される職業 TOP${TOP_N}`,
    subText: 'AI 影響度 <strong>4-6</strong> の AI 共存域・年収順ランキング',
    introText: 'AI が業務を一部肩代わりする「補強域」の職業。完全代替されるリスクは低いが、AI ツールを使いこなせるかでパフォーマンス差が広がります。',
    statBlocks: [
      ['対象職業数', `${aiAugmented.length}`],
      ['TOP30 平均 AI 影響', `${safeMean(aiAugmented, 'ai_risk').toFixed(1)} / 10`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(aiAugmented, 'salary'))} 万円`],
    ],
  });

  // 19. AI を使いこなす側 (sector=it + ai_risk >= 5)
  const aiFrontier = scored
    .filter((o) => o.sector_id === 'it' && (o.ai_risk ?? 0) >= 5)
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || a.id - b.id)
    .slice(0, TOP_N);
  results.set('ai-frontier', {
    slug: 'ai-frontier',
    items: aiFrontier,
    showSalary: true,
    faqItems: FAQS['ai-frontier'],
    title: 'AI を使いこなす側の職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `IT・通信セクターで AI を活用する職業 TOP${aiFrontier.length}。AI フロンティア職を年収・AI 影響度と共に一覧。`,
    h1Text: `AI を使いこなす側の職業 TOP${aiFrontier.length}`,
    subText: 'IT・通信セクターで AI 影響度 <strong>5 以上</strong> の AI フロンティア職',
    introText: 'AI を使う側に立ち、業務に AI を活用・組み込む立場の職業群。IT エンジニア・データサイエンティスト・AI コーディング等が該当します。',
    statBlocks: [
      ['対象職業数', `${aiFrontier.length}`],
      ['平均年収', `${Math.trunc(safeMean(aiFrontier, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(aiFrontier, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 20. AI 安全 × 正規雇用率高
  const aiStableEmployment = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && empPct(o, '正規の職員、従業員') >= 60)
    .sort((a, b) => empPct(b, '正規の職員、従業員') - empPct(a, '正規の職員、従業員') || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('ai-stable-employment', {
    slug: 'ai-stable-employment',
    items: aiStableEmployment,
    showSalary: true,
    extraColFn: (o) => [`<span class="rl-extra">正規 ${empPct(o, '正規の職員、従業員').toFixed(0)}%</span>`],
    faqItems: FAQS['ai-stable-employment'],
    title: 'AI 安全 × 正規雇用率高の職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `AI 影響度 5 以下かつ正規雇用率 60% 以上の安定職業 TOP${aiStableEmployment.length}。長期的なキャリア安定性が期待できる分野。`,
    h1Text: `AI 安全 × 正規雇用率高 TOP${aiStableEmployment.length}`,
    subText: 'AI 影響度 <strong>5 以下</strong> × 正規雇用率 <strong>60% 以上</strong>',
    introText: '低 AI 影響度かつ正社員比率が高い、長期的に安定したキャリア形成が期待できる職業群です。',
    statBlocks: [
      ['対象職業数', `${aiStableEmployment.length}`],
      ['平均 AI 影響', `${safeMean(aiStableEmployment, 'ai_risk').toFixed(1)} / 10`],
      ['平均年収', `${Math.trunc(safeMean(aiStableEmployment, 'salary'))} 万円`],
    ],
  });

  // ── 組合せ (8) ──

  // 21. 高需要 × AI 安全
  const aiSafeHighDemand = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && (DEMAND_SCORE[o.demand_band ?? ''] ?? 0) >= 3)
    .sort((a, b) => (DEMAND_SCORE[b.demand_band ?? ''] ?? 0) - (DEMAND_SCORE[a.demand_band ?? ''] ?? 0) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-high-demand', {
    slug: 'ai-safe-high-demand',
    items: aiSafeHighDemand,
    showSalary: true,
    extraColFn: (o) => {
      const db = o.demand_band ?? '';
      const label = DEMAND_JA[db];
      return label ? [`<span class="demand-pill ${escapeHtml(db)}">${escapeHtml(label)}</span>`] : [];
    },
    faqItems: FAQS['ai-safe-high-demand'],
    title: '高需要 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `人手不足かつ AI 影響度が低い職業 TOP${aiSafeHighDemand.length}。介護・建設・医療系を中心とした「鉄板」キャリア候補。`,
    h1Text: `高需要 × AI 安全 TOP${aiSafeHighDemand.length}`,
    subText: '求人需要 <strong>高め以上</strong> × AI 影響 <strong>5 以下</strong>',
    introText: '採用されやすく賃金交渉余地もあり、かつ AI 代替リスクが低い「鉄板」キャリア候補。介護・建設・医療系が中心で、未経験参入のルートも整備されています。',
    statBlocks: [
      ['対象職業数', `${aiSafeHighDemand.length}`],
      ['平均 AI 影響', `${safeMean(aiSafeHighDemand, 'ai_risk').toFixed(1)} / 10`],
      ['平均年収', `${Math.trunc(safeMean(aiSafeHighDemand, 'salary'))} 万円`],
    ],
  });

  // 22. 低労働時間 × AI 安全
  const aiSafeShortHours = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.monthly_hours)
    .sort((a, b) => (a.monthly_hours ?? 9999) - (b.monthly_hours ?? 9999) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-short-hours', {
    slug: 'ai-safe-short-hours',
    items: aiSafeShortHours,
    showSalary: true,
    extraColFn: (o) => (o.monthly_hours ? [`<span class="rl-extra">月${Math.trunc(o.monthly_hours)}h</span>`] : []),
    faqItems: FAQS['ai-safe-short-hours'],
    title: '低労働時間 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `労働時間が短く AI 影響度も低い職業 TOP${TOP_N}。ワークライフバランスと将来性を両立する職業を一覧。`,
    h1Text: `低労働時間 × AI 安全 TOP${TOP_N}`,
    subText: 'AI 影響 <strong>5 以下</strong> × 月間労働時間 <strong>昇順</strong>',
    introText: '労働時間が短く、かつ AI 代替リスクも低い職業をランキング。教育・公務・専門職の一部が該当します。',
    statBlocks: [
      ['TOP30 平均月間労働', `${Math.trunc(safeMean(aiSafeShortHours, 'monthly_hours'))} 時間`],
      ['TOP30 平均 AI 影響', `${safeMean(aiSafeShortHours, 'ai_risk').toFixed(1)} / 10`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(aiSafeShortHours, 'salary'))} 万円`],
    ],
  });

  // 23. 若手中心 × AI 安全
  const aiSafeYoung = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.average_age)
    .sort((a, b) => (a.average_age ?? 999) - (b.average_age ?? 999) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-young-workforce', {
    slug: 'ai-safe-young-workforce',
    items: aiSafeYoung,
    showSalary: true,
    extraColFn: (o) => (o.average_age ? [`<span class="rl-extra">${o.average_age.toFixed(1)} 歳</span>`] : []),
    faqItems: FAQS['ai-safe-young-workforce'],
    title: '若手中心 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `平均年齢が若く AI 影響度も低い職業 TOP${TOP_N}。新卒・第二新卒の参考に。`,
    h1Text: `若手中心 × AI 安全 TOP${TOP_N}`,
    subText: 'AI 影響 <strong>5 以下</strong> × 平均年齢 <strong>昇順</strong>',
    introText: '若手が多く活躍し、かつ AI 代替リスクも低い職業をランキング。新卒・第二新卒のキャリア選択の参考に。',
    statBlocks: [
      ['TOP30 平均年齢', `${safeMean(aiSafeYoung, 'average_age').toFixed(1)} 歳`],
      ['TOP30 平均 AI 影響', `${safeMean(aiSafeYoung, 'ai_risk').toFixed(1)} / 10`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(aiSafeYoung, 'salary'))} 万円`],
    ],
  });

  // 24. 無資格 × AI 安全
  const aiSafeNoLicense = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.certs.length === 0)
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-no-license', {
    slug: 'ai-safe-no-license',
    items: aiSafeNoLicense,
    showSalary: true,
    faqItems: FAQS['ai-safe-no-license'],
    title: '無資格 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `関連資格不要で AI 影響度も低い職業 TOP${aiSafeNoLicense.length}。資格に頼らず長く続けられる分野を一覧。`,
    h1Text: `無資格 × AI 安全 TOP${aiSafeNoLicense.length}`,
    subText: '関連資格 <strong>なし</strong> × AI 影響 <strong>5 以下</strong>',
    introText: '関連国家資格を要さず、AI 代替リスクも低い職業群。実務経験で勝負できる分野を中心にランキング。',
    statBlocks: [
      ['対象職業数', `${aiSafeNoLicense.length}`],
      ['平均 AI 影響', `${safeMean(aiSafeNoLicense, 'ai_risk').toFixed(1)} / 10`],
      ['平均年収', `${Math.trunc(safeMean(aiSafeNoLicense, 'salary'))} 万円`],
    ],
  });

  // 25. 身体性 × AI 安全
  const aiSafePhysical = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && inSectorSet(o, PHYSICAL_SECTORS))
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.workers ?? 0) - (a.workers ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-physical', {
    slug: 'ai-safe-physical',
    items: aiSafePhysical,
    showSalary: true,
    faqItems: FAQS['ai-safe-physical'],
    title: '身体性 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `身体技能職で AI 影響度も低い職業 TOP${aiSafePhysical.length}。製造・建設・農林等の現場職を一覧。`,
    h1Text: `身体性 × AI 安全 TOP${aiSafePhysical.length}`,
    subText: '製造・建設・メンテ・農林・軽作業セクター × AI 影響 <strong>5 以下</strong>',
    introText: '手の感覚・現場判断・身体的調整を要する職業は AI で代替されにくく、構造的な優位性を持ちます。建設職人・整備士・農林漁業・配管工等が代表例。',
    statBlocks: [
      ['対象職業数', `${aiSafePhysical.length}`],
      ['平均 AI 影響', `${safeMean(aiSafePhysical, 'ai_risk').toFixed(1)} / 10`],
      ['平均年収', `${Math.trunc(safeMean(aiSafePhysical, 'salary'))} 万円`],
    ],
  });

  // 26. 対人 × AI 安全
  const aiSafeInterpersonal = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && inSectorSet(o, INTERPERSONAL_SECTORS))
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.workers ?? 0) - (a.workers ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-interpersonal', {
    slug: 'ai-safe-interpersonal',
    items: aiSafeInterpersonal,
    showSalary: true,
    faqItems: FAQS['ai-safe-interpersonal'],
    title: '対人 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `対人スキル中心で AI 影響度も低い職業 TOP${aiSafeInterpersonal.length}。医療・福祉・教育・販売・サービス系を一覧。`,
    h1Text: `対人 × AI 安全 TOP${aiSafeInterpersonal.length}`,
    subText: '医療・福祉・教育・販売・サービスセクター × AI 影響 <strong>5 以下</strong>',
    introText: '感情の機微・信頼関係・即興的な調整を要する対人職は AI で代替しにくい。看護師・介護福祉士・保育士・教師・販売員・接客スタッフが代表例。',
    statBlocks: [
      ['対象職業数', `${aiSafeInterpersonal.length}`],
      ['平均 AI 影響', `${safeMean(aiSafeInterpersonal, 'ai_risk').toFixed(1)} / 10`],
      ['平均年収', `${Math.trunc(safeMean(aiSafeInterpersonal, 'salary'))} 万円`],
    ],
  });

  // 27. 高年収 × 高需要
  const highSalaryHighDemand = scored
    .filter((o) => o.salary && (DEMAND_SCORE[o.demand_band ?? ''] ?? 0) >= 3)
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || (DEMAND_SCORE[b.demand_band ?? ''] ?? 0) - (DEMAND_SCORE[a.demand_band ?? ''] ?? 0))
    .slice(0, TOP_N);
  results.set('high-salary-high-demand', {
    slug: 'high-salary-high-demand',
    items: highSalaryHighDemand,
    showSalary: true,
    extraColFn: (o) => {
      const db = o.demand_band ?? '';
      const label = DEMAND_JA[db];
      return label ? [`<span class="demand-pill ${escapeHtml(db)}">${escapeHtml(label)}</span>`] : [];
    },
    faqItems: FAQS['high-salary-high-demand'],
    title: '高年収 × 高需要の職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `年収が高くかつ人手不足の職業 TOP${highSalaryHighDemand.length}。賃金上昇圧力が働く分野を一覧。`,
    h1Text: `高年収 × 高需要 TOP${highSalaryHighDemand.length}`,
    subText: '年収 <strong>高め</strong> × 求人需要 <strong>高め以上</strong>',
    introText: '医療系・建設系の専門職や IT 系上流職など、専門性 + 人手不足が重なる分野。賃金上昇圧力も働きます。',
    statBlocks: [
      ['対象職業数', `${highSalaryHighDemand.length}`],
      ['平均年収', `${Math.trunc(safeMean(highSalaryHighDemand, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(highSalaryHighDemand, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 28. 初任給が高い × 若手活躍
  const highSalaryYoungEntry = occs
    .filter((o) => o.recruit_wage && o.average_age && o.average_age <= 40)
    .sort((a, b) => (b.recruit_wage ?? 0) - (a.recruit_wage ?? 0) || (a.average_age ?? 999) - (b.average_age ?? 999))
    .slice(0, TOP_N);
  results.set('high-salary-young-entry', {
    slug: 'high-salary-young-entry',
    items: highSalaryYoungEntry,
    showSalary: true,
    extraColFn: (o) => (o.recruit_wage ? [`<span class="rl-extra">初任給 ${Math.trunc(o.recruit_wage)} 万円</span>`] : []),
    faqItems: FAQS['high-salary-young-entry'],
    title: '初任給が高い × 若手活躍の職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `初任給が高くて平均年齢 40 歳以下の職業 TOP${highSalaryYoungEntry.length}。新卒キャリア設計の参考に。`,
    h1Text: `初任給が高い × 若手活躍 TOP${highSalaryYoungEntry.length}`,
    subText: '初任給 <strong>降順</strong> × 平均年齢 <strong>40 歳以下</strong>',
    introText: 'スタート時の給与が高く、若手が多く活躍する職業をランキング。IT エンジニア・コンサル・金融系の一部が該当。',
    statBlocks: [
      ['TOP30 平均初任給', `${Math.trunc(safeMean(highSalaryYoungEntry, 'recruit_wage'))} 万円`],
      ['TOP30 平均年齢', `${safeMean(highSalaryYoungEntry, 'average_age').toFixed(1)} 歳`],
      ['TOP30 平均 AI 影響', `${safeMean(highSalaryYoungEntry, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // ── 教育・資格軸 (5) ──

  // 29. 国家資格必須
  const licenseRequired = occs
    .filter((o) => o.certs.length >= 1)
    .sort((a, b) => b.certs.length - a.certs.length || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('license-required', {
    slug: 'license-required',
    items: licenseRequired,
    showSalary: true,
    extraColFn: (o) => [`<span class="rl-extra">資格 ${o.certs.length}</span>`],
    faqItems: FAQS['license-required'],
    title: '国家資格が必要な職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `関連資格が多い職業 TOP${licenseRequired.length}。参入障壁が明確な専門職を年収・AI 影響度と共に一覧。`,
    h1Text: `国家資格が必要な職業 TOP${licenseRequired.length}`,
    subText: '関連資格数 <strong>降順</strong> ランキング',
    introText: '医療・士業・建設・福祉・教育系の専門職で、参入障壁が明確に設定されている職業群。資格保有者しかできない業務範囲があり、AI 代替が起きにくい傾向。',
    statBlocks: [
      ['対象職業数', `${licenseRequired.length}`],
      ['平均年収', `${Math.trunc(safeMean(licenseRequired, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(licenseRequired, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 30. 無資格で就ける × AI 安全
  const noLicenseRequired = scored
    .filter((o) => o.certs.length === 0 && (o.ai_risk ?? 999) <= 5)
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('no-license-required', {
    slug: 'no-license-required',
    items: noLicenseRequired,
    showSalary: true,
    faqItems: FAQS['no-license-required'],
    title: '無資格で就ける × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `関連資格不要で AI 影響度も低い職業 TOP${noLicenseRequired.length}。実務経験ベースで勝負できる分野を一覧。`,
    h1Text: `無資格で就ける × AI 安全 TOP${noLicenseRequired.length}`,
    subText: '関連資格 <strong>なし</strong> × AI 影響 <strong>5 以下</strong>',
    introText: '関連国家資格を要さず、AI 代替リスクも低い職業群。建設技能職・運輸・対人サービスの一部が該当します。',
    statBlocks: [
      ['対象職業数', `${noLicenseRequired.length}`],
      ['平均 AI 影響', `${safeMean(noLicenseRequired, 'ai_risk').toFixed(1)} / 10`],
      ['平均年収', `${Math.trunc(safeMean(noLicenseRequired, 'salary'))} 万円`],
    ],
  });

  // 31. 高卒で就ける (高卒比率 30%+ で sort)
  const highSchoolOk = occs
    .filter((o) => eduPct(o, '高卒') >= 30)
    .sort((a, b) => eduPct(b, '高卒') - eduPct(a, '高卒') || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('high-school-ok', {
    slug: 'high-school-ok',
    items: highSchoolOk,
    showSalary: true,
    extraColFn: (o) => [`<span class="rl-extra">高卒 ${eduPct(o, '高卒').toFixed(0)}%</span>`],
    faqItems: FAQS['high-school-ok'],
    title: '高卒で目指せる職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `高卒比率が高い職業 TOP${highSchoolOk.length}。学歴ハードルが低く実務能力で評価される職業を一覧。`,
    h1Text: `高卒で目指せる職業 TOP${highSchoolOk.length}`,
    subText: '高卒比率 <strong>30% 以上</strong> · 降順',
    introText: '高卒の従事者比率が高く、学歴より実務能力と適性で評価される職業群。建設・製造・運輸・サービス・公安系の現場職が中心。',
    statBlocks: [
      ['対象職業数', `${highSchoolOk.length}`],
      ['平均年収', `${Math.trunc(safeMean(highSchoolOk, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(highSchoolOk, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 32. 大卒以上が中心 (大卒比率 50%+)
  const universityRequired = occs
    .filter((o) => eduPct(o, '大卒') >= 50)
    .sort((a, b) => eduPct(b, '大卒') - eduPct(a, '大卒') || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('university-required', {
    slug: 'university-required',
    items: universityRequired,
    showSalary: true,
    extraColFn: (o) => [`<span class="rl-extra">大卒 ${eduPct(o, '大卒').toFixed(0)}%</span>`],
    faqItems: FAQS['university-required'],
    title: '大卒以上が中心の職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `大卒比率 50% 以上の職業 TOP${universityRequired.length}。学位が前提となる専門職を一覧。`,
    h1Text: `大卒以上が中心の職業 TOP${universityRequired.length}`,
    subText: '大卒比率 <strong>50% 以上</strong> · 降順',
    introText: '大卒以上の従事者比率が高い職業群。専門知識・抽象的思考・複雑な意思決定を要する分野で、医療・士業・研究・上流 IT 等が含まれます。',
    statBlocks: [
      ['対象職業数', `${universityRequired.length}`],
      ['平均年収', `${Math.trunc(safeMean(universityRequired, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(universityRequired, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 33. 大学院卒中心 (大学院卒 = 修士+博士 30%+)
  const graduateSchoolRequired = occs
    .filter((o) => gradPct(o) >= 30)
    .sort((a, b) => gradPct(b) - gradPct(a) || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('graduate-school-required', {
    slug: 'graduate-school-required',
    items: graduateSchoolRequired,
    showSalary: true,
    extraColFn: (o) => [`<span class="rl-extra">院卒 ${gradPct(o).toFixed(0)}%</span>`],
    faqItems: FAQS['graduate-school-required'],
    title: '大学院卒中心の職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `修士・博士課程修了者が多い職業 TOP${graduateSchoolRequired.length}。高度専門職を一覧。`,
    h1Text: `大学院卒中心の職業 TOP${graduateSchoolRequired.length}`,
    subText: '大学院卒比率 (修士+博士) <strong>30% 以上</strong> · 降順',
    introText: '研究職・大学教員・専門医・特定の士業など、博士・修士課程修了が前提となる高度専門職の職業群です。',
    statBlocks: [
      ['対象職業数', `${graduateSchoolRequired.length}`],
      ['平均年収', `${Math.trunc(safeMean(graduateSchoolRequired, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(graduateSchoolRequired, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // ── ニッチ (6) ──

  // 34. 公的機関・公務員系
  const publicSector = occs
    .filter((o) => inSectorSet(o, PUBLIC_SECTORS))
    .sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0) || a.id - b.id)
    .slice(0, TOP_N);
  results.set('public-sector', {
    slug: 'public-sector',
    items: publicSector,
    showSalary: true,
    faqItems: FAQS['public-sector'],
    title: '公的機関・公務員系の職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `保安・公安セクターの公務員系職業 TOP${publicSector.length}。安定雇用・年功的昇進・福利厚生が特徴の分野。`,
    h1Text: `公的機関・公務員系の職業 TOP${publicSector.length}`,
    subText: '保安・公安セクターの公務員系職業ランキング',
    introText: '警察官・自衛官・消防士・公務員系職業をランキング。安定雇用・年功的昇進・手厚い福利厚生が特徴で、AI 影響度も低めの傾向です。',
    statBlocks: [
      ['対象職業数', `${publicSector.length}`],
      ['平均年収', `${Math.trunc(safeMean(publicSector, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(publicSector, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 35. フリーランス向き (自営、フリーランス比率 20%+)
  const freelanceFriendly = occs
    .filter((o) => empPct(o, '自営、フリーランス') >= 20)
    .sort((a, b) => empPct(b, '自営、フリーランス') - empPct(a, '自営、フリーランス') || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('freelance-friendly', {
    slug: 'freelance-friendly',
    items: freelanceFriendly,
    showSalary: true,
    extraColFn: (o) => [`<span class="rl-extra">フリー ${empPct(o, '自営、フリーランス').toFixed(0)}%</span>`],
    faqItems: FAQS['freelance-friendly'],
    title: 'フリーランス向きの職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `自営・フリーランス比率が高い職業 TOP${freelanceFriendly.length}。独立しやすい分野を一覧。`,
    h1Text: `フリーランス向きの職業 TOP${freelanceFriendly.length}`,
    subText: '自営・フリーランス比率 <strong>20% 以上</strong> · 降順',
    introText: '専門スキルが個人ベースで完結する職業 (デザイン・執筆・IT・コンサル等) や、現場直結の自営業 (技能職・士業) など、独立しやすい分野をランキング。',
    statBlocks: [
      ['対象職業数', `${freelanceFriendly.length}`],
      ['平均年収', `${Math.trunc(safeMean(freelanceFriendly, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(freelanceFriendly, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 36. 独立・開業が典型 (自営、フリーランス + パートタイマー以外、を別軸で見る)
  // 経営層 + 自営、フリーランス の合計が高い職業
  const selfEmployedTypical = occs
    .filter((o) => empPct(o, '自営、フリーランス') + empPct(o, '経営層（役員等）') >= 30)
    .sort((a, b) =>
      (empPct(b, '自営、フリーランス') + empPct(b, '経営層（役員等）')) -
      (empPct(a, '自営、フリーランス') + empPct(a, '経営層（役員等）'))
      || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('self-employed-typical', {
    slug: 'self-employed-typical',
    items: selfEmployedTypical,
    showSalary: true,
    extraColFn: (o) => [`<span class="rl-extra">独立 ${(empPct(o, '自営、フリーランス') + empPct(o, '経営層（役員等）')).toFixed(0)}%</span>`],
    faqItems: FAQS['self-employed-typical'],
    title: '独立・開業が典型の職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `フリーランス + 経営層比率が高い職業 TOP${selfEmployedTypical.length}。独立がキャリアの自然な到達点となる職業を一覧。`,
    h1Text: `独立・開業が典型の職業 TOP${selfEmployedTypical.length}`,
    subText: 'フリーランス + 経営層 比率 <strong>30% 以上</strong> · 降順',
    introText: '美容師・調理師・建設職人・士業など、独立がキャリアの自然な到達点とされる職業群。雇われ段階を経て独立 → 開業のルートが王道です。',
    statBlocks: [
      ['対象職業数', `${selfEmployedTypical.length}`],
      ['平均年収', `${Math.trunc(safeMean(selfEmployedTypical, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(selfEmployedTypical, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 37. 大規模就業 × AI 安全 (workers desc among low-AI)
  const largeWorkforceStable = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.workers && o.workers >= 50000)
    .sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('large-workforce-stable', {
    slug: 'large-workforce-stable',
    items: largeWorkforceStable,
    showSalary: true,
    faqItems: FAQS['large-workforce-stable'],
    title: '大規模就業 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `就業者数 5 万人以上かつ AI 影響度 5 以下の職業 TOP${largeWorkforceStable.length}。日本の労働市場の安定軸を一覧。`,
    h1Text: `大規模就業 × AI 安全 TOP${largeWorkforceStable.length}`,
    subText: '就業者数 <strong>5 万人以上</strong> × AI 影響 <strong>5 以下</strong>',
    introText: '日本の労働人口に占める比重が大きく、かつ AI 影響度も低い「中軸を支える」職業群。看護師・介護福祉士・建設職人・運輸・小売・サービス系等。',
    statBlocks: [
      ['対象職業数', `${largeWorkforceStable.length}`],
      ['TOP 合計就業者数', `${fmtInt(largeWorkforceStable.reduce((s, o) => s + (o.workers ?? 0), 0))} 人`],
      ['平均 AI 影響', `${safeMean(largeWorkforceStable, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 38. 規制で守られた職業 (certs >= 2 + ai_risk <= 5)
  const regulatedProtected = scored
    .filter((o) => o.certs.length >= 2 && (o.ai_risk ?? 999) <= 5)
    .sort((a, b) => b.certs.length - a.certs.length || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('regulated-protected', {
    slug: 'regulated-protected',
    items: regulatedProtected,
    showSalary: true,
    extraColFn: (o) => [`<span class="rl-extra">資格 ${o.certs.length}</span>`],
    faqItems: FAQS['regulated-protected'],
    title: '規制で守られた職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `関連資格 2 個以上かつ AI 影響度 5 以下の職業 TOP${regulatedProtected.length}。参入障壁と AI 抗性を併せ持つ高度専門職を一覧。`,
    h1Text: `規制で守られた職業 TOP${regulatedProtected.length}`,
    subText: '関連資格 <strong>2 個以上</strong> × AI 影響 <strong>5 以下</strong>',
    introText: '複数の関連国家資格を要し、かつ AI 代替リスクも低い職業群。法的に守られた業務範囲を持つ高度専門職が中心です。',
    statBlocks: [
      ['対象職業数', `${regulatedProtected.length}`],
      ['平均資格数', regulatedProtected.length > 0 ? (regulatedProtected.reduce((s, o) => s + o.certs.length, 0) / regulatedProtected.length).toFixed(1) : '—'],
      ['平均年収', `${Math.trunc(safeMean(regulatedProtected, 'salary'))} 万円`],
    ],
  });

  // 39. 低ストレス安定職 (short hours + low AI)
  const lowStressStable = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.monthly_hours && o.monthly_hours <= 165)
    .sort((a, b) => (a.monthly_hours ?? 999) - (b.monthly_hours ?? 999) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('low-stress-stable', {
    slug: 'low-stress-stable',
    items: lowStressStable,
    showSalary: true,
    extraColFn: (o) => (o.monthly_hours ? [`<span class="rl-extra">月${Math.trunc(o.monthly_hours)}h</span>`] : []),
    faqItems: FAQS['low-stress-stable'],
    title: '低ストレス安定職 TOP30【2026年版】| 未来の仕事',
    seoDesc: `月間労働時間 165 時間以下かつ AI 影響度 5 以下の職業 TOP${lowStressStable.length}。長く続けやすい安定職を一覧。`,
    h1Text: `低ストレス安定職 TOP${lowStressStable.length}`,
    subText: '月間労働時間 <strong>165 時間以下</strong> × AI 影響 <strong>5 以下</strong>',
    introText: '労働時間が短く、かつ AI 代替リスクも低い「長く続けやすい」職業群。教育・公務・専門職の一部が該当します。',
    statBlocks: [
      ['対象職業数', `${lowStressStable.length}`],
      ['TOP30 平均月間労働', `${Math.trunc(safeMean(lowStressStable, 'monthly_hours'))} 時間`],
      ['TOP30 平均 AI 影響', `${safeMean(lowStressStable, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // ---- Hub data ----

  const globalStats: Array<readonly [string, string]> = [
    ['総職業数', '556'],
    ['全体平均 AI 影響', `${allMeanRisk.toFixed(1)} / 10`],
    ['全体平均年収', `${Math.trunc(allMeanSalary)} 万円`],
    ['総就業者数', `${Math.round(allWorkers / 10000)} 万人`],
  ];

  const sectorRisks = new Map<string, number[]>();
  for (const o of scored) {
    const sid = o.sector_ja || '';
    if (sid) {
      const arr = sectorRisks.get(sid) ?? [];
      arr.push(o.ai_risk ?? 0);
      sectorRisks.set(sid, arr);
    }
  }
  const sectorMeanRisks = new Map<string, number>();
  for (const [s, v] of sectorRisks.entries()) {
    if (v.length > 0) sectorMeanRisks.set(s, v.reduce((a, b) => a + b, 0) / v.length);
  }
  let highestRiskSector = '';
  let lowestRiskSector = '';
  let maxMean = -Infinity;
  let minMean = Infinity;
  for (const [s, m] of sectorMeanRisks.entries()) {
    if (m > maxMean) {
      maxMean = m;
      highestRiskSector = s;
    }
    if (m < minMean) {
      minMean = m;
      lowestRiskSector = s;
    }
  }

  const insights = [
    `<strong>${escapeHtml(highestRiskSector)}</strong>セクターはAI影響度平均${(sectorMeanRisks.get(highestRiskSector) ?? 0).toFixed(1)}と全セクターで最高`,
    `<strong>${escapeHtml(lowestRiskSector)}</strong>セクターはAI影響度平均${(sectorMeanRisks.get(lowestRiskSector) ?? 0).toFixed(1)}と最も低い`,
    `年収上位30職業の平均AI影響度は<strong>${safeMean(bySalary, 'ai_risk').toFixed(1)}/10</strong>と中程度`,
    '就業者数上位は事務・販売系が占めるが、AI影響度は<strong>高め</strong>の傾向',
    'AI影響度が低い職業ほど<strong>身体性・対人スキル</strong>を求められる傾向',
  ];

  const cards: RankingsBundle['hub']['cards'] = [
    // ── Phase 1 baseline (9) ──
    { slug: 'ai-risk-high', name: 'AIに奪われる仕事 TOP30', desc: 'AI影響度が高い職業ランキング', count: aiHigh.length, preview: makePreview(aiHigh, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-risk-low', name: 'AI影響が少ない仕事 TOP30', desc: 'AIリスクが低く将来性のある職業', count: aiLow.length, preview: makePreview(aiLow, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'salary-safe', name: '高年収×低AIリスク TOP30', desc: '年収が高くAI代替リスクが低い職業', count: salarySafe.length, preview: makePreview(salarySafe, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'workers', name: '就業者数ランキング TOP30', desc: '日本で最も就業者が多い職業', count: byWorkers.length, preview: makePreview(byWorkers, (o) => `${fmtInt(o.workers)}人`) },
    { slug: 'salary', name: '年収ランキング TOP30', desc: '年収が最も高い職業', count: bySalary.length, preview: makePreview(bySalary, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'entry-salary', name: '初任給ランキング TOP30', desc: '初任給が高い職業', count: byEntry.length, preview: makePreview(byEntry, (o) => `初任給 ${Math.trunc(o.recruit_wage ?? 0)}万円`) },
    { slug: 'young-workforce', name: '平均年齢が若い職業 TOP30', desc: '若手が活躍する職業', count: byYoung.length, preview: makePreview(byYoung, (o) => `平均${(o.average_age ?? 0).toFixed(1)}歳`) },
    { slug: 'short-hours', name: '労働時間が短い職業 TOP30', desc: 'ワークライフバランスに優れた職業', count: byHours.length, preview: makePreview(byHours, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}時間`) },
    { slug: 'high-demand', name: '人手不足の職業 TOP30', desc: '求人需要が高い職業', count: byDemand.length, preview: makePreview(byDemand, (o) => DEMAND_JA[o.demand_band ?? ''] ?? '') },
    // ── Phase 2 単軸 (5) ──
    { slug: 'hourly-wage', name: '時給が高い職業 TOP30', desc: '時給ベースで報酬が高い職業', count: byHourly.length, preview: makePreview(byHourly, (o) => `¥${(o.hourly_wage ?? 0).toLocaleString('en-US')}`) },
    { slug: 'recruit-ratio', name: '求人倍率が高い職業 TOP30', desc: '人手不足が顕著な売り手市場', count: byRecruitRatio.length, preview: makePreview(byRecruitRatio, (o) => `${(o.recruit_ratio ?? 0).toFixed(2)}倍`) },
    { slug: 'aging-workforce', name: 'シニア中心の職業 TOP30', desc: '平均年齢が高く経験者が活躍', count: byAging.length, preview: makePreview(byAging, (o) => `平均${(o.average_age ?? 0).toFixed(1)}歳`) },
    { slug: 'monthly-hours-long', name: '労働時間が長い職業 TOP30', desc: '月間労働時間が長い職業', count: byHoursLong.length, preview: makePreview(byHoursLong, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}時間`) },
    { slug: 'recruit-ratio-low', name: '求人倍率が低い職業 TOP30', desc: '採用競争が厳しい買い手市場', count: byRecruitLow.length, preview: makePreview(byRecruitLow, (o) => `${(o.recruit_ratio ?? 0).toFixed(2)}倍`) },
    // ── Phase 2 AI 軸派生 (6) ──
    { slug: 'ai-replaced-soon', name: 'AI 置き換えが進む職業', desc: 'AI 影響度 8 以上、業務再設計が急務', count: aiReplacedSoon.length, preview: makePreview(aiReplacedSoon, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-resistant-craft', name: '伝統技能で AI 抗性が高い職業', desc: '製造・建設・メンテ系の技能職', count: aiResistantCraft.length, preview: makePreview(aiResistantCraft, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-at-risk-but-paid', name: 'AI リスク高 × 高年収', desc: 'AI 影響度高でも現状年収高の要注意組', count: aiAtRiskPaid.length, preview: makePreview(aiAtRiskPaid, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'ai-augmented', name: 'AI で補強される職業', desc: 'AI 影響度 4-6 の AI 共存域', count: aiAugmented.length, preview: makePreview(aiAugmented, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-frontier', name: 'AI を使いこなす側の職業', desc: 'IT・通信セクターの AI フロンティア職', count: aiFrontier.length, preview: makePreview(aiFrontier, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'ai-stable-employment', name: 'AI 安全 × 正規雇用率高', desc: '低 AI 影響かつ正社員中心の安定職', count: aiStableEmployment.length, preview: makePreview(aiStableEmployment, (o) => `正規 ${empPct(o, '正規の職員、従業員').toFixed(0)}%`) },
    // ── Phase 2 組合せ (8) ──
    { slug: 'ai-safe-high-demand', name: '高需要 × AI 安全', desc: '人手不足かつ AI 影響度が低い', count: aiSafeHighDemand.length, preview: makePreview(aiSafeHighDemand, (o) => DEMAND_JA[o.demand_band ?? ''] ?? '') },
    { slug: 'ai-safe-short-hours', name: '低労働時間 × AI 安全', desc: '労働時間が短く AI 影響も低い', count: aiSafeShortHours.length, preview: makePreview(aiSafeShortHours, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}h`) },
    { slug: 'ai-safe-young-workforce', name: '若手中心 × AI 安全', desc: '平均年齢が若くて AI 影響も低い', count: aiSafeYoung.length, preview: makePreview(aiSafeYoung, (o) => `平均${(o.average_age ?? 0).toFixed(1)}歳`) },
    { slug: 'ai-safe-no-license', name: '無資格 × AI 安全', desc: '資格なしで就けて AI 影響も低い', count: aiSafeNoLicense.length, preview: makePreview(aiSafeNoLicense, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-safe-physical', name: '身体性 × AI 安全', desc: '身体技能職で AI 影響も低い', count: aiSafePhysical.length, preview: makePreview(aiSafePhysical, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-safe-interpersonal', name: '対人 × AI 安全', desc: '対人スキル中心で AI 影響も低い', count: aiSafeInterpersonal.length, preview: makePreview(aiSafeInterpersonal, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'high-salary-high-demand', name: '高年収 × 高需要', desc: '年収が高くかつ人手不足の職業', count: highSalaryHighDemand.length, preview: makePreview(highSalaryHighDemand, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'high-salary-young-entry', name: '初任給が高い × 若手活躍', desc: '初任給が高くて若手が多い', count: highSalaryYoungEntry.length, preview: makePreview(highSalaryYoungEntry, (o) => `初任給 ${Math.trunc(o.recruit_wage ?? 0)}万円`) },
    // ── Phase 2 教育・資格軸 (5) ──
    { slug: 'license-required', name: '国家資格が必要な職業', desc: '関連資格が多い高度専門職', count: licenseRequired.length, preview: makePreview(licenseRequired, (o) => `資格 ${o.certs.length}`) },
    { slug: 'no-license-required', name: '無資格で就ける × AI 安全', desc: '資格不要かつ AI リスク低', count: noLicenseRequired.length, preview: makePreview(noLicenseRequired, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'high-school-ok', name: '高卒で目指せる職業', desc: '高卒比率 30% 以上の職業', count: highSchoolOk.length, preview: makePreview(highSchoolOk, (o) => `高卒 ${eduPct(o, '高卒').toFixed(0)}%`) },
    { slug: 'university-required', name: '大卒以上が中心の職業', desc: '大卒比率 50% 以上の職業', count: universityRequired.length, preview: makePreview(universityRequired, (o) => `大卒 ${eduPct(o, '大卒').toFixed(0)}%`) },
    { slug: 'graduate-school-required', name: '大学院卒中心の職業', desc: '修士・博士課程修了者が多い', count: graduateSchoolRequired.length, preview: makePreview(graduateSchoolRequired, (o) => `院卒 ${gradPct(o).toFixed(0)}%`) },
    // ── Phase 2 ニッチ (6) ──
    { slug: 'public-sector', name: '公的機関・公務員系の職業', desc: '保安・公安セクターの公務員職', count: publicSector.length, preview: makePreview(publicSector, (o) => `${fmtInt(o.workers)}人`) },
    { slug: 'freelance-friendly', name: 'フリーランス向きの職業', desc: '自営・フリーランス比率 20% 以上', count: freelanceFriendly.length, preview: makePreview(freelanceFriendly, (o) => `フリー ${empPct(o, '自営、フリーランス').toFixed(0)}%`) },
    { slug: 'self-employed-typical', name: '独立・開業が典型の職業', desc: '独立がキャリアの自然な到達点', count: selfEmployedTypical.length, preview: makePreview(selfEmployedTypical, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'large-workforce-stable', name: '大規模就業 × AI 安全', desc: '就業者 5 万人+ かつ AI 影響低', count: largeWorkforceStable.length, preview: makePreview(largeWorkforceStable, (o) => `${fmtInt(o.workers)}人`) },
    { slug: 'regulated-protected', name: '規制で守られた職業', desc: '関連資格 2 個+ かつ AI 影響低', count: regulatedProtected.length, preview: makePreview(regulatedProtected, (o) => `資格 ${o.certs.length}`) },
    { slug: 'low-stress-stable', name: '低ストレス安定職', desc: '短い労働時間 × 低 AI 影響', count: lowStressStable.length, preview: makePreview(lowStressStable, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}h`) },
  ];

  return { results, hub: { globalStats, insights, cards } };
}

function makePreview(items: Occupation[], metric: (o: Occupation) => string): string {
  if (items.length === 0) return '';
  const top = items[0];
  const name = top.title_ja ?? '';
  return `1位 ${name}（${metric(top)}）`;
}

// ---------------------------------------------------------------------------
// HTML rendering helpers (mirrors the Python render_* functions). Astro can
// `set:html` the strings these return — they all escape user data.
// ---------------------------------------------------------------------------

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function riskBand(score: number | null): 'low' | 'mid' | 'high' {
  if (score === null) return 'mid';
  if (score <= 3) return 'low';
  if (score <= 6) return 'mid';
  return 'high';
}

export function renderRankItem(
  o: Occupation,
  showSalary: boolean,
  extraCols: string[] | null,
): string {
  const title = o.title_ja ?? `#${o.id}`;
  const score = o.ai_risk;
  const scoreStr = score === null ? '—' : `${score}/10`;
  const band = riskBand(score);
  const sector = o.sector_ja || '';
  const salary = o.salary;
  const workers = o.workers;

  const statsParts: string[] = [
    `<span class="risk-pill ${band}">${escapeHtml(scoreStr)}</span>`,
  ];
  if (extraCols) statsParts.push(...extraCols);
  if (showSalary && salary) {
    statsParts.push(`<span class="rl-salary">${Math.trunc(salary)}万円</span>`);
  }
  if (workers) {
    statsParts.push(`<span class="rl-workers">${fmtInt(workers)}人</span>`);
  }

  const sectorHtml = sector ? `<span class="rl-sector">${escapeHtml(sector)}</span>` : '';
  return (
    `<li>` +
    `<div class="rl-main">` +
    `<a class="rl-name" href="/ja/${o.id}">${escapeHtml(title)}</a>` +
    `${sectorHtml}` +
    `</div>` +
    `<div class="rl-stats">${statsParts.join('')}</div>` +
    `</li>`
  );
}

export function renderHighlights(items: Occupation[], slug: RankingSlug): string {
  if (items.length === 0) return '';
  const top = items[0];
  const name = top.title_ja ?? '';
  const hl: string[] = [];

  if (slug === 'ai-risk-high' || slug === 'ai-risk-low') {
    hl.push(`1位は「${name}」（AI影響度 ${top.ai_risk}/10）`);
  } else if (slug === 'salary') {
    hl.push(`1位は「${name}」（年収 ${Math.trunc(top.salary ?? 0)}万円）`);
  } else if (slug === 'entry-salary') {
    hl.push(`1位は「${name}」（初任給 ${Math.trunc(top.recruit_wage ?? 0)}万円）`);
  } else if (slug === 'young-workforce') {
    hl.push(`1位は「${name}」（平均年齢 ${(top.average_age ?? 0).toFixed(1)}歳）`);
  } else if (slug === 'short-hours') {
    hl.push(`1位は「${name}」（月間 ${Math.trunc(top.monthly_hours ?? 0)}時間）`);
  } else if (slug === 'high-demand') {
    hl.push(`1位は「${name}」（求人需要：${DEMAND_JA[top.demand_band ?? ''] ?? ''}）`);
  } else {
    hl.push(`1位は「${name}」`);
  }

  // Top sector
  const sectorCounts = new Map<string, number>();
  for (const o of items) {
    if (o.sector_ja) sectorCounts.set(o.sector_ja, (sectorCounts.get(o.sector_ja) ?? 0) + 1);
  }
  let topSector = '';
  let topSectorCnt = 0;
  for (const [s, c] of sectorCounts.entries()) {
    if (c > topSectorCnt) {
      topSectorCnt = c;
      topSector = s;
    }
  }
  if (topSector) {
    hl.push(`TOP${items.length}の中で「${topSector}」セクターが${topSectorCnt}件と最多`);
  }

  const meanSal = safeMean(items, 'salary');
  const meanRisk = safeMean(items, 'ai_risk');
  if (meanSal > 0) {
    hl.push(`TOP${items.length}の平均年収は${Math.trunc(meanSal)}万円、平均AI影響度は${meanRisk.toFixed(1)}/10`);
  }

  const itemsHtml = hl.map((h) => `<li>${escapeHtml(h)}</li>`).join('');
  return `<div class="highlights"><ul>${itemsHtml}</ul></div>`;
}

export function renderSectorChart(items: Occupation[]): string {
  const counts = new Map<string, number>();
  for (const o of items) {
    if (o.sector_ja) counts.set(o.sector_ja, (counts.get(o.sector_ja) ?? 0) + 1);
  }
  if (counts.size === 0) return '';
  const ordered = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const maxCount = ordered[0][1];
  const rows = ordered.slice(0, 6).map(([sec, cnt]) => {
    const pct = Math.trunc((cnt / maxCount) * 100);
    return (
      `<div class="sb-row">` +
      `<span class="sb-label">${escapeHtml(sec)}</span>` +
      `<span class="sb-track"><span class="sb-fill" style="width:${pct}%"></span></span>` +
      `<span class="sb-count">${cnt}件</span>` +
      `</div>`
    );
  }).join('');
  return (
    `<div class="sector-chart">` +
    `<div class="sc-title">セクター内訳（TOP${items.length}）</div>` +
    `${rows}` +
    `</div>`
  );
}

export function renderFaqHtml(faqItems: ReadonlyArray<readonly [string, string]>): string {
  if (faqItems.length === 0) return '';
  const details = faqItems.map(([q, a]) =>
    `<details><summary>${escapeHtml(q)}</summary>` +
    `<div class="faq-a">${escapeHtml(a)}</div></details>`,
  ).join('');
  return (
    `<section class="faq" aria-label="よくある質問">` +
    `<h2>よくある質問</h2>` +
    `${details}` +
    `</section>`
  );
}

export function renderRelatedRankings(currentSlug: RankingSlug): string {
  const items = ALL_RANKINGS
    .filter(([slug]) => slug !== currentSlug)
    .map(([slug, name, desc]) =>
      `<li><a href="/ja/rankings/${slug}">` +
      `${escapeHtml(name)}` +
      `<span class="rr-desc">${escapeHtml(desc)}</span>` +
      `</a></li>`,
    ).join('');
  return `<ul class="related-rankings">${items}</ul>`;
}

// ---------------------------------------------------------------------------
// JSON-LD per ranking page (mirrors render_jsonld).
// ---------------------------------------------------------------------------

const SITE = 'https://mirai-shigoto.com';
const DATE_PUBLISHED = '2026-05-06';
const DATE_MODIFIED = '2026-05-06';

export function renderJsonLd(
  canonical: string,
  title: string,
  description: string,
  items: Occupation[],
  faqItems: ReadonlyArray<readonly [string, string]> | null,
): string {
  const itemList = items.map((o, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE}/ja/${o.id}`,
    name: o.title_ja ?? `#${o.id}`,
  }));

  const graph: unknown[] = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: { '@id': `${SITE}/#website` },
      inLanguage: 'ja',
      datePublished: DATE_PUBLISHED,
      dateModified: DATE_MODIFIED,
      publisher: { '@id': `${SITE}/#organization` },
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
    },
    {
      '@type': 'Article',
      '@id': `${canonical}#article`,
      headline: title,
      description,
      // Per-ranking OG card. The slug comes off the canonical URL —
      // canonical is `${SITE}/ja/rankings/<slug>`.
      image:
        `${SITE}/api/og?ranking=${
          canonical.match(/\/rankings\/([^/?#]+)/)?.[1] ?? ''
        }`,
      url: canonical,
      datePublished: DATE_PUBLISHED,
      dateModified: DATE_MODIFIED,
      author: { '@id': `${SITE}/#organization` },
      publisher: { '@id': `${SITE}/#organization` },
      inLanguage: 'ja',
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
      isPartOf: { '@id': `${canonical}#webpage` },
      articleSection: 'ランキング',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'ランキング', item: `${SITE}/ja/rankings` },
        { '@type': 'ListItem', position: 3, name: title, item: canonical },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': `${canonical}#list`,
      name: title,
      numberOfItems: itemList.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: itemList,
    },
  ];

  if (faqItems && faqItems.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: faqItems.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

export function renderHubJsonLd(): string {
  const canonical = `${SITE}/ja/rankings`;
  const seoDesc = '日本556職業をAI影響度・年収・初任給・就業者数・労働時間・求人需要で10の視点でランキング。AIに奪われやすい仕事、高年収×低AIリスクの職業などを一覧。';
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: '職業ランキング',
        description: seoDesc,
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'ja',
        datePublished: DATE_PUBLISHED,
        dateModified: DATE_MODIFIED,
        publisher: { '@id': `${SITE}/#organization` },
        breadcrumb: { '@id': `${canonical}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'ランキング', item: canonical },
        ],
      },
    ],
  }, null, 2);
}
