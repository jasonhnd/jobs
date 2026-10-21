import { readFileSync, writeFileSync } from 'node:fs';
import type { FindingsManifest } from './registry';

/** RFC 3339 date-time with an explicit zone. A calendar day is not an instant. */
export const PUBLICATION_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Atom `updated` needs an RFC 3339 instant. A manifest calendar day is the
 * start of that day in Asia/Tokyo, the site's zone. It is not a publication
 * time and must not be copied into `first_published_on`.
 */
export function atomInstant(value: string): string {
  if (PUBLICATION_INSTANT.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00+09:00`;
  throw new Error(`findings: ${value} is not a calendar day or an RFC 3339 instant with a timezone`);
}

export function publishedOnLabel(issue: Pick<FindingsManifest, 'first_published_on'>): string {
  return issue.first_published_on ?? '—';
}

export function applyFindingsPublication<T extends FindingsManifest>(issue: T, instant: string): T {
  if (!PUBLICATION_INSTANT.test(instant)) {
    throw new Error('findings: first_published_on must be an RFC 3339 instant with a timezone');
  }
  if (issue.status === 'draft' || !issue.template_signed || !issue.rights_signed) {
    throw new Error('findings: an unsigned draft cannot record a publication instant');
  }
  if (issue.first_published_on !== null && issue.first_published_on !== instant) {
    throw new Error('findings: first_published_on is already recorded');
  }
  return { ...issue, status: 'published', first_published_on: instant };
}

/** Write the publication instant into one issue manifest. Preview builds do not call this. */
export function writePublishedManifest(path: string, instant: string): FindingsManifest {
  const issue = JSON.parse(readFileSync(path, 'utf8')) as FindingsManifest;
  const next = applyFindingsPublication(issue, instant);
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
