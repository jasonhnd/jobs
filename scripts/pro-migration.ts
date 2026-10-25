#!/usr/bin/env bun
/** Exact stage-1B redirects. The inventory is checked against built pages, never wildcards. */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import manifest from '../docs/pro-split/route-manifest.json';
import oldRoutes from '../docs/pro-split/generated-routes.json';
import { expectedRedirects, loadScoreRuns } from './check-model-redirects';
import { finiteRedirectSources, redirectResolver, type Redirect } from './lib/redirect-resolution';

export type { Redirect } from './lib/redirect-resolution';
const migrated = new Set(manifest.pageTemplates.filter(r => r.oldStatus === 301).map(r => r.oldTemplate.split('/')[1]!));
const rankings = new Map(manifest.rankings.map(r => [r.oldPath, r]));
export function finalPath(old: string): string {
  const ranking = rankings.get(old);
  if (ranking) return ranking.ordinaryPath ?? ranking.proPath;
  return migrated.has(old.split('/')[1]!) ? `/pro${old}` : old;
}
export function migrationRedirects(): Redirect[] {
  const rules = new Map<string, Redirect>();
  const add = (source: string, destination: string) => {
    const prior = rules.get(source);
    if (prior && prior.destination !== destination) throw new Error(`Conflicting redirect: ${source}`);
    rules.set(source, { source, destination, statusCode: 301 });
  };
  for (const old of oldRoutes) if (finalPath(old) !== old) add(old, finalPath(old));
  for (const [source, run] of expectedRedirects(loadScoreRuns())) {
    const destination = `/pro${run}`;
    add(source, destination); add(`/pro${source}`, destination);
    for (const language of ['ja', 'en']) add(`/${language}${source}`, destination);
  }
  for (const alias of manifest.legacyAliases) add(alias.source, alias.destination);
  // Specific legacy aliases win before enumeration (notably occupation ID404).
  add('/ja/404', '/occupations/404'); add('/ja/404.html', '/occupations/404');
  add('/ja/about/glossary', '/about');
  for (const language of ['ja', 'en']) {
    add(`/${language}`, '/');
    for (const old of oldRoutes) {
      if (rules.has(`/${language}${old === '/' ? '' : old}`)) continue;
      add(`/${language}${old === '/' ? '' : old}`, finalPath(old));
    }
  }
  return [...rules.values()].sort((a,b) => a.source.localeCompare(b.source));
}

/** Reproduce the approved /en slice using only its finite exact inventory. */
function configuredEnglishRedirects(exact: Redirect[]): Redirect[] {
  const en = exact.filter(rule => rule.source === '/en' || rule.source.startsWith('/en/'));
  const ordered = (values: string[]) => values.sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  const finite = (rules: Redirect[], prefix: string, name: string, destination: string): Redirect => {
    const values = ordered(rules.map(rule => rule.source.slice(prefix.length)))
      .map(value => value.replaceAll('.', '\\.'));
    return { source: `${prefix}:${name}(${values.join('|')})`, destination, statusCode: 301 };
  };
  const models = en.filter(rule => rule.source.startsWith('/en/models/'));
  const aliases = models.filter(rule => !rule.source.includes('@'));
  const aliasBySource = new Map(aliases.map(rule => [rule.source, rule]));
  const result = ordered(aliases.map(rule => rule.source)).map(source => aliasBySource.get(source)!);
  result.push(finite(models.filter(rule => rule.source.includes('@')), '/en/models/', 'run', '/pro/models/:run'));
  const families = [...new Set(en.filter(rule => rule.source.split('/').length === 4).map(rule => rule.source.split('/')[2]!))]
    .filter(family => !['models', 'rankings', 'occupations', 'sectors'].includes(family)).sort();
  for (const family of [...families, 'sectors']) {
    const prefix = `/en/${family}/`;
    result.push(finite(en.filter(rule => rule.source.startsWith(prefix)), prefix, 'slug',
      family === 'sectors' ? '/sectors/:slug' : `/pro/${family}/:slug`));
  }
  for (const destination of ['/pro/rankings/', '/rankings/']) {
    result.push(finite(en.filter(rule => rule.source.startsWith('/en/rankings/') && rule.destination.startsWith(destination)),
      '/en/rankings/', 'slug', `${destination}:slug`));
  }
  result.push(en.find(rule => rule.source === '/en/occupations/404')!);
  result.push(finite(en.filter(rule => /^\/en\/\d+$/.test(rule.source)), '/en/', 'id', '/:id'));
  const indexes = en.filter(rule => /^\/en\/[^/]+$/.test(rule.source) && !/^\/en\/\d+$/.test(rule.source));
  for (const [prefix, name] of [['/pro/', 'section'], ['/', 'page']] as const) {
    result.push(finite(indexes.filter(rule => rule.destination === `${prefix}${rule.source.slice(4)}`),
      '/en/', name, `${prefix}:${name}`));
  }
  result.push(en.find(rule => rule.source === '/en')!);
  return result;
}

