/**
 * signed-band-copy.test.ts — visitor-facing source no longer uses the
 * retired score-band words (JOB_0212). This is a unit test, not an npm script.
 *
 * Sentence-level copy that still needs an owner signature stays in ALLOW.
 * Comments are stripped before the scan. 低め / 中程度 / 高め fail only on a
 * line that also talks about an AI score.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

const SRC = join(import.meta.dirname, '..');

/** Paths relative to src/. A prefix matches a file or a directory. */
const ALLOW = [
  'lib/risk-callout.ts',
  'lib/ai-fact-summary.ts',
  'lib/canonical/doc.ts',
  'views/occupation-faqs.ts',
  'views/ranking-copy.ts',
  'views/qa-items/',
  'views/genre-configs/',
  'views/ranking/build.ts',
  'views/ranking/rankings/',
  'views/geo-answer-topics.ts',
  'pages/yearly/',
  'pages/standard.astro',
  'pages/map.astro',
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
];

const CONDITIONAL = ['低め', '中程度', '高め'];
const SCORE_CONTEXT = /AI|影響|\/10|リスク/;

function allowed(rel: string): boolean {
  return ALLOW.some((prefix) => rel === prefix || rel.startsWith(prefix));
}

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

describe('retired score-band words stay out of visitor copy', () => {
  test('src has no retired band word outside the owner-signature allowlist', () => {
    const files: string[] = [];
    walk(SRC, files);
    const hits: string[] = [];
    for (const path of files) {
      const rel = relative(SRC, path);
      if (allowed(rel)) continue;
      const lines = stripComments(readFileSync(path, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        for (const token of ALWAYS) {
          if (line.includes(token)) hits.push(`${rel}:${i + 1} ${token}`);
        }
        if (SCORE_CONTEXT.test(line)) {
          for (const token of CONDITIONAL) {
            if (line.includes(token)) hits.push(`${rel}:${i + 1} ${token}`);
          }
        }
      });
    }
    assert.deepEqual(hits, [], hits.join('\n'));
  });
});
