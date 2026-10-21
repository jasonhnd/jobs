#!/usr/bin/env bun
/**
 * Record the production publication instant for one signed Findings issue.
 *
 * Preview builds leave `first_published_on` null. Run this on the day a
 * preview-to-main promotion is prepared, with the real release instant:
 *
 *   bun scripts/publish-findings-issue.ts 2026-10-01-gpt-6.1-sol 2026-10-22T09:30:00+09:00
 *
 * The instant must include a timezone. A scoring date is not accepted.
 */
import { writePublishedManifest } from '../src/site/findings/publish';
import { isPublicationInstant } from '../src/site/findings/publication-instant';

const [issueId, instant] = process.argv.slice(2);
if (!issueId || !instant || !/^[a-z0-9][a-z0-9.-]*$/i.test(issueId) || !isPublicationInstant(instant)) {
  console.error('Usage: bun scripts/publish-findings-issue.ts <issue_id> <rfc3339-with-timezone>');
  process.exit(2);
}
const next = writePublishedManifest(`data/findings/${issueId}/manifest.json`, instant);
console.log(`Recorded first_published_on=${next.first_published_on} status=${next.status} for ${issueId}`);