/** Consolidate the remaining approved sources; /entry-paths stays literal. */
function configuredRemainingRedirects(exact: Redirect[]): Redirect[] {
  const remaining = exact.filter(rule => !rule.source.startsWith('/ja')
    && !rule.source.startsWith('/en') && !rule.source.startsWith('/entry-paths'));
  const indexes = remaining.filter(rule => rule.source.split('/').length === 2);
  const emitted = new Set<string>();
  return remaining.flatMap(rule => {
    const [, family, slug] = rule.source.split('/');
    const group = !slug ? 'indexes' : family === 'models' && slug.includes('@') ? 'models'
      : !['models', 'pro'].includes(family!) ? family! : null;
    if (!group) return [rule];
    if (emitted.has(group)) return [];
    emitted.add(group);
    const rules = group === 'indexes' ? indexes : remaining.filter(r => r.source.startsWith(`/${family}/`)
      && (group !== 'models' || r.source.includes('@')));
    const prefix = group === 'indexes' ? '/' : `/${family}/`;
    const name = group === 'indexes' ? 'family' : 'slug';
    const values = rules.map(r => r.source.slice(prefix.length)).sort().map(value => value.replaceAll('.', '\\.'));
    return [{ source: `${prefix}:${name}(${values.join('|')})`,
      destination: group === 'indexes' ? `/pro/:${name}` : `/pro/${family}/:${name}`, statusCode: 301 }];
  });
}

