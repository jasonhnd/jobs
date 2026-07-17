import type { GeoFacts } from './geo-facts.js';

export interface MethodologyBatchView {
  readonly currentModelDisplay: string;
  readonly currentRunDate: string;
  readonly occupationCount: number;
  readonly meanAiImpact: string;
  readonly meanDisplacementRisk: string;
  readonly comparisonJa: string;
}

function signedFixed(value: number, digits: number): string {
  const magnitude = Math.abs(value).toFixed(digits);
  if (value > 0) return `+${magnitude}`;
  if (value < 0) return `−${magnitude}`;
  return Number.parseFloat(magnitude) === 0 ? magnitude : `−${magnitude}`;
}

export function buildMethodologyBatchView(facts: GeoFacts): MethodologyBatchView {
  let comparisonJa = '比較可能な前回 batch はありません。';
  if (facts.predecessor && facts.meanAiImpactDeltaFromPredecessor !== null) {
    comparisonJa =
      `現行 batch（${facts.attribution.modelDisplay}、${facts.attribution.runDate}）は、` +
      `前回 batch（${facts.predecessor.modelDisplay}、${facts.predecessor.runDate}）と共通する ` +
      `${facts.predecessorComparedCount} 職業で、変化の大きさの平均差が ` +
      `${signedFixed(facts.meanAiImpactDeltaFromPredecessor, 2)} です。`;
  }
  return {
    currentModelDisplay: facts.attribution.modelDisplay,
    currentRunDate: facts.attribution.runDate,
    occupationCount: facts.occupationCount,
    meanAiImpact: facts.meanAiImpactRaw.toFixed(2),
    meanDisplacementRisk: facts.meanDisplacementRiskRaw.toFixed(2),
    comparisonJa,
  };
}
