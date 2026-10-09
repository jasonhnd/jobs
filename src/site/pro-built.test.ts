import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import manifest from '../../docs/pro-split/route-manifest.json';
import { occupationPath } from '../lib/urls';

const dist = join(process.cwd(), 'dist-astro');
const required = process.env.REQUIRE_BUILT_ARTIFACTS === '1';
const ready = existsSync(join(dist, 'pro.html'));
function html(path: string): string { return readFileSync(join(dist, `${path.slice(1)}.html`), 'utf8'); }
function jsonld(text: string): Array<Record<string, any>> {
  return [...text.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap(m => { const p = JSON.parse(m[1]!); return p['@graph'] ?? [p]; });
}

describe('stage 1B rendered Pro contract', { skip: !ready && !required }, () => {
  test('all 556 ordinary and Pro occupations retain the same body, score metadata and entity', () => {
    assert.ok(ready, 'run bun run build');
    const ids = readdirSync('data/occupations').filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join('data/occupations', f), 'utf8')).id as number);
    assert.equal(ids.length, 556);
    const proFiles = readdirSync(join(dist, 'pro')).filter(f => /^\d+\.html$/.test(f)).map(f => Number(f.replace('.html', '')));
    assert.deepEqual(proFiles.sort((a,b) => a-b), ids.sort((a,b) => a-b));
    for (const id of ids) {
      const old = html(occupationPath(id)); const pro = html(occupationPath(id, 'pro'));
      const expectedCanonical = `https://mirai-shigoto.com${occupationPath(id)}`;
      assert.ok(pro.includes(`<link rel="canonical" href="${expectedCanonical}">`), `canonical ${id}`);
      assert.ok(pro.includes('content="index, follow"'), `robots ${id}`);
      const body = (text: string) => text.match(/<header id="content">[\s\S]*?(?=<p data-pro-cta|<footer class="site-footer")/)?.[0];
      const normalize = (text: string | undefined) => text?.replace(/href="\/pro\/404/g, 'href="/occupations/404').replace(/href="\/pro\//g, 'href="/');
      assert.ok(body(old), `body ${id}`);
      assert.equal(normalize(body(pro))?.trim(), normalize(body(old))?.trim(), `full occupation body ${id}`);
      assert.deepEqual(jsonld(pro).find(n => n['@type'] === 'Occupation'), jsonld(old).find(n => n['@type'] === 'Occupation'), `entity ${id}`);
      const webpage = jsonld(pro).find(n => n['@type'] === 'WebPage');
      assert.equal(webpage?.url, `https://mirai-shigoto.com/pro/${id}`);
      assert.equal(webpage?.['@id'], `https://mirai-shigoto.com/pro/${id}#webpage`);
      assert.equal(pro.match(/<div data-occupation-page-meta[^>]*>/)?.[0], old.match(/<div data-occupation-page-meta[^>]*>/)?.[0]);
      assert.ok(old.includes(`href="/pro/${id}">Pro で詳しく見る</a>`));
    }
  });
  test('exact 39 rankings inherit ordering, canonical and four noindex policies', async () => {
    const { loadGraph } = await import('../graph');
    const { buildRankings, loadOccupationsFromGraph } = await import('../views/ranking');
    const awaitGraph = await loadGraph();
    const results = buildRankings(() => loadOccupationsFromGraph(awaitGraph)).results;
    const proFiles = readdirSync(join(dist, 'pro/rankings')).filter(f => f.endsWith('.html')).map(f => f.replace('.html', '')).sort();
    assert.deepEqual(proFiles, manifest.rankings.map(r => r.slug).sort());
    for (const row of manifest.rankings) {
      const old = row.ordinaryPath ? html(row.oldPath) : null; const pro = html(row.proPath);
      assert.ok(pro.includes(`<link rel="canonical" href="https://mirai-shigoto.com${row.proCanonical}">`));
      assert.ok(pro.includes(`content="${row.noindex ? 'noindex' : 'index'}, follow"`));
      const ids = (text: string) => jsonld(text).find(n => n['@type'] === 'ItemList')?.itemListElement.map((r: {url: string}) => r.url.split('/').pop());
      assert.deepEqual(ids(pro)?.map(Number), results.get(row.slug as import('../views/rankings-meta').RankingSlug)?.items.map(r => r.id), `ordering ${row.slug}`);
      assert.ok(jsonld(pro).find(n => n['@type'] === 'ItemList')?.itemListElement.every((r: {url: string}) => /^https:\/\/mirai-shigoto.com\/pro\/\d+$/.test(r.url)));
      assert.ok(pro.includes(`href="${row.ordinaryPath ?? '/'}">通常版へ</a>`), `ordinary return ${row.slug}`);
      if (old) assert.ok(old.includes('data-pro-cta'), `CTA ${row.slug}`);
      else assert.ok(!existsSync(join(dist, `${row.oldPath.slice(1)}.html`)), `retired page ${row.slug}`);
    }
  });
  test('Pro ranking JSON-LD matches the actual title and description, including the index', () => {
    for (const path of ['/pro/rankings', ...manifest.rankings.map(row => row.proPath)]) {
      const text = html(path);
      const unescape = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
      const title = unescape(text.match(/<title>([\s\S]*?)<\/title>/)![1]!);
      const description = unescape(text.match(/<meta name="description" content="([^"]*)"/)![1]!);
      assert.ok(title.startsWith('Pro | '), path);
      assert.ok(description.startsWith('Pro · '), path);
      const nodes = jsonld(text);
      const webpage = nodes.find(node => node['@type'] === 'WebPage');
      assert.equal(webpage?.name, title, `${path} WebPage name`);
      assert.equal(webpage?.description, description, `${path} WebPage description`);
      const article = nodes.find(node => node['@type'] === 'Article');
      if (path !== '/pro/rankings') {
        assert.equal(article?.headline, title, `${path} Article headline`);
        assert.equal(article?.description, description, `${path} Article description`);
      }
    }
  });
  test('stage-3 indexes have independent canonicals, with eight ordinary and 39 Pro cards', () => {
    for (const [path, count] of [['/rankings', 8], ['/pro/rankings', 39]] as const) {
      const text = html(path);
      const canonical = `https://mirai-shigoto.com${path}`;
      assert.ok(text.includes(`<link rel="canonical" href="${canonical}">`));
      assert.equal(jsonld(text).find(n => n['@type'] === 'WebPage')?.url, canonical);
      assert.ok(readFileSync(join(dist, 'sitemap.xml'), 'utf8').includes(`<loc>${canonical}</loc>`));
      const cards = path === '/rankings'
        ? [...text.matchAll(/class="ordinary-ranking-card"/g)]
        : [...text.matchAll(/<ul class="ranking-cards">([\s\S]*?)<\/ul>/g)].flatMap(m => [...m[1]!.matchAll(/<li\b/g)]);
      assert.equal(cards.length, count, path);
    }
  });
  test('latest HAID permalink canonical and structured data consolidate to current entrance; older reports self-canonicalize', () => {
    const latest = JSON.parse(readFileSync('public/data.haid-latest.json','utf8'));
    const sitemap = readFileSync(join(dist,'sitemap.xml'),'utf8');
    for (const id of latest.releases) {
      const path = `/pro/aiadoption/${id}`;
      const canonical = `https://mirai-shigoto.com${id === latest.release ? '/pro/aiadoption' : path}`;
      const text = html(path);
      assert.ok(text.includes(`<link rel="canonical" href="${canonical}">`), path);
      assert.equal(jsonld(text).find(n => n['@type'] === 'WebPage')?.url, canonical);
      assert.equal(sitemap.includes(`<loc>https://mirai-shigoto.com${path}</loc>`), id !== latest.release);
    }
  });
  test('all retained Pro ranking WebPage/Article and breadcrumb identities match HTML canonical after adaptation', () => {
    for (const row of manifest.rankings.filter(r => r.ordinaryPath !== null)) {
      const canonical = `https://mirai-shigoto.com${row.ordinaryPath}`;
      const nodes = jsonld(html(row.proPath));
      for (const type of ['WebPage','Article']) assert.equal(nodes.find(n => n['@type'] === type)?.url, canonical, row.slug);
      assert.equal(nodes.find(n => n['@type'] === 'BreadcrumbList')?.itemListElement.at(-1).item, canonical);
    }
  });
  test('main sitemap preserves both GEO discovery files, image sitemap retains ordinary entities, and unknown URLs are absent', () => {
    const sitemap = readFileSync(join(dist,'sitemap.xml'),'utf8');
    for (const file of ['llms.txt','llms-full.txt']) assert.ok(sitemap.includes(`<loc>https://mirai-shigoto.com/${file}</loc>`));
    assert.ok(!readFileSync(join(dist, 'image-sitemap.xml'), 'utf8').includes('https://mirai-shigoto.com/pro'));
    for (const path of ['/pro', '/pro/rankings']) assert.ok(html(path).includes('content="index, follow"'));
    assert.ok(!existsSync(join(dist, 'pro/999999.html')));
    assert.ok(!existsSync(join(dist, 'pro/rankings/unknown.html')));
    assert.ok(html('/404').includes('content="noindex, follow"'));
  });
});
