/**
 * risk-band-rule.test.ts — one band rule for every per-occupation surface (#631).
 *
 * Every band, colour and tier word attached to a displayed score is derived
 * from the DISPLAYED value (displayScore, one-decimal banker rounding) with
 * the cut points low < 4.0 <= mid < 7.0 <= high. Three-vendor means are
 * multiples of 1/30, so the sweep covers every value the public panel can
 * produce today, including 3.9666… (prints 4.0) and 6.9666… (prints 7.0).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { displayScore } from '../data/lib/banker-round.js';
import { riskBand, type RiskBand } from '../data/lib/bands.js';
import { riskClass } from '../lib/risk.js';
import { pickRiskOneLineCallout } from '../lib/risk-callout.js';
import { buildOccupationSeo } from './occupation-seo.js';
import { buildOccupationFaqs } from './occupation-faqs.js';
import { buildSectorFaqs } from './sector-faqs.js';

const SEO_WORD: Record<RiskBand, string> = { low: '低め', mid: '中程度', high: '高め' };
const FAQ1_WORD: Record<RiskBand, string> = {
  low: '低めで、AI に代替されにくい職業',
  mid: '中程度で、業務の一部が AI 補助に移行する可能性',
  high: '高めで、業務の多くが AI による代替・補助の対象となる可能性',
};
const FAQ2_WORD: Record<RiskBand, string> = {
  low: 'AI に代替されにくく、将来性は比較的安定',
  mid: 'AI 影響は中程度で、業務の一部が AI 補助に移行する可能性',
  high: 'AI による業務変化が大きく見込まれ、スキルアップや関連職種への転換も視野に',
};

function expectedBand(x: number): RiskBand {
  const shown = displayScore(x);
  return shown < 4.0 ? 'low' : shown < 7.0 ? 'mid' : 'high';
}

function calloutBand(x: number): RiskBand {
  const line = pickRiskOneLineCallout(x);
  if (line.startsWith('低 AI 影響')) return 'low';
  if (line.startsWith('AI 影響度は中程度')) return 'mid';
  return 'high'; // AI 影響度が高い / 定型業務が中心
}

function seoDescription(x: number): string {
  return buildOccupationSeo({
    nameJa: '職業',
    aiRisk: x,
    salaryStanding: null,
    workers: null,
    aliasesJa: [],
  }).description;
}

function faqAnswers(x: number): readonly string[] {
  return buildOccupationFaqs({
    nameJa: '職業',
    salaryMan: null,
    workers: null,
    recruitRatio: null,
    aiRisk: x,
    aiRationaleJa: '',
    howToBecomeJa: '',
    skillsTop10: [],
  }).map(([, answer]) => answer);
}

const SWEEP = Array.from({ length: 301 }, (_, k) => k / 30);

describe('one band rule (#631)', () => {
  test('named cases: the band follows the printed one-decimal value', () => {
    assert.equal(riskBand(3.9666666666666663), 'mid'); // prints 4.0
    assert.equal(riskBand(6.966666666666667), 'high'); // prints 7.0
    assert.equal(riskBand(3.95), 'mid'); // prints 4.0
    assert.equal(riskBand(3.9333333333333336), 'low'); // prints 3.9
    assert.equal(riskBand(null), null);
    assert.equal(riskBand(undefined), null);
  });

  test('riskBand and riskClass agree with the displayed value for every k/30', () => {
    for (const x of SWEEP) {
      const want = expectedBand(x);
      assert.equal(riskBand(x), want, `riskBand(${x})`);
      assert.equal(riskClass(x), want, `riskClass(${x})`);
    }
  });

  test('the SEO description prints the displayed value and its tier word', () => {
    for (const x of SWEEP) {
      const want = expectedBand(x);
      assert.ok(
        seoDescription(x).includes(`AI影響度は10段階中${displayScore(x)}と${SEO_WORD[want]}です。`),
        `seo(${x})`,
      );
    }
  });

  test('both FAQ answers use the same band, from the printed value', () => {
    for (const x of SWEEP) {
      const want = expectedBand(x);
      const answers = faqAnswers(x);
      const shown = displayScore(x).toFixed(1);
      assert.ok(
        answers.some((a) => a.includes(`10段階中 ${shown} で、${FAQ1_WORD[want]}です。`)),
        `faq answer 1 (${x})`,
      );
      assert.ok(
        answers.some((a) => a.includes(`AI影響度 ${shown}/10。${FAQ2_WORD[want]}な職業です。`)),
        `faq answer 2 (${x})`,
      );
    }
  });

  test('the fallback callout line follows the displayed value', () => {
    for (const x of SWEEP) assert.equal(calloutBand(x), expectedBand(x), `callout(${x})`);
    assert.equal(pickRiskOneLineCallout(8.966666666666667).startsWith('定型業務が中心'), true); // prints 9.0
  });

  test('no view keeps an integer-era local classifier', () => {
    for (const file of ['compare.ts', 'hub.ts', 'sector.ts']) {
      const source = readFileSync(join(import.meta.dirname, file), 'utf8');
      assert.match(source, /import \{ riskBand \} from '\.\.\/data\/lib\/bands\.js';/, file);
      assert.doesNotMatch(source, /function riskBand\(/, file);
      assert.doesNotMatch(source, /<= 3\)|<= 6\)/, file);
    }
  });
});

describe('group-mean tier words are judged on the printed mean (#631)', () => {
  test('sector FAQ: 3.54 prints 3.5 and reads 低め (cut point <= 3.5)', () => {
    const faqs = buildSectorFaqs({
      nameJa: '業種',
      occupationCount: 2,
      workforceTotal: 100,
      meanRisk: 3.54,
      topWorkers: [],
      topHigh: [],
      topLow: [],
    });
    const answer = faqs.map(([, a]) => a).find((a) => a.includes('の平均 AI 影響度は10段階中'));
    assert.ok(answer?.includes('10段階中 3.5 で、低めの水準です。'), answer);
  });

  test('genre and interest hubs print and judge the same rounded mean', () => {
    for (const file of ['genre-hub.ts', 'interests.ts']) {
      const source = readFileSync(join(import.meta.dirname, file), 'utf8');
      assert.match(source, /const shownMean = displayScore\(meanRisk\);/, file);
      assert.match(source, /shownMean <= 3\.5 \? '低め' : shownMean <= 5\.5 \? '中程度' : 'やや高め'/, file);
      assert.match(source, /\$\{shownMean\.toFixed\(1\)\}\/10/, file);
    }
  });
});
