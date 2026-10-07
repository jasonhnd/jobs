/**
 * mean-score-format.test.ts — AI-impact means print with banker's rounding
 * (#864). `toFixed(1)` rounds half away from zero, so a TOP30 mean of 4.25
 * printed 4.3 while every row and the occupation pages print 4.2.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderRankingSummary } from '../templates/Ranking.js';
import type { Occupation } from './ranking/config.js';

const SRC = join(import.meta.dirname, '..');

const FILES = [
  'templates/Ranking.ts',
  'views/ranking/build.ts',
  'views/ranking/rankings/education.ts',
  'views/ranking/rankings/employment.ts',
  'views/ranking/rankings/high-risk.ts',
  'views/ranking/rankings/intent.ts',
  'views/ranking/rankings/low-risk.ts',
  'views/ranking/rankings/salary.ts',
  'views/ranking/rankings/work-conditions.ts',
  'views/ranking/rankings/workforce.ts',
  'views/genre-hub.ts',
  'views/interests.ts',
  'views/skills-hub.ts',
  'pages/sectors/[sector].astro',
  'pages/sectors/_sector-bindings.ts',
  'pages/careers/_career-bindings.ts',
  'pages/licenses/_license-bindings.ts',
  'pages/q/_q-bindings.ts',
  'pages/answers/[topic].astro',
  'site/home-facts-render.ts',
];

/** Expressions that hold an AI-impact score or mean in the files above. */
const RAW_MEAN_TO_FIXED =
  /(?:'ai_risk'\)|\bmeanRisk|\bmeanHigh|\bmeanLow|\bmeanAiReplaced|\bmeanRiskSS|\ballMeanRisk|sectorMeanRisks\.get\([^)]*\) \?\? 0\)|safeMean\(scores\)|aiImpact|meanAiImpactRaw)\.toFixed\(1\)/;

describe('AI-impact means use banker rounding (#864)', () => {
  test('no file prints an AI-impact mean with toFixed(1)', () => {
    for (const file of FILES) {
      const source = readFileSync(join(SRC, file), 'utf8');
      assert.doesNotMatch(source, RAW_MEAN_TO_FIXED, file);
    }
  });

  test('a ranking summary mean of 4.25 prints 4.2, like its rows', () => {
    const occ = (id: number, ai_risk: number) => ({ id, title_ja: `job-${id}`, ai_risk }) as Occupation;
    const html = renderRankingSummary([occ(1, 4.0), occ(2, 4.5)]);
    assert.match(html, /4\.2\/10/);
    assert.doesNotMatch(html, /4\.3\/10/);
  });
});
