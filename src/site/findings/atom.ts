import templates from '../../content/findings.ja.json' with { type: 'json' };
import { siteConfig } from '../config';
import { findingsCopy } from './copy';
import { loadFindings } from './data';
import { atomInstant, PUBLICATION_INSTANT } from './publish';
import { discoverableFindings, FINDINGS, findingsUrl, type FindingsManifest } from './registry';

export const FINDINGS_ATOM_PATH = '/pro/findings/atom.xml';

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function latestInstant(issues: readonly FindingsManifest[]): string {
  return issues.map(issue => atomInstant(issue.modified_on)).reduce((best, next) => (
    Date.parse(next) > Date.parse(best) ? next : best
  ));
}

function entryXml(issue: FindingsManifest): string {
  const copy = findingsCopy(loadFindings(issue));
  const url = findingsUrl(issue);
  const published = issue.first_published_on;
  if (published !== null && !PUBLICATION_INSTANT.test(published)) {
    throw new Error('findings: first_published_on must be an RFC 3339 instant with a timezone');
  }
  const content = [copy.T06, copy.T08, copy.T11].join('\n');
  const lines = [
    `<id>${escapeXml(url)}</id>`,
    `<title>${escapeXml(copy.T43)}</title>`,
    `<updated>${escapeXml(atomInstant(issue.modified_on))}</updated>`,
    ...(published === null ? [] : [`<published>${escapeXml(published)}</published>`]),
    `<link rel="alternate" type="text/html" href="${escapeXml(url)}" />`,
    `<summary type="text">${escapeXml(copy.T42)}</summary>`,
    `<content type="text">${escapeXml(content)}</content>`,
  ];
  return `<entry>\n    ${lines.join('\n    ')}\n  </entry>`;
}

/**
 * Signed issues are entries even before the production publication instant
 * exists. RFC 4287 makes `atom:published` optional, so a null
 * `first_published_on` omits that element and still emits `updated`.
 * An empty feed is valid when nothing is signed yet; `updated` then follows
 * the newest manifest revision, not the scoring date.
 */
export function renderFindingsAtom(issues: readonly FindingsManifest[] = discoverableFindings()): string {
  const clock = latestInstant(issues.length > 0 ? issues : FINDINGS);
  const author = templates.T25.slice(0, templates.T25.indexOf('「'));
  const origin = siteConfig.origin;
  const feedId = `${origin}/pro/findings`;
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeXml(feedId)}</id>
  <title>${escapeXml(templates.T44)}</title>
  <updated>${escapeXml(clock)}</updated>
  <author><name>${escapeXml(author)}</name></author>
  <link rel="self" type="application/atom+xml" href="${escapeXml(origin + FINDINGS_ATOM_PATH)}" />
  <link rel="alternate" type="text/html" href="${escapeXml(feedId)}" />
  ${issues.map(entryXml).join('\n  ')}
</feed>
`;
}
