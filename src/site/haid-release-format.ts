/**
 * Number formatting for the HAID current-state page (docs/HAID.md 測定と報告の方法):
 * headline figures carry 1 significant figure, tables 2. People are shown in
 * 億 / 万 with the unit separated so the page can style it (§4.7 統計の単位).
 */

export interface PeopleJa {
  /** Digits only, with a thousands separator, e.g. "20", "8,300", "0.5". */
  readonly value: string;
  /** 億 / 万 / 人 */
  readonly unit: string;
}

const OKU = 100_000_000;
const MAN = 10_000;

export function roundSignificant(n: number, sig: number): number {
  if (n === 0) return 0;
  const digits = Math.floor(Math.log10(Math.abs(n))) + 1;
  const e = sig - digits;
  // Multiply or divide by an integer power of ten so large values stay exact
  // (8.3e9 * 1e-9 is not representable; 8.3e9 / 1e9 is).
  if (e >= 0) {
    const f = 10 ** e;
    return Math.round(n * f) / f;
  }
  const f = 10 ** -e;
  return Math.round(n / f) * f;
}

function trimNumber(x: number): string {
  // Keep at most 2 decimals, drop trailing zeros, add thousands separators.
  const fixed = x.toFixed(2).replace(/\.?0+$/, '');
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}

/** 8_300_000_000 → { value: "83", unit: "億" }; 34_000_000 → { "3,400", "万" }. */
export function formatPeopleJa(n: number, sig: 1 | 2): PeopleJa {
  const r = roundSignificant(n, sig);
  if (r >= OKU) return { value: trimNumber(r / OKU), unit: '億' };
  if (r >= MAN) return { value: trimNumber(r / MAN), unit: '万' };
  return { value: trimNumber(r), unit: '人' };
}

export function formatPeopleJaText(n: number, sig: 1 | 2): string {
  const p = formatPeopleJa(n, sig);
  return p.unit === '人' ? `${p.value} 人` : `${p.value} ${p.unit}`;
}

/** 0.265 → "27%"; below 1% keeps one decimal ("0.4%"). */
export function formatShareJa(share: number): string {
  const pct = share * 100;
  if (pct >= 1) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1)}%`;
}

/** "2026-06-02" → "2026-06-02" (dates stay ISO on this page; the meta line is machine-readable). */
export function isoDateOrDash(d: string | null): string {
  return d ?? '—';
}
