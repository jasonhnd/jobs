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
  test('every stage-1A ranking copy canonicalizes to its own old ranking URL', () => {
    for (const r of buildManifest().rankings) {
      expect(r.phase1ProCanonical).toBe(r.oldPath);
      expect(r.phase1ProCanonical).toMatch(/^\/rankings\/[^/]+$/);
      expect(r.proCanonicalStage).toBe('1B');
      expect(r.proCanonical).toBe(r.oldStatus === 200 ? r.oldPath : r.proPath);
      expect(r.proCanonical).toMatch(/^\/(pro\/)?rankings\/[^/]+$/);
    }
    const doc = readFileSync('docs/PRO_SPLIT.md', 'utf8');
    const phase1 = doc.split('\n').find(line => line.startsWith('| Stage 1A duplicate')) ?? '';
    expect(phase1).toContain('/rankings/<slug>');
    expect(phase1).toContain('/occupations/404');
    expect(doc).toContain('phase1ProCanonical');
    expect(doc).toContain('proCanonicalStage');
  });
  test('ordinary occupation and shared about aliases retain their existing targets', () => {
    const m = buildManifest();
    const aliases = JSON.parse(readFileSync('vercel.json', 'utf8')).redirects as Array<{ source: string; destination: string }>;
    const retained = aliases.filter(r => r.source.startsWith('/occ/') || ['/ja/404', '/ja/404.html', '/ja/about', '/ja/about/glossary'].includes(r.source));
    expect(retained.length).toBe(8);
    for (const r of retained) {
      expect(m.legacyAliases.find(a => a.source === r.source)).toBe(undefined);
      expect(m.legacyWildcardPolicy).toContain(`${r.source} -> ${r.destination}`);
    }
    expect(m.legacyWildcardPolicy).toContain('Ordinary occupation aliases retain their existing targets');
    expect(m.legacyWildcardPolicy).toContain('Root-retained families stay at root');
    expect(m.legacyWildcardPolicy).toContain('No /pro/:path* blanket redirect');
  });
  test('migration citations point to link producers and cover later hub entries', () => {
    const doc = readFileSync('docs/PRO_SPLIT.md', 'utf8');
    // Documentation citations refer to the frozen stage-zero baseline; shared extraction moves current lines.
    for (const [file, line, text] of [
      ['src/pages/_me-inline.js', 696, 'a.href = rankingPaths[row.meta.slug]'],
      ['src/templates/Ranking.ts', 255, 'rankingRoute('],
      ['src/templates/Ranking.ts', 419, 'rankingRoute('],
      ['src/index-source.html', 381, 'href="/rankings/ai-risk-high"'],
      ['src/index-source.html', 434, 'href="/pro"'],
    ] as const) {
      expect(readFileSync(file, 'utf8')).toContain(text);
      expect(doc).toContain(`${file}:${line}`);
    }
    expect(doc).toContain('src/views/sitemap.ts:151-276');
    expect(doc).toContain('docs/DATA_ARCHITECTURE.md:49-50');
    expect(readFileSync('docs/DATA_ARCHITECTURE.md', 'utf8').split('\n')[49]).toContain('丸め前の値');
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
