import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { RANKING_META, DEINDEXED_RANKINGS } from '../src/views/rankings-meta';
import { expectedRedirects, loadScoreRuns } from './check-model-redirects';
import { buildManifest, checkManifest, classifyTemplate, ordinaryOccupationPath } from './pro-split-manifest';

describe('stage-zero Pro route contract', () => {
  test('partitions the actual registry into 8 retained and 31 migrated rankings', () => {
    const m = buildManifest();
    expect(JSON.stringify(m.rankings.map(r => r.slug).sort())).toBe(JSON.stringify(RANKING_META.map(r => r.slug).sort()));
    expect(m.rankings.filter(r => r.oldStatus === 200).length).toBe(8);
    expect(m.rankings.filter(r => r.oldStatus === 301).length).toBe(31);
    expect(m.rankings.find(r => r.slug === 'ai-risk-high')?.oldStatus).toBe(200);
    for (const r of m.rankings) expect(r.proPath).toBe(`/pro/rankings/${r.slug}`);
  });
  test('inherits exactly four noindex rankings and excludes them from the planned sitemap', () => {
    const rows = buildManifest().rankings.filter(r => r.noindex);
    expect(JSON.stringify(rows.map(r => r.slug).sort())).toBe(JSON.stringify([...DEINDEXED_RANKINGS].sort()));
    expect(rows.length).toBe(4);
    expect(rows.every(r => r.proCanonical === r.proPath && !r.proSitemap)).toBe(true);
  });
  test('duplicate retained rankings consolidate to ordinary canonical', () => {
    for (const r of buildManifest().rankings.filter(r => r.oldStatus === 200)) {
      expect(r.proCanonical).toBe(r.oldPath);
      expect(r.proSitemap).toBe(false);
    }
  });
  test('ordinary ID 404 avoids the error document; Pro retains its numeric ID', () => {
    expect(ordinaryOccupationPath(404)).toBe('/occupations/404');
    expect(ordinaryOccupationPath(33)).toBe('/33');
    expect(JSON.stringify(buildManifest().occupation.exception)).toBe(JSON.stringify({ id: 404, ordinaryPath: '/occupations/404', proPath: '/pro/404' }));
    expect(classifyTemplate('/404').oldStatus).toBe(404);
  });
  test('maps every current Astro route template once and preserves shared pages', () => {
    const rows = buildManifest().pageTemplates;
    expect(new Set(rows.map(r => r.oldTemplate)).size).toBe(rows.length);
    for (const path of ['/about', '/privacy', '/compliance', '/', '/map', '/me', '/shindan', '/sectors', '/sectors/[sector]']) {
      expect(rows.find(r => r.oldTemplate === path)?.oldStatus).toBe(200);
    }
    for (const path of ['/compare/[pair]', '/skills/[skill]', '/q/[q]', '/models/[model]', '/yearly/2026-report', '/gyakuten']) {
      expect(rows.find(r => r.oldTemplate === path)?.proTemplate).toBe(`/pro${path}`);
      expect(rows.find(r => r.oldTemplate === path)?.oldStatus).toBe(301);
    }
  });
  test('refuses unclassified new families instead of guessing a migration', () => {
    expect(() => classifyTemplate('/unexpected/[id]')).toThrow('Unclassified');
  });
  test('flattens existing and Pro bare aliases to the newest dated model run', () => {
    const rows = buildManifest().modelAliases;
    const latest = expectedRedirects(loadScoreRuns());
    expect(rows.length).toBe(latest.size * 2);
    for (const [old, run] of latest) {
      expect(rows.find(r => r.source === old)?.destination).toBe(`/pro${run}`);
      expect(rows.find(r => r.source === `/pro${old}`)?.destination).toBe(`/pro${run}`);
    }
    expect(rows.every(r => r.destination.includes('@') && r.plannedStatus === 301)).toBe(true);
  });
  test('updates explicit legacy methodology aliases without moving shared about', () => {
    const rows = buildManifest().legacyAliases;
    expect(rows.find(r => r.source === '/ja/about/methodology')?.destination).toBe('/pro/methodology');
    expect(rows.find(r => r.source === '/ja/about/glossary')).toBe(undefined);
  });
  test('checked-in JSON is deterministic and rejects missing, extra or stale content', () => {
    const m = buildManifest();
    expect(JSON.stringify(buildManifest())).toBe(JSON.stringify(m));
    const json = readFileSync('docs/pro-split/route-manifest.json', 'utf8');
    expect(checkManifest(json)).toBe(true);
    expect(checkManifest(JSON.stringify({ ...m, rankings: m.rankings.slice(1) }))).toBe(false);
    expect(checkManifest(JSON.stringify({ ...m, unknown: true }))).toBe(false);
    expect(checkManifest('{')).toBe(false);
  });
});
