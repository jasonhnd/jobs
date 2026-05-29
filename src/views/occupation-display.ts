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
import { riskClass as riskBandClass } from '../lib/risk.js';

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
  /** Inline hex for the .risk-num digit (continuous gradient); '' when no score. */
  readonly riskColor: string;
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

// Continuous risk-score → digit color. Anchors reproduce the legacy 5-step
// palette (green-deep → light-green → amber → orange → red); one-decimal
// scores interpolate smoothly between them. Replaces the old discrete
// `.risk-0`..`.risk-10` CSS rules. Returns '' for a null score.
const RISK_COLOR_STOPS: ReadonlyArray<readonly [number, readonly [number, number, number]]> = [
  [1, [72, 112, 95]], // --green-deep #48705F
  [3.5, [168, 213, 114]], // #a8d572
  [5.5, [200, 150, 56]], // #c89638
  [7.5, [217, 107, 61]], // --orange #D96B3D
  [9.5, [201, 90, 58]], // --red #c95a3a
];

function rgbHex([r, g, b]: readonly [number, number, number]): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function riskNumColor(score: number): string {
  const s = Math.max(0, Math.min(10, score));
  const first = RISK_COLOR_STOPS[0]!;
  const last = RISK_COLOR_STOPS[RISK_COLOR_STOPS.length - 1]!;
  if (s <= first[0]) return rgbHex(first[1]);
  if (s >= last[0]) return rgbHex(last[1]);
  for (let i = 1; i < RISK_COLOR_STOPS.length; i += 1) {
    const [x1, c1] = RISK_COLOR_STOPS[i - 1]!;
    const [x2, c2] = RISK_COLOR_STOPS[i]!;
    if (s <= x2) {
      const t = (s - x1) / (x2 - x1);
      return rgbHex([
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t),
      ]);
    }
  }
  return rgbHex(last[1]);
}

export function buildOccupationDisplay(input: OccupationDisplayInput): OccupationDisplay {
  const { aiRisk, salaryMan, workers, age, hours, recruitRatio, hourlyWage } = input;

  const riskStr = aiRisk !== null ? `${aiRisk}/10` : EMDASH;
  const riskClass = aiRisk !== null ? `risk-${riskBandClass(aiRisk)}` : 'risk-na';
  const riskColor = aiRisk !== null ? riskNumColor(aiRisk) : '';
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
  // 2026-05-17 H2 fix: when salaryMan is null, render a single
  // em dash rather than the doubled "—（— 万円）" which read as
  // a layout glitch on the 4 new IPD occupations 581-584.
  const salaryCell = salaryMan
    ? `¥${fmtInt(Math.trunc(salaryMan * SALARY_MAN_TO_YEN))}（${salaryInt} 万円）`
    : EMDASH;

  return {
    riskStr,
    riskClass,
    riskColor,
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
