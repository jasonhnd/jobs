/**
 * Public Japanese copy of the HAID current-state page (/aiadoption).
 *
 * Every string here is owner-signed before it ships; the page copies them
 * byte-for-byte. Level names, criteria, relation taglines and boundary names
 * are NOT here — they come from src/site/haid-spec.ts (docs/HAID.md).
 *
 * Strings that carry numbers are templates: the page fills `{…}` from the
 * release payload (formatted by src/site/haid-release-format.ts).
 */

export const HAID_RELEASE_PAGE_NAME_JA = '人類と AI の距離';

/** h1 (Display, §4.8). */
export const HAID_RELEASE_H1_JA = '人類と AI の距離';

/** Lead sentence under the h1. {population} and {prompted} are formatted people. */
export const HAID_RELEASE_LEAD_TEMPLATE_JA =
  '人類 {population} 人のうち、自分から AI に話しかけた人は およそ {prompted} 人。';

/** Meta line parts, joined with 「 ・ 」. */
export const HAID_RELEASE_META_JA = {
  asOf: '時点 {asOf}',
  published: '公開 {published}',
  plannedPublish: '公開予定 {planned}',
  round: '第 {n} 回',
  spec: '定義は HAID v{version}',
  draft: '草稿',
  draftNote: 'この回は草稿です。錨点は出典と未照合で、公開時に数字が変わります。',
} as const;

/** Legend line above the map. */
export const HAID_RELEASE_LEGEND_JA = {
  area: '面積 ≈ 人数（人類 {population} 人）',
  hatch: '斜線 = データなし',
  axis: '左が遠く、右が AI に近い',
} as const;

/** Map notes (below the boundary names). */
export const HAID_RELEASE_MAP_NOTE_JA = {
  inflated: '{levels} は、実際の割合より大きく描いています。',
  lowerBound: '第 {level} 段階は下限しか分からないため、隣との境目を破線で描いています。',
  clamped: '第 {level} 段階の公表値は第 {next} 段階の推定を下回るため、入れ子の規則で第 {next} 段階の値に合わせています。',
} as const;

export const HAID_RELEASE_YOU_ARE_HERE_JA = 'あなたはここ';

/** List section. */
export const HAID_RELEASE_LIST_JA = {
  heading: '10 段階 ── 第 k 段階以上にいる人数',
  intro: '条の長さが「その段階以上にいる人」の数。地図の面積は「ちょうどその段階にいる人」の数。段階を押すと、判定と数え方が開きます。',
  criterion: '判定',
  exactly: 'ちょうどこの段階にいる人 n({level})',
  method: 'どう数えたか',
  anchorsUsed: '使った数字',
  definition: '定義を見る',
  payment: '対価を払っている人は段階ではなく属性として別に数えます。{payment}',
  paymentNone: '今回は公表値がないため報告しません。',
} as const;

/** 前回との変動. */
export const HAID_RELEASE_DELTA_JA = {
  heading: '前回との変動',
  first: '今回は第 1 回のため比較はありません。次回（{next}）から、増えた段階・減った段階を並べます。',
  intro: '前回（{previous}）と今回の、第 k 段階以上にいる人数の差。錨点や確度が変わった段階は、差ではなく「数え方が変わった」と示します。',
  up: '増えた',
  down: '減った',
  flat: '変わらず',
  methodChanged: '数え方が変わった',
  noData: 'どちらかにデータなし',
  colLevel: '段階',
  colPrevious: '前回',
  colNow: '今回',
  colDelta: '差',
} as const;

/** 回の切り替え（見出し下のピル）. */
export const HAID_RELEASE_SWITCH_JA = {
  label: '公開回',
  latest: '最新',
  permalink: 'この回の URL',
} as const;

/** Global nav / drawer / footer label and the drawer's one-line meta. */
export const HAID_RELEASE_NAV_JA = {
  label: '人類と AI の距離',
  drawerMeta: '人類 83 億人が生成 AI からどれだけ離れているか',
} as const;

/** OG card (src/views/og-cards.ts). */
export const HAID_RELEASE_OG_JA = {
  eyebrow: 'HAID · 人類と AI の距離',
  title: '人類と AI の距離 — 四半期の現状',
  subtitle: '人類 83 億人を HAID 10 段階に置いた地図。無縁・道具・同席・一体、確度と出典つき',
} as const;

/** 公開されている数字 (anchor table). */
export const HAID_RELEASE_ANCHORS_JA = {
  heading: '公開されている数字',
  intro: '各社が自分で公表した利用者数。推計ではなく、そのままの数字です。',
  colWhat: '数字',
  colMetric: '何の数字か',
  colValue: '値',
  colDate: '日付',
  colGrade: '等級',
  placeholder: '未照合',
} as const;

/** 引用用ファクト. */
export const HAID_RELEASE_FACT_JA = {
  label: '{label} の引用用ファクト：',
  body:
    '人類 {population} 人のうち、インターネットに届いていない人は {unreached} 人。自分から生成 AI に話しかけた人（HAID 第 4 段階以上）は およそ {prompted} 人、週に 1 回以上使う人（第 5 段階以上）は およそ {weekly} 人。第 7 段階以上は公開データなし。（出典：各社公表値 ＋ HAID v{version}、時点 {asOf}、mirai-shigoto.com）',
  /** Used when the release has no 7-day figure (第 5 段階 データなし). */
  bodyNoWeekly:
    '人類 {population} 人のうち、インターネットに届いていない人は {unreached} 人。自分から生成 AI に話しかけた人（HAID 第 4 段階以上）は およそ {prompted} 人。第 5 段階以上はこの回は公開データなし。（出典：各社公表値 ＋ HAID v{version}、時点 {asOf}、mirai-shigoto.com）',
} as const;

/** Footer sentence. {diagnosis} is the diagnosis page path. */
export const HAID_RELEASE_FOOT_JA = {
  basedOn: 'この現状は',
  spec: 'HAID v{version}（人類と AI の距離 10 段階）',
  basedOnTail: 'にもとづきます。',
  diagnosis: '自分が第何段階かは',
  diagnosisLink: '診断',
  diagnosisTail: 'へ。',
} as const;

/** <title> / description / OG. */
export const HAID_RELEASE_SEO_JA = {
  title: '人類と AI の距離 — {label} | 未来の仕事',
  description:
    '人類 {population} 人が、生成 AI からどれだけ離れているか。HAID 10 段階（無縁・道具・同席・一体）ごとの人数を、確度と出典つきで四半期ごとに公開する現状ページ。{label}。',
  ogTitle: '人類と AI の距離 — {label}',
  ogDescription: '人類 {population} 人のうち、自分から AI に話しかけた人は およそ {prompted} 人。HAID 10 段階で見る現状。',
  keywords: '人類と AI の距離, HAID, 生成 AI, AI 利用者数, 10 段階, 世界, ChatGPT, Gemini, 現状',
} as const;

/** Breadcrumb tail for the current release. */
export const HAID_RELEASE_CRUMB_JA = '人類と AI の距離';

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => {
    const v = values[key];
    if (v === undefined) throw new Error(`[haid-release-copy] missing template value: ${key}`);
    return v;
  });
}
