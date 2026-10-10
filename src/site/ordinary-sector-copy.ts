/** Owner signed 2026-10-10, decision d1009-232009-1: stage-4 templates. */
import { riskBandWord, riskClass } from '../lib/risk';

export function ordinarySectorCopy(name: string, count: number, mean: number | null) {
  const band = riskBandWord(mean);
  if (!band || mean === null) return null;
  const level = riskClass(mean);
  const word = band.slice('変化 '.length);
  return {
    band,
    conclusion: `${name}の${count}の仕事は、平均するとAIで変わる部分が「${word}」${level === 'mid' ? 'です。' : '業界です。'}`,
    guidance: level === 'mid'
      ? '同じ業界でも、仕事ごとに大きく違います。下の一覧で確かめてください。'
      : level === 'low'
        ? 'ただし、仕事ごとに差があります。下の一覧で確かめてください。'
        : '仕事がなくなる、という意味ではありません。仕事ごとの違いは下の一覧で。',
  };
}
