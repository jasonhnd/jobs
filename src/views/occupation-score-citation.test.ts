import { expect, test } from 'bun:test';
import { occupationScoreCitation } from './occupation-score-citation';
import { buildOccupationSummary } from './occupation-summary';
import { SCORE_ATTRIBUTION } from '../site/score-attribution';
import { CONSENSUS_HEADLINE_LABEL } from '../site/consensus-copy';

const input = { nameJa: '職業 & <test>', score: 4.25, scoreText: '4.2', occupationCount: 123, date: '2099-01-02' };

test('signed text uses the supplied displayed score, count and date verbatim', () => {
  expect(occupationScoreCitation(input)).toBe(`職業 & <test>のAI影響度は4.2/10（${SCORE_ATTRIBUTION.standardLabel}・${CONSENSUS_HEADLINE_LABEL}、対象123職業、最新採点 2099-01-02）です。本サイトの独自分析（非公式）で、失業の確率ではありません。職業情報の出典：厚生労働省 jobtag。 `);
  expect(occupationScoreCitation({ ...input, occupationCount: 456, date: '2098-03-04' })).toContain('対象456職業、最新採点 2098-03-04');
});

test('missing and non-finite scores omit the citation and preserve the ordinary unscored label', () => {
  for (const score of [null, undefined, NaN, Infinity, -Infinity]) {
    expect(occupationScoreCitation({ ...input, score })).toBe(null);
    if (score !== undefined) {
      const summary = buildOccupationSummary({ id: 404, name_ja: input.nameJa, ai_risk: score, salary: null, hours: null });
      expect(summary.scoreText).toBe('未評価');
      expect(occupationScoreCitation({ ...input, score: summary.score, scoreText: summary.scoreText })).toBe(null);
    }
  }
});
