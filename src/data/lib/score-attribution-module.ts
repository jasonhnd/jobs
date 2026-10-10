/**
 * Edits that bring the committed `src/site/_score-attribution.ts` up to date.
 *
 * String values come from score-batch files (`scorer.model`, `run.run_date`)
 * and are written as JSON string literals, so a quote, backslash or `$` in a
 * value stays data instead of becoming code (#863). The patterns accept both
 * the JSON (double-quoted) form and the older single-quoted form.
 */
import type { GeneratedModuleEdit } from './rewrite-generated-module.js';

export interface ScoreAttributionModuleValues {
  readonly modelId: string;
  readonly modelDisplay: string;
  readonly runDate: string;
  readonly vendorCount: number;
  readonly latestRunDate: string;
  readonly staleMonths: number;
  readonly staleVendorCount: number;
}

// A single- or double-quoted string literal (double-quoted may hold escapes).
const STRING_LITERAL = String.raw`(?:'[^'\n]*'|"(?:[^"\\\n]|\\.)*")`;

function stringEdit(key: string, value: string): GeneratedModuleEdit {
  const text = `${key}: ${JSON.stringify(value)}`;
  return { pattern: new RegExp(`${key}: ${STRING_LITERAL}`), replacement: text, expect: text };
}

function integerEdit(key: string, value: number): GeneratedModuleEdit {
  if (!Number.isSafeInteger(value)) throw new Error(`[score-attribution-module] ${key} must be an integer, got ${value}`);
  const text = `${key}: ${value}`;
  return { pattern: new RegExp(`${key}: \\d+`), replacement: text, expect: text };
}

export function scoreAttributionEdits(values: ScoreAttributionModuleValues): GeneratedModuleEdit[] {
  return [
    stringEdit('modelId', values.modelId),
    stringEdit('modelDisplay', values.modelDisplay),
    stringEdit('runDate', values.runDate),
    integerEdit('vendorCount', values.vendorCount),
    stringEdit('latestRunDate', values.latestRunDate),
    integerEdit('staleMonths', values.staleMonths),
    integerEdit('staleVendorCount', values.staleVendorCount),
  ];
}
