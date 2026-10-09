/**
 * signed-band-copy.test.ts — visitor-facing source no longer uses the
 * retired score-band words (JOB_0212, JOB_0214). This is a unit test, not an
 * npm script.
 *
 * ALLOW lists each remaining sentence one by one: a file plus a phrase from
 * that sentence. A hit passes only when its line contains the phrase and the
 * phrase contains the hit word, so a new use of an old word in an allowlisted
 * file still fails. An entry that no longer matches anything also fails, so
 * the list shrinks as sentences are signed and rewritten.
 *
 * Comments are stripped before the scan. CONDITIONAL words fail only on a
 * line that also talks about an AI score.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

const SRC = join(import.meta.dirname, '..');

/** [path relative to src/, phrase from the allowed sentence]. */
const ALLOW: ReadonlyArray<readonly [string, string]> = [
  // 仕事が減るリスク (displacement) explanation, not the AI-impact band.
  ['lib/ai-fact-summary.ts', '職そのものが大きく減るリスクは低め'],
  ['lib/ai-fact-summary.ts', '職そのものが縮小するリスクも相対的に高め'],
  ['lib/ai-fact-summary.ts', '業務の再設計が進みやすい中程度のリスク'],
  // Occupation FAQ 将来性 clause (not in the signed set).
  ['views/occupation-faqs.ts', 'AI 影響は中程度で、業務の一部が AI 補助に移行する可能性がある'],
  // Ranking intros, hub descriptions and FAQ prose waiting for a rewrite.
  ['views/ranking/rankings/high-risk.ts', '現場職が低 AI 影響度のまま安定する'],
  ['views/ranking/rankings/employment.ts', '低 AI 影響度かつ正社員比率が高い'],
  ['views/ranking/rankings/employment.ts', 'AI 影響度も低めの傾向です'],
  ['views/ranking/rankings/intent.ts', '求人需要 <strong>高め以上</strong>'],
  ['views/ranking/build.ts', 'と全セクターで最高'],
  ['views/ranking/build.ts', '低 AI 影響かつ正社員中心の安定職'],
  ['views/ranking/build.ts', '短い労働時間 × 低 AI 影響'],
  ['views/rankings-meta.ts', '低 AI 影響かつ安定雇用率が高い職業'],
  ['views/genre-configs/life-balance.ts', '平均年齢が高めで体力負荷が控えめ'],
  ['views/ranking-copy.ts', 'IT系は高め、サービス・建設系は低めと'],
  ['views/ranking-copy.ts', '時給が高く AI 影響度も低めの傾向です'],
  ['views/ranking-copy.ts', 'AI 影響 大職業から転職するには？'],
  ['views/ranking-copy.ts', '現場職が低 AI 影響度のまま残りやすい'],
  ['views/ranking-copy.ts', '完全代替されるリスクは低めですが'],
  ['views/ranking-copy.ts', '影響度自体は高めに出ます'],
  ['views/ranking-copy.ts', '公安系など、低 AI 影響かつ正社員が中心'],
  ['views/ranking-copy.ts', 'IT 系は AI 影響度が高めの面もありますが'],
  ['views/ranking-copy.ts', '学歴ハードルが低く AI 影響度も低めです'],
  ['views/ranking-copy.ts', '臨床判断を要する分野は AI 影響度が低めですが'],
  ['views/ranking-copy.ts', 'キャリアが構築でき、AI 影響度も低めの傾向です'],
  ['views/ranking-copy.ts', '職業自体が消えるリスクは低めですが'],
  // Q&A bodies.
  ['views/qa-items/career.ts', '最も避けたいのは AI 影響 大 + 専門性が育ちにくい'],
  ['views/qa-items/career.ts', 'AI 影響 大の事務系から低 AI の対人・現場系'],
  ['views/qa-items/aptitude.ts', '理系職に比べ AI 影響 大の分野が含まれる'],
  ['views/qa-items/aptitude.ts', 'IT 系は AI 影響度が高めですが'],
  ['views/qa-items/sector-future.ts', 'AI 影響度は全業種で最高'],
  ['views/qa-items/sector-future.ts', 'トラック運転手の AI 影響度は中程度'],
  ['views/qa-items/sector-future.ts', '教育系の AI 影響度は中程度'],
  ['views/qa-items/career-extra.ts', '大企業が中小より高め'],
  ['views/qa-items/ai-anxiety.ts', '低 AI 影響度 (3 以下)'],
  // Methodology example and AIOIS dimension chips (not score bands).
  ['pages/pro/methodology.astro', '最高は 9.5'],
  ['pages/pro/standard.astro', '高いほど影響大'],
  ['pages/pro/standard.astro', '高いほど人が有利・影響小'],
  ['pages/pro/standard.astro', '緑＝働く人に有利・影響小、赤＝影響大'],
  // Annual report body.
  ['pages/pro/yearly/2026-report.astro', 'AI 影響も 7.1/10 と高め'],
  ['pages/pro/yearly/2026-report.astro', 'IT・通信も高め'],
  ['pages/pro/yearly/2026-report.astro', '翻訳者 7.1）が高めの一方'],
  ['pages/pro/yearly/2026-report.astro', '高学歴の事務系専門職が高め'],
  ['pages/pro/yearly/2026-report.astro', 'AI 影響 大の事務系からの転換'],
  // Home hub-card descriptions.
];

