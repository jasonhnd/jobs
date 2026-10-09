#!/usr/bin/env bun
/** Manifest generation/checking only; runtime routes consume the generated JSON. */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RANKING_META, DEINDEXED_RANKINGS, type RankingSlug } from '../src/views/rankings-meta';
import { occupationPath } from '../src/lib/urls';
import { expectedRedirects, loadRedirects, loadScoreRuns } from './check-model-redirects';

const ROOT = join(import.meta.dir, '..');
const OUTPUT = join(ROOT, 'docs/pro-split/route-manifest.json');
// Owner-selected ordinary set; all other ranking data comes from the registry.
const ORDINARY_RANKINGS = new Set<RankingSlug>([
  'ai-risk-high', 'workers', 'ai-risk-low', 'high-demand',
  'salary-safe', 'short-hours', 'hourly-wage', 'salary',
]);
const RETAINED = new Set(['/', '/map', '/me', '/shindan', '/rankings', '/about', '/privacy', '/compliance']);
const MIGRATED = new Set([
  'compare', 'skills', 'interests', 'abilities', 'knowledge', 'values',
  'education', 'training', 'work-styles', 'employment-types', 'life-balance',
  'entry-paths', 'careers', 'licenses', 'explore', 'q', 'answers', 'models',
  'methodology', 'data', 'standard', 'haid', 'aiadoption', 'yearly', 'gyakuten',
]);

export const ordinaryOccupationPath = occupationPath;

/** Templates are rules for VALID generated pages, never deployable wildcards. */
export function classifyTemplate(path: string) {
  if (['/pro', '/pro/[id]', '/pro/rankings', '/pro/rankings/[slug]'].includes(path)) {
    return { oldStatus: 200, ordinaryTemplate: null, proTemplate: path, scope: 'stage-1A-public-copy' };
  }
  if (path === '/404') return { oldStatus: 404, ordinaryTemplate: path, proTemplate: null, scope: 'error-document' };
  if (path === '/[...id]') return { oldStatus: 200, ordinaryTemplate: '/<id> (404: /occupations/404)', proTemplate: '/pro/<id>', scope: 'valid-occupation-ids' };
  if (path === '/rankings/[type]') return { oldStatus: 'per-ranking-manifest', ordinaryTemplate: '/rankings/<8 selected slugs>', proTemplate: '/pro/rankings/<39 registered slugs>', scope: 'registered-ranking-slugs' };
  if (RETAINED.has(path) || path === '/sectors' || path === '/sectors/[sector]') {
    return { oldStatus: 200, ordinaryTemplate: path, proTemplate: path === '/rankings' ? '/pro/rankings' : null, scope: 'existing-valid-pages' };
  }
  if (MIGRATED.has(path.split('/')[1]!)) {
    return { oldStatus: 301, ordinaryTemplate: null, proTemplate: `/pro${path}`, scope: 'existing-valid-pages-only' };
  }
  throw new Error(`Unclassified Astro route: ${path}; update the approved contract explicitly`);
}

function astroFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('_')) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? astroFiles(path) : entry.name.endsWith('.astro') ? [path] : [];
  }).sort();
}

