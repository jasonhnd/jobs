import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import manifest from '../docs/pro-split/route-manifest.json';
import { editionHref, rankingRoute } from '../src/site/route-policy';
import { landingFamily, classifyGeoReferral } from '../src/lib/middleware/geo-referral';

describe('stage 1B migration contract', () => {
  test('31 migrated rankings use final canonicals; eight duplicate copies consolidate', () => {
    for (const row of manifest.rankings) {
      const policy = rankingRoute(row.slug, 'pro');
      expect(policy.canonicalPath).toBe(row.proCanonical);
      expect(policy.sitemap).toBe(row.proSitemap);
      expect(policy.ordinarySwitchPath).toBe(row.ordinaryPath ?? '/');
      expect(editionHref(row.oldPath, 'ordinary')).toBe(row.ordinaryPath ?? row.proPath);
    }
  });
  test('all migrated family links go to Pro while root boundaries and suffixes survive', () => {
    const families = ['compare', 'skills', 'interests', 'abilities', 'knowledge', 'values', 'education', 'training', 'work-styles', 'employment-types', 'life-balance', 'entry-paths', 'careers', 'licenses', 'explore', 'q', 'answers', 'models', 'methodology', 'data', 'standard', 'haid', 'aiadoption', 'yearly', 'gyakuten'];
    for (const family of families) for (const edition of ['ordinary', 'pro'] as const) {
      expect(editionHref(`/${family}?q=a&q=b#content`, edition)).toBe(`/pro/${family}?q=a&q=b#content`);
    }
    for (const href of ['/about', '/privacy', '/compliance', '/404', '/api/og?ranking=salary', '/data.detail/0404.json', '/data.treemap.json', '/skills-extra', '/pro-extra/skills', 'https://example.com/skills', '//example.com/skills']) {
      expect(editionHref(href, 'pro')).toBe(href);
    }
  });
  test('exact migration redirects and model aliases are explicit 301s', () => {
    const redirects = JSON.parse(readFileSync('vercel.json', 'utf8')).redirects;
    for (const row of manifest.rankings) {
      const rules = redirects.filter((r: {source: string}) => r.source === row.oldPath);
      expect(rules.length).toBe(row.oldStatus === 301 ? 1 : 0);
      if (row.oldStatus === 301) expect(JSON.stringify(rules[0])).toBe(JSON.stringify({source: row.oldPath, destination: row.proPath, statusCode: 301}));
    }
    for (const alias of manifest.modelAliases) {
      expect(JSON.stringify(redirects.find((r: {source: string}) => r.source === alias.source))).toBe(JSON.stringify({source: alias.source, destination: alias.destination, statusCode: 301}));
    }
  });
  test('Pro landing families and edition are distinct from root errors and prefix collisions', () => {
    for (const [path, family] of [['/pro/rankings/entry-salary', 'ranking'], ['/pro/compare/se-vs-programmer', 'compare'], ['/pro/q', 'qa'], ['/pro/answers', 'answers'], ['/pro/methodology', 'methodology'], ['/pro/404', 'occupation'], ['/occupations/404', 'occupation']] as const) {
      expect(landingFamily(path)).toBe(family);
      const result = classifyGeoReferral(new URL(`https://mirai-shigoto.com${path}`), '');
      expect((result as unknown as Record<string,string>).geo_landing_edition).toBe(path.startsWith('/pro/') ? 'pro' : 'ordinary');
    }
    for (const path of ['/404', '/pro/999999', '/pro/not-a-family', '/pro-extra/q', '/pro/pro/q']) expect(landingFamily(path)).toBe('other');
  });
});

if (existsSync('dist-astro/pro.html')) test('built redirect gate rejects added invalid-route rules and missing final targets', async () => {
  const { verifyMigration } = await import('./pro-migration');
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  expect(() => verifyMigration(config)).not.toThrow();
  expect(() => verifyMigration({...config,redirects:[...config.redirects,{source:'/skills/unknown',destination:'/pro/skills/unknown',statusCode:301}]})).toThrow('outside authorized');
  expect(() => verifyMigration({...config,redirects:config.redirects.filter((r:{source:string})=>r.source!=='/skills')})).toThrow('Missing/stale exact 301');
});
