/**
 * src/lib/risk-callout.ts — pick the one-line Japanese callout
 * text that appears under the risk badge on the occupation
 * detail page.
 *
 * Extracted from src/pages/[id].astro (`oneLineText`).
 * Five-band lookup based on the integer AI-risk score:
 *
 *   null   → AI 影響度未評価。
 *   0..3   → 低 AI 影響。専門性と判断が必要な業務が中心で、当面は安定。
 *   4..6   → AI 影響度は中程度。業務の一部が AI 補助に移行する見込み。
 *   7..8   → AI 影響度が高い。業務再設計や転職方向の検討が早めに必要。
 *   9..10  → 定型業務が中心。AI による自動化候補が多く、今すぐ転職方向を考えるレベル。
 *
 * The phrasing is part of the SEO copy contract (rendered in
 * <body> and reachable via screenshots of representative pages).
 * Pinned by tests + the SEO baseline diff at build time.
 */

const NOT_EVALUATED = 'AI 影響度未評価。';
const VERY_HIGH = '定型業務が中心。AI による自動化候補が多く、今すぐ転職方向を考えるレベル。';
const HIGH = 'AI 影響度が高い。業務再設計や転職方向の検討が早めに必要。';
const MID = 'AI 影響度は中程度。業務の一部が AI 補助に移行する見込み。';
const LOW = '低 AI 影響。専門性と判断が必要な業務が中心で、当面は安定。';

const VERY_HIGH_FLOOR = 9;
const HIGH_FLOOR = 7;
const MID_FLOOR = 4;

export function pickRiskOneLineCallout(aiRisk: number | null): string {
  if (aiRisk === null) return NOT_EVALUATED;
  if (aiRisk >= VERY_HIGH_FLOOR) return VERY_HIGH;
  if (aiRisk >= HIGH_FLOOR) return HIGH;
  if (aiRisk >= MID_FLOOR) return MID;
  return LOW;
}
