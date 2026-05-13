/**
 * src/views/occupation-display.ts — format raw stat fields into
 * the table cells / inline strings shown on the detail page.
 *
 * Extracted from src/pages/ja/[id].astro's "Display formatters"
 * block (salaryInt / ageDisp / hoursDisp / recruitDisp / hourlyDisp /
 * riskNumDisp / workersCell / ageCell / hoursCell / salaryCell).
 *
 * Each field's fallback is 「—」 (em-dash) when the upstream stat
 * is null/undefined. The 万円→円 conversion for the salary cell
 * uses ×10_000 truncation, matching the legacy formula.
 */

import { fmtInt } from '../lib/num.js';

/** Narrow input — only the Rec stat fields the formatters read. */
export interface OccupationDisplayInput {
  readonly aiRisk: number | null;
  /** Annual salary in 万円 (ten-thousand yen). */
  readonly salaryMan: number | null | undefined;
  readonly workers: number | null | undefined;
  readonly age: number | null | undefined;
  readonly hours: number | null | undefined;
  readonly recruitRatio: number | null | undefined;
  readonly hourlyWage: number | null | undefined;
}

/** All the table cells + inline display strings derived from
 *  stats. Each `*Cell` variant is the formatted-with-unit string
 *  that goes into a `<td>`; the plain ones are bare numbers for
 *  use inside JS expressions or inline copy. */
export interface OccupationDisplay {
  readonly riskStr: string;
  readonly riskClass: string;
  readonly riskNumDisp: number | string;
  readonly salaryInt: number | string;
  readonly ageDisp: number | string;
  readonly hoursDisp: number | string;
  readonly recruitDisp: number | string;
  readonly hourlyDisp: string;
  readonly workersCell: string;
  readonly ageCell: string;
  readonly hoursCell: string;
  readonly salaryCell: string;
}

const EMDASH = '—';
const SALARY_MAN_TO_YEN = 10_000;

export function buildOccupationDisplay(input: OccupationDisplayInput): OccupationDisplay {
  const { aiRisk, salaryMan, workers, age, hours, recruitRatio, hourlyWage } = input;

  const riskStr = aiRisk !== null ? `${aiRisk}/10` : EMDASH;
  const riskClass = aiRisk !== null ? `risk-${aiRisk}` : 'risk-na';
  const riskNumDisp: number | string = aiRisk !== null ? aiRisk : EMDASH;

  const salaryInt: number | string = salaryMan ? Math.trunc(salaryMan) : EMDASH;
  const ageDisp: number | string = age ?? EMDASH;
  const hoursDisp: number | string = hours ? Math.trunc(hours) : EMDASH;
  const recruitDisp: number | string =
    recruitRatio !== null && recruitRatio !== undefined ? recruitRatio : EMDASH;
  const hourlyDisp = hourlyWage ? `¥${fmtInt(hourlyWage)}` : EMDASH;

  const workersCell = workers ? `${fmtInt(workers)} 人` : EMDASH;
  const ageCell = age ? `${ageDisp} 歳` : EMDASH;
  const hoursCell = hours ? `${hoursDisp} 時間/月` : EMDASH;
  const salaryCell = salaryMan
    ? `¥${fmtInt(Math.trunc(salaryMan * SALARY_MAN_TO_YEN))}（${salaryInt} 万円）`
    : '—（— 万円）';

  return {
    riskStr,
    riskClass,
    riskNumDisp,
    salaryInt,
    ageDisp,
    hoursDisp,
    recruitDisp,
    hourlyDisp,
    workersCell,
    ageCell,
    hoursCell,
    salaryCell,
  };
}
