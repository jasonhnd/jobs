/**
 * Share text and OG metadata for the diagnostic (#237).
 *
 * Identity-only when there is no occupation (no number). Measurement-led
 * when a job title and AI-impact score are present.
 */
import { LABELS, SHARE } from './worktype-copy.js';
import { formatRiskScore } from '../lib/score-format.js';

function formatShareScore(score: number | null | undefined): string | null {
  if (score == null || typeof score !== 'number' || Number.isNaN(score)) return null;
  return formatRiskScore(score);
}

export function formatShareMetaTitle(input: {
  readonly variantName: string;
  readonly familyName: string;
  readonly jobTitle?: string | null;
  readonly score?: number | null;
}): string {
  const scoreLabel = formatShareScore(input.score);
  if (input.jobTitle && scoreLabel) {
    return `${input.jobTitle}のAI影響度は${scoreLabel}｜${LABELS.featureName}`;
  }
  return `${input.variantName}｜${input.familyName} - ${LABELS.featureName}`;
}

export function formatShareMetaDescription(input: {
  readonly catchLine: string;
  readonly gapLine?: string;
  readonly jobTitle?: string | null;
  readonly score?: number | null;
}): string {
  const scoreLabel = formatShareScore(input.score);
  if (input.jobTitle && scoreLabel) {
    const gap = input.gapLine ? ` ${input.gapLine}` : '';
    return `${input.jobTitle}のAI影響度は${scoreLabel}。${SHARE.challengeHookWithJob}${gap}`;
  }
  return `${input.catchLine}${input.gapLine ? ` ${input.gapLine}` : ''}`;
}
