#!/usr/bin/env bun
/**
 * Proves that every occupation owns one collision-free, indexable output path.
 * Run after `bun run build`, when both the graph projections and dist-astro
 * are available.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { loadGraph } from '../src/graph/index.js';
import { occupationPath, jaUrl } from '../src/lib/urls.js';
import { OCCUPATION_COUNT } from '../src/site/config.js';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist-astro');
const PAGES = join(ROOT, 'src', 'pages');
const SITE = 'https://mirai-shigoto.com';

function fail(message: string): never {
  throw new Error(`[verify-occupation-routes] ${message}`);
}

function walkFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function outputUrl(file: string): string {
  const rel = relative(DIST, file).split(sep).join('/').replace(/\.html$/, '');
  if (rel === 'index') return '/';
  if (rel.endsWith('/index')) return `/${rel.slice(0, -'/index'.length)}`;
  return `/${rel}`;
}

function outputFile(pathname: string): string {
  return join(DIST, `${pathname.slice(1)}.html`);
}

function staticSourcePath(file: string): string | null {
  const rel = relative(PAGES, file).split(sep).join('/');
  if (!/\.(astro|md|mdx|ts|js)$/.test(rel)) return null;
  const parts = rel.split('/');
  if (parts.some((part) => part.startsWith('_') || part.includes('['))) return null;
  parts[parts.length - 1] = parts[parts.length - 1]!.replace(/\.(astro|md|mdx|ts|js)$/, '');
  if (parts.at(-1) === 'index') parts.pop();
  return parts.length === 0 ? '/' : `/${parts.join('/')}`;
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] ?? null;
}

function canonicalOf(html: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, 'rel')?.toLowerCase().split(/\s+/) ?? [];
    if (rel.includes('canonical')) return attr(tag, 'href');
  }
  return null;
}

function robotsOf(html: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attr(tag, 'name')?.toLowerCase() === 'robots') return attr(tag, 'content')?.toLowerCase() ?? '';
  }
  return '';
}

function jsonLdNodes(html: string): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [];
  const scriptRe = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    let payload: unknown;
    try {
      payload = JSON.parse(match[1]!);
    } catch (error) {
      fail(`invalid JSON-LD in rendered HTML: ${String(error)}`);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
    const root = payload as Record<string, unknown>;
    const candidates = Array.isArray(root['@graph']) ? root['@graph'] : [root];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        nodes.push(candidate as Record<string, unknown>);
      }
    }
  }
  return nodes;
}

function countExact(haystack: string, needle: string): number {
  let count = 0;
  let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) >= 0) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

if (!existsSync(DIST)) fail(`${DIST} does not exist; run bun run build first`);

const graph = await loadGraph();
const occupations = [...graph.occupations.entries()]
  .map(([id, occupation]) => ({ id: Number(id), occupation }))
  .sort((a, b) => a.id - b.id);
if (occupations.length !== OCCUPATION_COUNT.TOTAL) {
  fail(`graph has ${occupations.length} occupations; expected ${OCCUPATION_COUNT.TOTAL}`);
}

const expectedPaths = occupations.map(({ id }) => occupationPath(id));
const uniquePaths = new Set(expectedPaths);
if (uniquePaths.size !== occupations.length) {
  fail(`${occupations.length - uniquePaths.size} duplicate occupation canonical path(s)`);
}

const staticPaths = new Set(walkFiles(PAGES).map(staticSourcePath).filter((path): path is string => path !== null));
for (const pathname of expectedPaths) {
  if (staticPaths.has(pathname)) fail(`${pathname} is owned by both an occupation and a static source route`);
}

const renderedOccupationPaths = new Map<string, number>();
for (const file of walkFiles(DIST).filter((candidate) => candidate.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  const occupationNodes = jsonLdNodes(html).filter((node) => node['@type'] === 'Occupation');
  if (occupationNodes.length === 0) continue;
  const pathname = outputUrl(file);
  if (occupationNodes.length !== 1) fail(`${pathname} renders ${occupationNodes.length} Occupation JSON-LD nodes`);
  renderedOccupationPaths.set(pathname, (renderedOccupationPaths.get(pathname) ?? 0) + 1);
}

for (const { id, occupation } of occupations) {
  const pathname = occupationPath(id);
  const canonical = jaUrl(id);
  const file = outputFile(pathname);
  if (!existsSync(file)) fail(`occupation ${id} is missing rendered output ${pathname}`);
  const html = readFileSync(file, 'utf8');
  if (canonicalOf(html) !== canonical) {
    fail(`occupation ${id} canonical is ${JSON.stringify(canonicalOf(html))}; expected ${canonical}`);
  }
  if (robotsOf(html).includes('noindex')) fail(`occupation ${id} at ${pathname} is noindex`);
  const node = jsonLdNodes(html).find((candidate) => candidate['@type'] === 'Occupation');
  if (!node) fail(`occupation ${id} at ${pathname} has no Occupation JSON-LD`);
  if (node['@id'] !== `${canonical}#occupation`) {
    fail(`occupation ${id} JSON-LD @id is ${JSON.stringify(node['@id'])}; expected ${canonical}#occupation`);
  }
  if (renderedOccupationPaths.get(pathname) !== 1) {
    fail(`occupation ${id} expected one rendered owner for ${pathname}; found ${renderedOccupationPaths.get(pathname) ?? 0}`);
  }
  if (id === 404 && node.name !== occupation.titleJa) {
    fail(`occupation 404 JSON-LD name is ${JSON.stringify(node.name)}; expected ${JSON.stringify(occupation.titleJa)}`);
  }
}

if (renderedOccupationPaths.size !== occupations.length) {
  const unexpected = [...renderedOccupationPaths.keys()].filter((pathname) => !uniquePaths.has(pathname));
  fail(`rendered ${renderedOccupationPaths.size} occupation paths; expected ${occupations.length}; unexpected=${unexpected.join(',')}`);
}

const notFoundFile = join(DIST, '404.html');
if (!existsSync(notFoundFile)) fail('custom /404 output is missing');
const notFoundHtml = readFileSync(notFoundFile, 'utf8');
if (canonicalOf(notFoundHtml) !== `${SITE}/404`) fail('custom /404 canonical changed unexpectedly');
if (!robotsOf(notFoundHtml).includes('noindex')) fail('custom /404 document must be noindex');
if (jsonLdNodes(notFoundHtml).some((node) => node['@type'] === 'Occupation')) {
  fail('custom /404 document contains Occupation JSON-LD');
}

for (const sitemapName of ['sitemap.xml', 'image-sitemap.xml']) {
  const sitemap = readFileSync(join(DIST, sitemapName), 'utf8');
  for (const { id } of occupations) {
    const loc = `<loc>${jaUrl(id)}</loc>`;
    if (countExact(sitemap, loc) !== 1) {
      fail(`${sitemapName} contains ${countExact(sitemap, loc)} entries for occupation ${id}; expected 1`);
    }
  }
  if (sitemap.includes(`<loc>${SITE}/404</loc>`)) fail(`${sitemapName} advertises the custom /404 document`);
}

const staleRootLink = /(?:href|content)=["'](?:https:\/\/mirai-shigoto\.com)?\/404(?:[?#][^"']*)?["']/i;
for (const file of walkFiles(DIST).filter((candidate) => candidate.endsWith('.html') && candidate !== notFoundFile)) {
  if (staleRootLink.test(readFileSync(file, 'utf8'))) {
    fail(`${outputUrl(file)} still advertises /404 instead of /occupations/404`);
  }
}
for (const file of walkFiles(DIST).filter((candidate) => candidate.endsWith('.json'))) {
  const text = readFileSync(file, 'utf8');
  if (text.includes('"href":"/404"') || text.includes(`"url":"${SITE}/404"`) || text.includes(`"@id":"${SITE}/404#occupation"`)) {
    fail(`${relative(DIST, file)} still contains an occupation URL rooted at /404`);
  }
}

console.log(
  `[verify-occupation-routes] ${occupations.length} occupations own ${uniquePaths.size} unique, indexable routes; ` +
  '/404 remains the noindex not-found document',
);
