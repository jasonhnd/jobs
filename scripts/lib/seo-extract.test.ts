import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';

interface SeoExtract {
  findMetaContent(html: string, attrName: string, attrValue: string): string | null;
  findAllMeta(html: string, attrName: string, prefix: string): Record<string, string>;
  extractTitle(html: string): string | null;
  extractCanonical(html: string): string | null;
  extractJsonLd(html: string): unknown[];
  extractInternalLinks(html: string): string[];
  extractAnchorIds(html: string): string[];
}

const require = createRequire(import.meta.url);
const seo = require('./seo-extract.cjs') as SeoExtract;

describe('seo-extract meta values', () => {
  test('keeps an apostrophe inside a double-quoted value', () => {
    const html = `<meta name="description" content="AI's impact on 1,000 jobs">`;
    assert.equal(seo.findMetaContent(html, 'name', 'description'), "AI's impact on 1,000 jobs");
  });

  test('keeps a double quote inside a single-quoted value', () => {
    const html = `<meta content='the "AI" score' name='description'>`;
    assert.equal(seo.findMetaContent(html, 'name', 'description'), 'the "AI" score');
  });

  test('finds the value when other attributes sit between name and content', () => {
    const html = '<meta name="description" data-astro-cid="x" content="body">';
    assert.equal(seo.findMetaContent(html, 'name', 'description'), 'body');
  });

  test('collects og:/twitter: values containing apostrophes', () => {
    const html = [
      `<meta property="og:title" content="It's live">`,
      '<meta property="og:url" content="https://mirai-shigoto.com/">',
      `<meta name="twitter:title" content="Japan's jobs">`,
    ].join('\n');
    assert.deepEqual(seo.findAllMeta(html, 'property', 'og'), {
      'og:title': "It's live",
      'og:url': 'https://mirai-shigoto.com/',
    });
    assert.deepEqual(seo.findAllMeta(html, 'name', 'twitter'), { 'twitter:title': "Japan's jobs" });
  });

  test('decodes entities in title and canonical, with extra attributes present', () => {
    const html = '<title data-x="1">A &amp; B</title><link data-a="1" rel="canonical" href="https://mirai-shigoto.com/a?x=1&amp;y=2">';
    assert.equal(seo.extractTitle(html), 'A & B');
    assert.equal(seo.extractCanonical(html), 'https://mirai-shigoto.com/a?x=1&y=2');
  });
});

describe('seo-extract JSON-LD', () => {
  test('extracts blocks that carry id / nonce attributes', () => {
    const html = [
      '<script type="application/ld+json" id="ld-main">{"@type":"WebPage"}</script>',
      '<script nonce="abc" type="application/ld+json">{"@type":"Article"}</script>',
      "<script type='application/ld+json'>{\"@type\":\"Dataset\"}</script>",
      '<script type="module">const x = 1;</script>',
    ].join('');
    assert.deepEqual(seo.extractJsonLd(html), [
      { '@type': 'WebPage' }, { '@type': 'Article' }, { '@type': 'Dataset' },
    ]);
  });

  test('reports a parse error instead of dropping a malformed block', () => {
    const [payload] = seo.extractJsonLd('<script type="application/ld+json" id="x">{oops</script>') as Array<Record<string, unknown>>;
    assert.equal(typeof payload!.__parseError, 'string');
  });
});

describe('seo-extract links and anchors', () => {
  test('takes href, not a preceding data-href', () => {
    assert.deepEqual(seo.extractInternalLinks('<a data-href="/decoy" href="/real">x</a>'), ['/real']);
  });

  test('reads unquoted href values', () => {
    assert.deepEqual(seo.extractInternalLinks('<a href=/unquoted class=x>x</a>'), ['/unquoted']);
  });

  test('keeps relative links and maps same-site origins onto paths', () => {
    const html = [
      '<a href="../up">a</a>', '<a href="sibling">b</a>', '<a href="./here">c</a>',
      '<a href="http://mirai-shigoto.com/http">d</a>',
      '<a href="https://www.mirai-shigoto.com/www">e</a>',
      '<a href="//mirai-shigoto.com/proto">f</a>',
      '<a href="https://example.test/ext">g</a>', '<a href="mailto:x@example.test">h</a>',
      '<a href="#frag">i</a>',
    ].join('');
    assert.deepEqual(seo.extractInternalLinks(html), [
      '#frag', '../up', './here', '/http', '/proto', '/www', 'sibling',
    ]);
  });

  test('ignores markup inside comments and inline scripts', () => {
    const html = [
      '<!-- <a href="/in-comment">x</a> -->',
      '<script>const s = \'<a href="/in-script">\';</script>',
      '<a href="/real">real</a>',
    ].join('');
    assert.deepEqual(seo.extractInternalLinks(html), ['/real']);
  });

  test('records ids containing @ and ignores data-id', () => {
    const html = [
      '<h2 id="hist-title-opus-5@2026-07-26">x</h2>',
      '<div data-id="not-an-anchor"></div>',
      "<p id='single'></p>", '<p id=bare></p>', '<p id=""></p>',
    ].join('');
    assert.deepEqual(seo.extractAnchorIds(html), ['bare', 'hist-title-opus-5@2026-07-26', 'single']);
  });
});
