import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import manifest from '../docs/pro-split/route-manifest.json';
import { editionHref, rankingRoute } from '../src/site/route-policy';
import { landingFamily, classifyGeoReferral } from '../src/lib/middleware/geo-referral';
import { configuredMigrationRedirects, migrationRedirects } from './pro-migration';
import { finiteRedirectSources, redirectResolver, type Redirect } from './lib/redirect-resolution';

describe('finite redirect resolution', () => {
  test('generator reproduces the consolidated configuration and every exact 301', () => {
    const configured = configuredMigrationRedirects();
    const redirects = JSON.parse(readFileSync('vercel.json', 'utf8')).redirects as Redirect[];
    expect(JSON.stringify(configured)).toBe(JSON.stringify(redirects.filter(r => !r.source.startsWith('/occ/') && !['/me/start', '/data.json'].includes(r.source))));
    const resolve = redirectResolver(configured);
    const expected = migrationRedirects();
    for (const rule of expected) {
      expect(resolve(rule.source)?.destination).toBe(rule.destination);
      expect(resolve(rule.source)?.statusCode).toBe(301);
    }
    expect(JSON.stringify(configured.flatMap(rule => finiteRedirectSources(rule.source, expected.length)).sort())).toBe(JSON.stringify(expected.map(rule => rule.source).sort()));
    expect(configured.filter(r => r.source === '/ja' || r.source.startsWith('/ja/')).length).toBe(45);
  });
  test('matches case and trailing slashes strictly and keeps unknown paths uncaptured', () => {
    const resolve = redirectResolver(configuredMigrationRedirects());
    for (const path of ['/JA/1', '/ja/About', '/ja/1/', '/ja/999999', '/ja/34', '/ja/skills/unknown', '/ja/pro/1', '/ja/404.html/extra', '/ja/models/gpt-6x1-sol@2026-10-01', '/pro/1', '/1', '/occupations/404']) {
      expect(resolve(path)).toBe(undefined);
    }
    expect(resolve('/ja/models/gpt-6.1-sol@2026-10-01')?.destination).toBe('/pro/models/gpt-6.1-sol@2026-10-01');
  });
  test('uses the first matching rule, substitutes multiple parameters and respects permanent status', () => {
    const rules = [
      { source: '/ja/:family(skills|q)/:slug(one|two)', destination: '/pro/:family/:slug', statusCode: 301 },
      { source: '/ja/skills/one', destination: '/wrong', permanent: true },
    ];
    expect(redirectResolver(rules)('/ja/skills/one')?.destination).toBe('/pro/skills/one');
    expect(redirectResolver([...rules].reverse())('/ja/skills/one')?.statusCode).toBe(308);
    expect(JSON.stringify(finiteRedirectSources(rules[0]!.source, 4))).toBe(JSON.stringify(['/ja/skills/one', '/ja/skills/two', '/ja/q/one', '/ja/q/two']));
  });
  test('rejects wildcards, unconstrained parameters and non-literal regexes', () => {
    for (const source of ['/ja/:path*', '/ja/:id', '/ja/:id(\\d+)', '/ja/:id(one|two)?', '/ja/:id(one|two)+', '/ja/:id(gpt.6)', '/ja/(one|two)']) {
      expect(() => finiteRedirectSources(source, 2001)).toThrow('Non-finite');
    }
  });
});

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
  const jaPattern = config.redirects.findIndex((r: Redirect) => r.source.startsWith('/ja/:path('));
  const replaceJa = (source: string) => ({ ...config, redirects: config.redirects.map((rule: Redirect, i: number) => i === jaPattern ? { ...rule, source } : rule) });
  const pattern = config.redirects[jaPattern].source;
  expect(() => verifyMigration(replaceJa(pattern.replace(')', '|999999)')))).toThrow('outside authorized');
  expect(() => verifyMigration(replaceJa('/ja/:path'))).toThrow();
  expect(() => verifyMigration(replaceJa('/ja/:path(.*)'))).toThrow();
  expect(() => verifyMigration({...config, redirects: [{source:'/ja/1',destination:'/wrong',statusCode:301}, ...config.redirects]})).toThrow('Missing/stale exact 301: /ja/1');
  expect(() => verifyMigration({...config, redirects: [...config.redirects, {source:'/ja/1',destination:'/1',statusCode:301}]})).toThrow('Duplicate redirect coverage');
  expect(() => verifyMigration({...config, redirects: [...config.redirects, {source:'/ja/999999',destination:'/pro',statusCode:301}]})).toThrow('outside authorized');
  expect(() => verifyMigration({...config, redirects: [...config.redirects, {source:'/pro/skills',destination:'/skills',statusCode:301}]})).toThrow('Two-hop/loop');
  expect(() => verifyMigration({...config, headers: Array(2049).fill({})})).toThrow('configured route limit');
});
