/**
 * src/views/occupation-display.ts — format raw stat fields into
 * the table cells / inline strings shown on the detail page.
 *
 * Extracted from src/pages/[id].astro's "Display formatters"
 * block (salaryInt / ageDisp / hoursDisp / recruitDisp / hourlyDisp /
 * riskNumDisp / workersCell / ageCell / hoursCell / salaryCell).
 *
 * Each field's fallback is 「—」 (em-dash) when the upstream stat
 * is null/undefined. Salary renders as 「xxx 万円」 to match every
 * other salary surface (map tooltip, OG card, hubs, compare, /me).
 */

import { fmtInt } from '../lib/num.js';
import { riskClass as riskBandClass } from '../lib/risk.js';
import { displayScore } from '../data/lib/banker-round.js';

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
  /** Band class for the card wrapper: risk-low / risk-mid / risk-high / risk-na. */
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


export function buildOccupationDisplay(input: OccupationDisplayInput): OccupationDisplay {
  const { aiRisk, salaryMan, workers, age, hours, recruitRatio, hourlyWage } = input;

  const shown = aiRisk !== null ? displayScore(aiRisk) : null;
  const riskStr = shown !== null ? `${shown}/10` : EMDASH;
  const riskClass = aiRisk !== null ? `risk-${riskBandClass(aiRisk)}` : 'risk-na';
  const riskNumDisp: number | string = shown !== null ? shown : EMDASH;

  const salaryInt: number | string = salaryMan ? Math.trunc(salaryMan) : EMDASH;
  const ageDisp: number | string = age ?? EMDASH;
  const hoursDisp: number | string = hours ? Math.trunc(hours) : EMDASH;
  const recruitDisp: number | string =
    recruitRatio !== null && recruitRatio !== undefined ? recruitRatio : EMDASH;
  const hourlyDisp = hourlyWage ? `¥${fmtInt(hourlyWage)}` : EMDASH;

  const workersCell = workers ? `${fmtInt(workers)} 人` : EMDASH;
  const ageCell = age ? `${ageDisp} 歳` : EMDASH;
  const hoursCell = hours ? `${hoursDisp} 時間/月` : EMDASH;
  // 2026-05-17 H2 fix: when salaryMan is null, render a single
  // em dash rather than the doubled "—（— 万円）" which read as
  // a layout glitch on the 4 new IPD occupations 581-584.
  const salaryCell = salaryMan ? `${salaryInt} 万円` : EMDASH;

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
