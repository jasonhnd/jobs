const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

/**
 * RFC 3339 calendar/time fields with the uppercase T/Z required by Atom.
 * Seconds allow 60; this checks field ranges, not announced leap seconds.
 * Date.parse is unsuitable: it normalizes impossible days and rejects :60.
 */
export function isPublicationInstant(value: string): boolean {
  const match = INSTANT.exec(value);
  if (!match || match[0] !== value) return false;
  const [, year, month, day, hour, minute, second, zone, offsetHour, offsetMinute] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const leapYear = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth[m - 1]!
    && Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 60
    && (zone === 'Z' || (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59));
}
