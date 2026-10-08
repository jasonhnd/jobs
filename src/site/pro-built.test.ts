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

describe('stage 1A rendered Pro contract', { skip: !ready && !required }, () => {
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
      const normalize = (text: string | undefined) => text?.replace(/href="\/pro\/404/g, 'href="/occupations/404').replace(/href="\/pro\/rankings/g, 'href="/rankings').replace(/href="\/pro\/(\d+)/g, 'href="/$1');
      assert.ok(body(old), `body ${id}`);
      assert.equal(normalize(body(pro))?.trim(), body(old)?.trim(), `full occupation body ${id}`);
      assert.deepEqual(jsonld(pro).find(n => n['@type'] === 'Occupation'), jsonld(old).find(n => n['@type'] === 'Occupation'), `entity ${id}`);
      const webpage = jsonld(pro).find(n => n['@type'] === 'WebPage');
      assert.equal(webpage?.url, `https://mirai-shigoto.com/pro/${id}`);
      assert.equal(webpage?.['@id'], `https://mirai-shigoto.com/pro/${id}#webpage`);
      assert.equal(pro.match(/<div data-occupation-page-meta[^>]*>/)?.[0], old.match(/<div data-occupation-page-meta[^>]*>/)?.[0]);
      assert.ok(old.includes(`href="/pro/${id}">Pro で詳しく見る</a>`));
    }
  });
  test('exact 39 rankings inherit ordering, canonical and four noindex policies', () => {
    const proFiles = readdirSync(join(dist, 'pro/rankings')).filter(f => f.endsWith('.html')).map(f => f.replace('.html', '')).sort();
    assert.deepEqual(proFiles, manifest.rankings.map(r => r.slug).sort());
    for (const row of manifest.rankings) {
      const old = html(row.oldPath); const pro = html(row.proPath);
      assert.ok(pro.includes(`<link rel="canonical" href="https://mirai-shigoto.com${row.phase1ProCanonical}">`));
      assert.ok(pro.includes(`content="${row.noindex ? 'noindex' : 'index'}, follow"`));
      const ids = (text: string) => jsonld(text).find(n => n['@type'] === 'ItemList')?.itemListElement.map((r: {url: string}) => r.url.split('/').pop());
      assert.deepEqual(ids(pro), ids(old), `ordering ${row.slug}`);
      assert.ok(jsonld(pro).find(n => n['@type'] === 'ItemList')?.itemListElement.every((r: {url: string}) => /^https:\/\/mirai-shigoto.com\/pro\/\d+$/.test(r.url)));
      assert.equal(old.includes('data-pro-cta'), row.ordinaryPath !== null, `CTA ${row.slug}`);
    }
  });
  test('Pro is absent from both sitemaps, while hubs are indexable and unknown URLs are not generated', () => {
    for (const name of ['sitemap.xml', 'image-sitemap.xml']) assert.ok(!readFileSync(join(dist, name), 'utf8').includes('https://mirai-shigoto.com/pro'));
    for (const path of ['/pro', '/pro/rankings']) assert.ok(html(path).includes('content="index, follow"'));
    assert.ok(!existsSync(join(dist, 'pro/999999.html')));
    assert.ok(!existsSync(join(dist, 'pro/rankings/unknown.html')));
    assert.ok(html('/404').includes('content="noindex, follow"'));
  });
});
