/**
 * iso-date.ts — strict YYYY-MM-DD check for score-batch run dates.
 *
 * Batch freshness is decided by comparing run_date strings, which is only
 * correct for zero-padded ISO dates: "2026-10-7" > "2026-10-10" as text, and
 * "not-a-date" sorts after every real date. So every date that can become a
 * run_date must be a real calendar day in this exact form.
 */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isRealIsoDate(value: string): boolean {
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}
