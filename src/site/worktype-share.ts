/**
 * Share text and OG metadata for the diagnostic (#237).
 *
 * Identity-only when there is no occupation (no number). Measurement-led
 * when a job title and AI-impact score are present.
 */
import { LABELS, SHARE } from './worktype-copy.js';

export function formatShareScore(score: number | null | undefined): string | null {
  if (score == null || typeof score !== 'number' || Number.isNaN(score)) return null;
  return `${score}/10`;
}

export function hasMeasurementShare(
  jobTitle: string | null | undefined,
  score: number | null | undefined,
): boolean {
  return Boolean(jobTitle && formatShareScore(score));
}

export interface WorktypeShareInput {
  readonly url: string;
  readonly variantName: string;
  readonly catchLine: string;
  readonly jobTitle?: string | null;
  readonly score?: number | null;
  readonly includeUrl?: boolean;
}

function applyTemplate(
  template: string,
  replacements: Readonly<Record<string, string>>,
): string {
  let out = template;
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value);
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function formatShareText(input: WorktypeShareInput): string {
  const includeUrl = input.includeUrl !== false;
  const url = includeUrl ? input.url : '';
  const scoreLabel = formatShareScore(input.score);
  if (input.jobTitle && scoreLabel) {
    return applyTemplate(SHARE.textTemplateWithJob, {
      '{職業}': input.jobTitle,
      '{点数}': scoreLabel,
      '{リンク}': url,
    });
  }
  return applyTemplate(SHARE.textTemplate, {
    '{タイプ名}': input.variantName,
    '{一言}': input.catchLine,
    '{リンク}': url,
  });
}

export function formatShareHook(input: Omit<WorktypeShareInput, 'url' | 'includeUrl'>): string {
  const scoreLabel = formatShareScore(input.score);
  if (input.jobTitle && scoreLabel) {
    return `${input.jobTitle}のAI影響度は${scoreLabel}。${SHARE.challengeHookWithJob}`;
  }
  return `${input.variantName}：${input.catchLine}`;
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
