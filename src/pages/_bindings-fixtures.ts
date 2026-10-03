import type { DetailFileMin } from '@/views/genre-hub.js';

/** Synthetic detail rows shared by the page-bindings tests (no disk, no network). */
export function syntheticDetails(): DetailFileMin[] {
  const row = (id: number, risk: number | null, salary: number, sector: string, certs: string[]): DetailFileMin => ({
    id,
    title: { ja: `職業${id}` },
    ai_risk: risk === null ? null : { score: risk },
    risk_band: risk === null ? null : 'mid',
    stats: { salary_man_yen: salary, workers: 1000 * id, monthly_hours: 160, average_age: 40 },
    sector: { id: `s-${sector}`, ja: sector },
    abilities_top5: [{ key: 'ab-1', label_ja: '能力', score: 4 + id / 10 }],
    related_certs_ja: certs,
  });
  return [
    row(1, 3.2, 500, '医療', ['宅地建物取引士']),
    row(2, 6.1, 600, '医療', ['日商簿記', '宅地建物取引士']),
    row(3, 4.0, 700, '建設', []),
    row(4, null, 400, '', ['FP 技能士']),
  ];
}
