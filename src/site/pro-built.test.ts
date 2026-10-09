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

describe('stage 2 occupations / stage 1A rendered rankings', { skip: !ready && !required }, () => {
  test('all 556 occupation editions agree on score/name/identity with summary-only ordinary schema', () => {
    assert.ok(ready, 'run bun run build');
    const ids = readdirSync('data/occupations').filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join('data/occupations', f), 'utf8')).id as number);
    assert.equal(ids.length, 556);
    const proFiles = readdirSync(join(dist, 'pro')).filter(f => /^\d+\.html$/.test(f)).map(f => Number(f.replace('.html', '')));
    assert.deepEqual(proFiles.sort((a,b) => a-b), ids.sort((a,b) => a-b));
    for (const id of ids) {
      const ordinary = html(occupationPath(id)); const pro = html(occupationPath(id, 'pro'));
      const ordinaryUrl = `https://mirai-shigoto.com${occupationPath(id)}`;
      const proUrl = `https://mirai-shigoto.com${occupationPath(id, 'pro')}`;
      assert.ok(pro.includes(`<link rel="canonical" href="${proUrl}">`), `canonical ${id}`);
      assert.ok(ordinary.includes(`<link rel="canonical" href="${ordinaryUrl}">`), `ordinary canonical ${id}`);
      assert.ok(pro.includes('content="index, follow"'), `robots ${id}`);
      assert.equal((pro.match(/<details class="chap"/g) ?? []).length, 7, `full Pro chapters ${id}`);
      assert.ok(pro.includes('class="faq-item'), `full Pro FAQ ${id}`);
      assert.ok(ordinary.includes('data-occupation-summary'), `summary ${id}`);
      assert.ok(!ordinary.includes('class="faq-item') && !ordinary.includes('class="risk-rationale'), `no full prose ${id}`);
      const ordinaryNodes = jsonld(ordinary); const proNodes = jsonld(pro);
      const ordinaryEntity = ordinaryNodes.find(n => n['@type'] === 'Occupation')!;
      const proEntity = proNodes.find(n => n['@type'] === 'Occupation')!;
      assert.equal(ordinaryEntity['@id'], `${ordinaryUrl}#occupation`);
      assert.equal(proEntity['@id'], ordinaryEntity['@id']);
      assert.equal(proEntity.name, ordinaryEntity.name);
      assert.ok(!ordinaryNodes.some(n => n['@type'] === 'FAQPage'));
      assert.ok(proNodes.some(n => n['@type'] === 'FAQPage'));
      assert.ok(ordinaryEntity.additionalProperty.length <= 2);
      assert.ok(proEntity.additionalProperty.length > ordinaryEntity.additionalProperty.length);
      const webpage = proNodes.find(n => n['@type'] === 'WebPage');
      assert.equal(webpage?.url, proUrl);
      assert.equal(webpage?.['@id'], `${proUrl}#webpage`);
      assert.equal(pro.match(/<div data-occupation-page-meta[^>]*>/)?.[0], ordinary.match(/<div data-occupation-page-meta[^>]*>/)?.[0]);
      assert.ok(ordinary.includes(`href="/pro/${id}">Pro で詳しく見る</a>`));
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
      assert.ok(pro.includes(`href="${row.oldPath}">通常版へ</a>`), `ordinary return ${row.slug}`);
      assert.equal(old.includes('data-pro-cta'), row.ordinaryPath !== null, `CTA ${row.slug}`);
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
  test('only Pro occupations enter the HTML sitemap; image sitemap stays ordinary; unknown URLs are not generated', () => {
    const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
    const proLocs = [...sitemap.matchAll(/<loc>(https:\/\/mirai-shigoto.com\/pro[^<]*)<\/loc>/g)].map(m => m[1]);
    assert.equal(proLocs.length, 556);
    assert.equal(new Set(proLocs).size, 556);
    assert.ok(proLocs.every(loc => /^https:\/\/mirai-shigoto.com\/pro\/\d+$/.test(loc!)));
    assert.ok(!readFileSync(join(dist, 'image-sitemap.xml'), 'utf8').includes('https://mirai-shigoto.com/pro'));
    for (const path of ['/pro', '/pro/rankings']) assert.ok(html(path).includes('content="index, follow"'));
    assert.ok(!existsSync(join(dist, 'pro/999999.html')));
    assert.ok(!existsSync(join(dist, 'pro/rankings/unknown.html')));
    assert.ok(html('/404').includes('content="noindex, follow"'));
  });
});
