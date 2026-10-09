#!/usr/bin/env bun
/** Exact stage-1B redirects. The inventory is checked against built pages, never wildcards. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import manifest from '../docs/pro-split/route-manifest.json';
import oldRoutes from '../docs/pro-split/generated-routes.json';
import { expectedRedirects, loadScoreRuns } from './check-model-redirects';

export interface Redirect { source: string; destination: string; statusCode?: number; permanent?: boolean }
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
  const inventory = builtLegacyInventory();
  if (JSON.stringify(inventory) !== JSON.stringify(oldRoutes)) throw new Error('Generated old/new route sets differ; review and regenerate inventory');
  for (const rule of expected) {
    const found = config.redirects.filter(r => r.source === rule.source);
    if (found.length !== 1 || JSON.stringify(found[0]) !== JSON.stringify(rule)) throw new Error(`Missing/stale exact 301: ${rule.source}`);
  }
  const destinations = new Set(expected.map(r => r.destination));
  for (const rule of expected) if (destinations.has(rule.source)) throw new Error(`Two-hop/loop redirect: ${rule.source}`);
  for (const rule of config.redirects) {
    if (rule.source.includes(':path*') || /^\/pro\/.*:/.test(rule.source)) throw new Error(`Blanket redirect: ${rule.source}`);
    if (rule.source === '/rankings' || manifest.rankings.some(r => r.ordinaryPath === rule.source) || /^\/(\d+|occupations\/404)$/.test(rule.source)) throw new Error(`Retained route redirected: ${rule.source}`);
  }
  // Vercel's 2,048 configured-route limit includes headers and rewrites.
  const full = config as typeof config & {headers?:unknown[];rewrites?:unknown[]};
  if (config.redirects.length + (full.headers?.length ?? 0) + (full.rewrites?.length ?? 0) > 2048) throw new Error('Vercel configured route limit exceeded');
}
if (import.meta.main) {
  const config = JSON.parse(readFileSync('vercel.json','utf8'));
  if (process.argv.includes('--write')) {
    // Keep unrelated pre-existing data/tool/occupation aliases exactly as they are.
    config.redirects = [...config.redirects.filter((r: Redirect) => ['/me/start','/data.json'].includes(r.source) || r.source.startsWith('/occ/')), ...migrationRedirects()];
    const original = readFileSync('vercel.json','utf8');
    writeFileSync('vercel.json', original.replace(/  "redirects": \[[\s\S]*\]\n}/, `  "redirects": ${JSON.stringify(config.redirects,null,2).replaceAll('\n','\n  ')}\n}`));
  } else verifyMigration(config);
  console.log(`Pro migration OK: ${oldRoutes.length} legacy HTML routes, ${migrationRedirects().length} exact 301s`);
}
