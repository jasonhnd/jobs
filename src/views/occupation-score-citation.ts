import { SCORE_ATTRIBUTION } from '../site/score-attribution';
import { CONSENSUS_HEADLINE_LABEL } from '../site/consensus-copy';

/** Plain text only: the Astro component escapes values when rendering it. */
export function occupationScoreCitation(input: {
  nameJa: string;
  score: number | null | undefined;
  scoreText: string;
  occupationCount: number;
  date: string;
}): string | null {
  if (input.score == null || !Number.isFinite(input.score)) return null;
  return `${input.nameJa}のAI影響度は${input.scoreText}/10（${SCORE_ATTRIBUTION.standardLabel}・${CONSENSUS_HEADLINE_LABEL}、対象${input.occupationCount}職業、最新採点 ${input.date}）です。本サイトの独自分析（非公式）で、失業の確率ではありません。職業情報の出典：厚生労働省 jobtag。 `;
}