export function buildManifest() {
  const registry = new Set(RANKING_META.map(r => r.slug));
  if (registry.size !== RANKING_META.length || RANKING_META.length !== 39 || DEINDEXED_RANKINGS.size !== 4) {
    throw new Error('Ranking inventory changed; review the 39/8/31/4 contract');
  }
  for (const slug of [...ORDINARY_RANKINGS, ...DEINDEXED_RANKINGS]) {
    if (!registry.has(slug)) throw new Error(`Contract slug missing from registry: ${slug}`);
  }
  const rankings = RANKING_META.map(meta => {
    const retained = ORDINARY_RANKINGS.has(meta.slug);
    const oldPath = `/rankings/${meta.slug}`;
    const proPath = `/pro${oldPath}`;
    const noindex = DEINDEXED_RANKINGS.has(meta.slug);
    return {
      slug: meta.slug, name_ja: meta.name_ja, oldPath, oldStatus: retained ? 200 : 301,
      ordinaryPath: retained ? oldPath : null, proPath,
      phase1ProCanonical: oldPath,
      // proCanonical is the policy after the authorized stage-1B migration.
      proCanonicalStage: '1B', proCanonical: retained ? oldPath : proPath, noindex,
      ordinarySitemap: retained, proSitemap: !retained && !noindex,
    };
  });
  const pageTemplates = astroFiles(join(ROOT, 'src/pages')).map(file => {
    const source = relative(ROOT, file);
    let oldTemplate = '/' + relative(join(ROOT, 'src/pages'), file)
      .replace(/\.astro$/, '').replace(/(^|\/)index$/, '');
    if (oldTemplate.startsWith('/pro/') && MIGRATED.has(oldTemplate.split('/')[2]!)) oldTemplate = oldTemplate.slice(4);
    return { source, oldTemplate, ...classifyTemplate(oldTemplate) };
  });
  const currentRedirects = loadRedirects();
  const latest = expectedRedirects(loadScoreRuns());
  const modelAliases = [...latest.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([source, run]) => {
    const current = currentRedirects.filter(r => r.source === source);
    if (current.length !== 1 || current[0]!.destination !== `/pro${run}` || current[0]!.statusCode !== 301) {
      throw new Error(`Existing model alias differs from latest score run: ${source}`);
    }
    return [
      { source, currentDestination: `/pro${run}`, currentStatus: 301, destination: `/pro${run}`, plannedStatus: 301 },
      { source: `/pro${source}`, currentDestination: null, currentStatus: null, destination: `/pro${run}`, plannedStatus: 301 },
    ];
  });
  const legacyAliases = ['/ja/about/methodology', '/ja/about/data-sources'].map(source => ({ source, currentDestination: '/pro/methodology', destination: '/pro/methodology', plannedStatus: 301 }));
  const retainedLegacyTargets = currentRedirects.filter(r =>
    r.source.startsWith('/occ/') || ['/ja/404', '/ja/404.html', '/ja/about', '/ja/about/glossary'].includes(r.source),
  ).map(r => `${r.source} -> ${r.destination}`).join('; ');
  return {
    schemaVersion: 1, stage: 'stage-1B', redirectAuthorization: 'owner authorization 2026-10-09, decision d1008-214048-1',
    sources: ['src/views/rankings-meta.ts', 'src/pages/**/*.astro', 'src/lib/urls.ts', 'data/scores/*.json', 'vercel.json'],
    rankings, pageTemplates,
    occupation: {
      ordinaryStatus: 200, proTemplate: '/pro/<numeric-id>',
      exception: { id: 404, ordinaryPath: occupationPath(404), proPath: '/pro/404' },
      phase1ProCanonical: 'ordinary occupation URL', finalCanonical: 'each distinct edition self-canonical',
      invalidIdStatus: 404,
    },
    modelAliases, legacyAliases,
    legacyWildcardPolicy: `Ordinary occupation aliases retain their existing targets: ${retainedLegacyTargets}. Expand language wildcards against valid built routes by the current destination family: Root-retained families stay at root; migrated families go directly to their final Pro URL. No /pro/:path* blanket redirect.`,
    infrastructure: ['/api/*', '/data.*.json', '/sitemap.xml', '/image-sitemap.xml', '/llms.txt', '/llms-full.txt', '/robots.txt', '/404', '/fonts/*', '/_astro/*'],
  };
}

export function checkManifest(json: string): boolean {
  try { return JSON.stringify(JSON.parse(json)) === JSON.stringify(buildManifest()); }
  catch { return false; }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--write', '--check'].includes(args[0]!)) {
    console.error('Usage: bun scripts/pro-split-manifest.ts --write|--check');
    process.exit(2);
  }
  if (args[0] === '--write') {
    mkdirSync(join(ROOT, 'docs/pro-split'), { recursive: true });
    writeFileSync(OUTPUT, JSON.stringify(buildManifest(), null, 2) + '\n');
  } else if (!checkManifest(readFileSync(OUTPUT, 'utf8'))) {
    console.error('Pro route manifest is stale; review sources and regenerate with --write');
    process.exit(1);
  }
  console.log('Pro route manifest OK: 39 rankings / 8 retained / 31 migrated / 4 noindex; Astro templates and latest model aliases verified');
}
