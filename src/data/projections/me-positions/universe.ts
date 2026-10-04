import {
  buildRankings,
  type Occupation,
  type RankingSlug,
} from '../../../views/ranking/index.js';

/**
 * Ask the canonical ranking builders for their full sorted universes through
 * buildRankings' explicit projection-only limit option. Public ranking pages
 * still use the default TOP_N contract.
 */
export function buildCanonicalFullRankings(allOccs: Occupation[]): Map<RankingSlug, number[]> {
  const { results } = buildRankings(
    () => allOccs,
    { limit: Number.POSITIVE_INFINITY },
  );
  return new Map(
    Array.from(results, ([slug, result]) => [
      slug,
      result.items.map((o) => o.id),
    ]),
  );
}

function findDuplicate(ids: readonly number[]): number | null {
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return null;
}

export function assertRankingUniverseMatches(
  slug: RankingSlug | string,
  canonicalFull: readonly number[],
  localFull: readonly number[],
): void {
  const canonicalDuplicate = findDuplicate(canonicalFull);
  if (canonicalDuplicate !== null) {
    throw new Error(
      `[me-positions] canonical ranking "${slug}" contains duplicate id ${canonicalDuplicate}.`,
    );
  }

  const localDuplicate = findDuplicate(localFull);
  if (localDuplicate !== null) {
    throw new Error(
      `[me-positions] local RANKER "${slug}" contains duplicate id ${localDuplicate}.`,
    );
  }

  if (canonicalFull.length !== localFull.length) {
    throw new Error(
      `[me-positions] RANKER universe size drift on "${slug}": ` +
        `canonical=${canonicalFull.length} local=${localFull.length}. ` +
        'The local RANKERS mirror diverged from buildRankings() — re-sync them.',
    );
  }

  const localIds = new Set(localFull);
  const missingLocal = canonicalFull.find((id) => !localIds.has(id));
  if (missingLocal !== undefined) {
    throw new Error(
      `[me-positions] RANKER universe membership drift on "${slug}": ` +
        `canonical id ${missingLocal} is missing locally. ` +
        'The local RANKERS mirror diverged from buildRankings() — re-sync them.',
    );
  }

  const canonicalIds = new Set(canonicalFull);
  const extraLocal = localFull.find((id) => !canonicalIds.has(id));
  if (extraLocal !== undefined) {
    throw new Error(
      `[me-positions] RANKER universe membership drift on "${slug}": ` +
        `local id ${extraLocal} is not in canonical. ` +
        'The local RANKERS mirror diverged from buildRankings() — re-sync them.',
    );
  }

  for (let i = 0; i < canonicalFull.length; i += 1) {
    if (canonicalFull[i] !== localFull[i]) {
      throw new Error(
        `[me-positions] RANKER universe order drift on "${slug}" at position ${i + 1}: ` +
          `canonical=${canonicalFull[i]} local=${localFull[i]}. ` +
          'The local RANKERS mirror diverged from buildRankings() — re-sync them.',
      );
    }
  }
}

export function assertTopMatchesFullPrefix(
  slug: RankingSlug,
  canonicalTop: readonly number[],
  canonicalFull: readonly number[],
): void {
  for (let i = 0; i < canonicalTop.length; i += 1) {
    if (canonicalTop[i] !== canonicalFull[i]) {
      throw new Error(
        `[me-positions] canonical full ranking "${slug}" does not preserve TOP-N at position ${i + 1}: ` +
          `top=${canonicalTop[i]} full=${canonicalFull[i]}.`,
      );
    }
  }
}

