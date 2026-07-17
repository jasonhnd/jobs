import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { INDEX_CRITICAL_CSS, INDEX_CSS } from '../src/pages/_index-css';

const DIST = join(process.cwd(), 'dist-astro');
const HOME_HTML = join(DIST, 'index.html');
const HOME_SOURCE = readFileSync(join(process.cwd(), 'src/pages/index.astro'), 'utf8');

function readBuiltHomepage(path = HOME_HTML): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match?.[1] ?? null;
}

test('homepage source declares preload activation and a no-JS fallback without a blocking duplicate', () => {
  assert.match(
    HOME_SOURCE,
    /<link id="home-full-stylesheet" rel="preload" href=\{HOME_INDEX_CSS_URL\} as="style"/,
  );
  assert.match(HOME_SOURCE, /getElementById\('home-full-stylesheet'\)/);
  assert.match(HOME_SOURCE, /addEventListener\('load'/);
  assert.match(HOME_SOURCE, /sheet\.rel = 'stylesheet'/);

  const noScript = HOME_SOURCE.match(/<noscript[^>]*>([\s\S]*?)<\/noscript>/)?.[1];
  assert.ok(noScript, 'homepage source must provide a no-JavaScript fallback');
  assert.match(noScript, /<link rel="stylesheet" href=\{HOME_INDEX_CSS_URL\}/);

  const executableSource = HOME_SOURCE.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/g, '');
  assert.doesNotMatch(executableSource, /<link rel="stylesheet" href=\{HOME_INDEX_CSS_URL\}/);
});

test('critical CSS is a balanced subset covering every first-render surface', () => {
  assert.ok(INDEX_CRITICAL_CSS.length < INDEX_CSS.length, 'critical CSS must stay smaller than full CSS');
  for (const selector of [
    '.desktop-hero',
    '.mobile-hero',
    '.m-top10-track',
    '.m-map-preview',
    '.home-kpi-band',
  ]) {
    assert.ok(INDEX_CRITICAL_CSS.includes(selector), `critical CSS must include ${selector}`);
  }
  assert.equal(
    INDEX_CRITICAL_CSS.match(/\{/g)?.length,
    INDEX_CRITICAL_CSS.match(/\}/g)?.length,
    'critical CSS blocks must be balanced after slice concatenation',
  );
});

test('rendered contract tolerates a clean checkout without build output', () => {
  assert.equal(readBuiltHomepage(join(DIST, '.missing-index.html')), null);
});

test(
  'built homepage defers its one hashed full stylesheet and keeps a no-JS fallback',
  () => {
    const html = readBuiltHomepage();
    if (html === null) return;
    const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1];
    assert.ok(head, 'built homepage must contain a head element');

    const linkTags = head.match(/<link\b[^>]*>/g) ?? [];
    const preload = linkTags.find((tag) => attribute(tag, 'id') === 'home-full-stylesheet');
    assert.ok(preload, 'homepage full CSS preload must be present');
    assert.equal(attribute(preload, 'rel'), 'preload');
    assert.equal(attribute(preload, 'as'), 'style');

    const cssHref = attribute(preload, 'href');
    assert.match(cssHref ?? '', /^\/_astro\/_index\.[A-Za-z0-9_-]+\.css$/);

    const noScript = head.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1];
    assert.ok(noScript, 'homepage must provide a no-JavaScript stylesheet fallback');
    const fallback = noScript.match(/<link\b[^>]*>/)?.[0];
    assert.ok(fallback, 'no-JavaScript fallback must contain a link');
    assert.equal(attribute(fallback, 'rel'), 'stylesheet');
    assert.equal(attribute(fallback, 'href'), cssHref);

    const executableHead = head.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
    const blockingDuplicates = (executableHead.match(/<link\b[^>]*>/g) ?? []).filter(
      (tag) => attribute(tag, 'rel') === 'stylesheet' && attribute(tag, 'href') === cssHref,
    );
    assert.equal(blockingDuplicates.length, 0, 'full homepage CSS must not be render-blocking');

    assert.match(executableHead, /getElementById\('home-full-stylesheet'\)/);
    assert.match(executableHead, /addEventListener\('load'/);
    assert.match(executableHead, /sheet\.rel = 'stylesheet'/);

    const cssAssets = readdirSync(join(DIST, '_astro')).filter((file) =>
      /^_index\.[A-Za-z0-9_-]+\.css$/.test(file),
    );
    assert.deepEqual(cssAssets, [basename(cssHref ?? '')]);
  },
);
