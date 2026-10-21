import { siteConfig } from '../config';
import { findingsCopy } from './copy';
import { loadFindings } from './data';
import { FINDINGS_ATOM_PATH } from './atom';
import { discoverableFindings, downloadPath, findingsUrl, rightsPath } from './registry';

const atomUrl = `${siteConfig.origin}${FINDINGS_ATOM_PATH}`;

function signedPages(): string {
  const issues = discoverableFindings();
  if (issues.length === 0) return '';
  const series = findingsCopy(loadFindings(issues[0]!));
  const lines = [`- [${series.T44}](${siteConfig.origin}/pro/findings)`];
  for (const issue of issues) {
    const copy = findingsCopy(loadFindings(issue));
    lines.push(
      `- [${copy.T43}](${findingsUrl(issue)})`,
      copy.T42,
      `- [${copy.rightsSections[0]!.heading}](${siteConfig.origin}${rightsPath(issue)})`,
    );
  }
  lines.push(`- [${series.labels.links[6]}](${atomUrl})`);
  return lines.join('\n');
}

/** Append signed findings links inside Pages. The shared facts renderer stays unchanged. */
export function withFindingsLlms(text: string): string {
  const block = signedPages();
  if (!block || text.includes(atomUrl)) return text;
  const marker = '\n## Methodology\n';
  if (!text.includes(marker)) throw new Error('findings: llms.txt has no Methodology section');
  return text.replace(marker, `\n${block}\n${marker}`);
}

/** Append one section per signed issue. Historical issue text is not rewritten from today's facts. */
export function withFindingsLlmsFull(text: string): string {
  const issues = discoverableFindings();
  if (issues.length === 0 || text.includes(atomUrl)) return text;
  const series = findingsCopy(loadFindings(issues[0]!));
  const blocks = issues.map(issue => {
    const copy = findingsCopy(loadFindings(issue));
    const origin = siteConfig.origin;
    return [
      `- [${copy.T43}](${findingsUrl(issue)})`,
      copy.T06,
      copy.T08,
      copy.T11,
      `- [scores.csv](${origin}${downloadPath(issue, 'scores')})`,
      `- [panel.csv](${origin}${downloadPath(issue, 'panel')})`,
      `- [${copy.T32}](${findingsUrl(issue)}#sources)`,
      `- [${copy.rightsSections[0]!.heading}](${origin}${rightsPath(issue)})`,
    ].join('\n');
  }).join('\n');
  return `${text.trimEnd()}\n\n## ${series.T44}\n\n- [${series.T44}](${siteConfig.origin}/pro/findings)\n${blocks}\n- [${series.labels.links[6]}](${atomUrl})\n`;
}