const ALWAYS = [
  '低リスク',
  '高リスク',
  '中低',
  'やや高め',
  '▲ 影響大',
  '◎ 影響小',
  '▼ 中程度',
  '大きく変わる仕事',
  'AI 影響 低',
  'AI 影響 中',
  'AI 影響 高',
  'AI 影響 大',
  '影響 大',
  '影響 小',
  '影響大',
  '影響小',
  '高影響',
  '低 AI 影響',
];

const CONDITIONAL = ['低め', '中程度', '高め', '最高'];
const SCORE_CONTEXT = /AI|影響|\/10|リスク/;

function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|js|astro|html)$/.test(name) && !name.endsWith('.test.ts')) out.push(path);
  }
}

function tokensOnLine(line: string): string[] {
  const found = ALWAYS.filter((token) => line.includes(token));
  if (!SCORE_CONTEXT.test(line)) return found;
  return [...found, ...CONDITIONAL.filter((token) => line.includes(token))];
}

function scan(): { hits: string[]; used: Set<number> } {
  const files: string[] = [];
  walk(SRC, files);
  const hits: string[] = [];
  const used = new Set<number>();
  for (const path of files) {
    const rel = relative(SRC, path);
    const lines = stripComments(readFileSync(path, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      for (const token of tokensOnLine(line)) {
        const index = ALLOW.findIndex(
          ([file, phrase]) => file === rel && phrase.includes(token) && line.includes(phrase),
        );
        if (index === -1) hits.push(`${rel}:${i + 1} ${token}`);
        else used.add(index);
      }
    });
  }
  return { hits, used };
}

describe('retired score-band words stay out of visitor copy', () => {
  const { hits, used } = scan();

  test('src has no retired band word outside the per-sentence allowlist', () => {
    assert.deepEqual(hits, [], hits.join('\n'));
  });

  test('every allowlist entry still matches a sentence', () => {
    const stale = ALLOW.filter((_, i) => !used.has(i)).map(([file, phrase]) => `${file} ${phrase}`);
    assert.deepEqual(stale, [], stale.join('\n'));
  });

  test('signed rewrites replaced the old sentences', () => {
    // The nine sentences signed on 2026-10-08 (#888) must not come back.
    const retired = [
      '低 AI 影響。専門性',
      'AI 影響度は中程度。業務の一部',
      'AI 影響度が高い。業務再設計',
      '低めで、AI に代替されにくい職業',
      '中程度で、業務の一部が AI 補助に移行する可能性\'',
      '高めで、業務の多くが',
      'AI で大きく変わる仕事を一目で確認',
      'AI影響度が中程度以下で',
      'AI影響度は<strong>高め</strong>の傾向',
      '低は 4.0 未満、中は 4.0 以上',
      '高影響職業の賃金',
    ];
    const files: string[] = [];
    walk(SRC, files);
    const found: string[] = [];
    for (const path of files) {
      const source = stripComments(readFileSync(path, 'utf8'));
      for (const phrase of retired) {
        if (source.includes(phrase)) found.push(`${relative(SRC, path)} ${phrase}`);
      }
    }
    assert.deepEqual(found, [], found.join('\n'));
  });
});
