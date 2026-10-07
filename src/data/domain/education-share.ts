/**
 * 院卒 (graduate-school) share of an occupation's 学歴 distribution.
 *
 * jobtag's 学歴 question is multiple-answer, so the 修士 and 博士 shares
 * overlap: their sum exceeds 100% on many occupations (up to 137%, #863).
 * The share that named at least one graduate degree cannot be recovered from
 * the two marginals — it lies in [max(m, d), min(100, m + d)]. We publish the
 * lower bound max(m, d): it never exceeds 100% and never overstates.
 *
 * Unit-agnostic: percent (views/ranking) or fraction (genre hub) in, same unit out.
 */
export function graduateShare(masters: number, doctorate: number): number {
  return Math.max(masters, doctorate);
}