/** Reproduce all three approved slices, preserving the untouched entry paths. */
export function configuredMigrationRedirects(): Redirect[] {
  const exact = migrationRedirects();
  const literals: Redirect[] = [];
  const groups = new Map<string, { source: string; destination: string; rules: Redirect[] }>();
  for (const rule of exact.filter(r => r.source.startsWith('/ja/'))) {
    const segment = rule.source.slice(rule.source.lastIndexOf('/') + 1);
    const source = rule.source.slice(0, -segment.length);
    const destination = rule.destination.slice(0, -segment.length);
    if (!rule.destination.endsWith(`/${segment}`)
      || ![source.slice(3), `/pro${source.slice(3)}`].includes(destination)) {
      literals.push(rule);
      continue;
    }
    const key = `${source} -> ${destination}`;
    if (!groups.has(key)) groups.set(key, { source, destination, rules: [] });
    groups.get(key)!.rules.push(rule);
  }
  const finite = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => {
    if (group.rules.length === 1) return group.rules[0]!;
    const values = group.rules.map(r => r.source.slice(group.source.length)).sort()
      .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return { source: `${group.source}:path(${values.join('|')})`, destination: `${group.destination}:path`, statusCode: 301 };
  });
  const ja = [...literals, ...finite];
  const en = configuredEnglishRedirects(exact);
  const remaining = configuredRemainingRedirects(exact);
  let emittedRemaining = false;
  return exact.flatMap(rule => rule.source === '/ja' ? [rule, ...ja] : rule.source.startsWith('/ja/') ? []
    : rule.source === '/en' ? en : rule.source.startsWith('/en/') ? []
    : rule.source.startsWith('/entry-paths') ? [rule]
    : emittedRemaining ? [] : (emittedRemaining = true, remaining));
}
export function builtLegacyInventory(root = 'dist-astro'): string[] {
  function walk(dir: string): string[] {
    return readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(join(dir,e.name)) : e.name.endsWith('.html') ? [join(dir,e.name)] : []);
  }
  const logical = new Set<string>();
  for (const file of walk(root)) {
    let route = '/' + relative(root,file).replaceAll('\\','/').replace(/\.html$/,'').replace(/\/index$/,'');
    if (route === '/index') route = '/';
    if (route.startsWith('/pro')) {
      const old = route.slice(4);
      if (migrated.has(old.split('/')[1]!) || rankings.has(old)) logical.add(old);
    } else logical.add(route);
  }
  return [...logical].sort();
}
export function verifyMigration(config: {redirects: Redirect[]}): void {
  const expected = migrationRedirects();
  const expectedBySource = new Map(expected.map(rule => [rule.source, rule]));
  const resolve = redirectResolver(config.redirects);
  const inventory = builtLegacyInventory();
  if (JSON.stringify(inventory) !== JSON.stringify(oldRoutes)) throw new Error('Generated old/new route sets differ; review and regenerate inventory');
  for (const rule of expected) {
    const found = resolve(rule.source);
    if (found?.destination !== rule.destination || found.statusCode !== 301) throw new Error(`Missing/stale exact 301: ${rule.source}`);
    const target = rule.destination === '/' ? 'index' : rule.destination.slice(1);
    if (!existsSync(`dist-astro/${target}.html`)) throw new Error(`Missing final target: ${rule.destination}`);
  }
  for (const old of oldRoutes.filter(path => finalPath(path) !== path)) {
    if (existsSync(`dist-astro/${old.slice(1)}.html`)) throw new Error(`Retired root page still emitted: ${old}`);
  }
  for (const rule of expected) if (resolve(rule.destination)) throw new Error(`Two-hop/loop redirect: ${rule.source}`);
  const covered = new Set<string>();
  for (const rule of config.redirects) {
    // These six pre-existing aliases are outside the generated stage-1B inventory.
    if (['/me/start', '/data.json', '/occ/404-:slug*', '/occ/404', '/occ/:id(\\d+)-:slug*', '/occ/:id(\\d+)'].includes(rule.source)) continue;
    if (rule.source.includes(':path*') || /^\/pro\/.*:/.test(rule.source)) throw new Error(`Blanket redirect: ${rule.source}`);
    if (rule.source === '/rankings' || manifest.rankings.some(r => r.ordinaryPath === rule.source) || /^\/(\d+|occupations\/404)$/.test(rule.source)) throw new Error(`Retained route redirected: ${rule.source}`);
    // Check every rule independently too: shadowed extras and duplicate coverage must fail.
    if (Object.keys(rule).some(key => !['source', 'destination', 'statusCode'].includes(key))) throw new Error(`Unexpected redirect fields: ${rule.source}`);
    const resolveRule = redirectResolver([rule]);
    for (const source of finiteRedirectSources(rule.source, expected.length)) {
      const target = expectedBySource.get(source);
      const found = resolveRule(source);
      if (!target || found?.destination !== target.destination || found.statusCode !== 301) throw new Error(`Redirect outside authorized exact inventory: ${source}`);
      if (covered.has(source)) throw new Error(`Duplicate redirect coverage: ${source}`);
      covered.add(source);
    }
  }
  // Vercel's 2,048 configured-route limit includes headers and rewrites.
  const full = config as typeof config & {headers?:unknown[];rewrites?:unknown[]};
  if (config.redirects.length + (full.headers?.length ?? 0) + (full.rewrites?.length ?? 0) > 2048) throw new Error('Vercel configured route limit exceeded');
}
if (import.meta.main) {
  const config = JSON.parse(readFileSync('vercel.json','utf8'));
  if (process.argv.includes('--write')) {
    // Keep unrelated pre-existing data/tool/occupation aliases exactly as they are.
    config.redirects = [...config.redirects.filter((r: Redirect) => ['/me/start','/data.json'].includes(r.source) || r.source.startsWith('/occ/')), ...configuredMigrationRedirects()];
    const original = readFileSync('vercel.json','utf8');
    writeFileSync('vercel.json', original.replace(/  "redirects": \[[\s\S]*\]\n}/, `  "redirects": ${JSON.stringify(config.redirects,null,2).replaceAll('\n','\n  ')}\n}`));
  } else verifyMigration(config);
  console.log(`Pro migration OK: ${oldRoutes.length} legacy HTML routes, ${migrationRedirects().length} exact 301 resolutions`);
}
