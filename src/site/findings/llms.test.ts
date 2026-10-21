import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { siteConfig } from '../config';
import { FINDINGS_ATOM_PATH } from './atom';
import { withFindingsLlms, withFindingsLlmsFull } from './llms';

const urls = [
  `${siteConfig.origin}/pro/findings`,
  `${siteConfig.origin}/pro/findings/2026-10-01-gpt-6.1-sol`,
  `${siteConfig.origin}/pro/findings/2026-10-01-gpt-6.1-sol/rights`,
  `${siteConfig.origin}${FINDINGS_ATOM_PATH}`,
];

describe('findings llms appendix', () => {
  test('appends the three HTML URLs and the feed once, ahead of Methodology', () => {
    const stub = '# title\n\n## Pages\n- [Main map](https://mirai-shigoto.com/)\n\n## Methodology\nbody\n';
    const once = withFindingsLlms(stub);
    expect(once).toBe(withFindingsLlms(once));
    for (const url of urls) expect(once).toContain(url);
    expect(once.indexOf(FINDINGS_ATOM_PATH)).toBeLessThan(once.indexOf('## Methodology'));
    expect(once.startsWith('# title\n')).toBe(true);
    const full = withFindingsLlmsFull('facts\n');
    expect(full).toBe(withFindingsLlmsFull(full));
    expect(full.startsWith('facts\n')).toBe(true);
    for (const url of urls) expect(full).toContain(url);
  });

  test('published llms files include findings and the home JSON-LD does not', () => {
    const llms = readFileSync('public/llms.txt', 'utf8');
    const full = readFileSync('public/llms-full.txt', 'utf8');
    const home = readFileSync('src/pages/_index-json-ld.json', 'utf8');
    for (const url of urls) {
      expect(llms).toContain(url);
      expect(full).toContain(url);
    }
    expect(llms).toBe(withFindingsLlms(llms));
    expect(full).toBe(withFindingsLlmsFull(full));
    expect(home).not.toContain('/pro/findings');
  });
});
