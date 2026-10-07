import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const footer = readFileSync('src/components/Footer.astro', 'utf8');

function loadShareUrl(href: string, canonical: string | null): (source: string, medium: string) => string {
  const start = footer.indexOf('function pageUrl() {');
  assert.ok(start > 0, 'pageUrl not found');
  const end = footer.indexOf('function track(platform)', start);
  const document = {
    querySelector: (sel: string) => (sel === 'link[rel="canonical"]' && canonical ? { href: canonical } : null),
  };
  const loc = new URL(href);
  const window = { location: { href, origin: loc.origin, pathname: loc.pathname } };
  return new Function('document', 'window', `${footer.slice(start, end)}; return shareUrl;`)(document, window);
}

test('footer share URL drops ad-click ids and the hash, keeping only UTM (#884)', () => {
  const shareUrl = loadShareUrl(
    'https://pre.mirai-shigoto.com/sectors/iryo?gclid=abc&fbclid=def&utm_source=google#faq',
    'https://mirai-shigoto.com/sectors/iryo',
  );
  const out = new URL(shareUrl('x', 'social'));
  assert.equal(out.origin + out.pathname, 'https://mirai-shigoto.com/sectors/iryo');
  assert.equal(out.hash, '');
  assert.deepEqual([...out.searchParams.keys()].sort(), ['utm_campaign', 'utm_medium', 'utm_source']);
  assert.equal(out.searchParams.get('utm_source'), 'x');
});

test('footer share URL falls back to origin + path without a canonical link', () => {
  const shareUrl = loadShareUrl('https://pre.mirai-shigoto.com/map?gclid=1#x', null);
  const out = new URL(shareUrl('line', 'im'));
  assert.equal(out.origin + out.pathname, 'https://pre.mirai-shigoto.com/map');
  assert.equal(out.searchParams.get('gclid'), null);
});

test('Hatena share passes the whole URL encoded (#884)', () => {
  assert.doesNotMatch(footer, /b\.hatena\.ne\.jp\/entry\//);
  assert.match(footer, /hatena:\s+`https:\/\/b\.hatena\.ne\.jp\/add\?mode=confirm&url=\$\{u\}`/);
  assert.match(footer, /'https:\/\/b\.hatena\.ne\.jp\/add\?mode=confirm&url=' \+ encodeURIComponent\(shareUrl\('hatena', 'social'\)\)/);
});
