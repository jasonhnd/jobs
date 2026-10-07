import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'verify-jsonld.cjs');
const fixtures: string[] = [];

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'jobs-verify-jsonld-')));
  fixtures.push(root);
  mkdirSync(join(root, 'dist-astro'));
  return root;
}

function write(root: string, file: string, text: string): void {
  const full = join(root, 'dist-astro', file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

function page(payload: unknown, attrs = ''): string {
  return `<html><head><script type="application/ld+json"${attrs}>${JSON.stringify(payload)}</script></head></html>`;
}

const WEB_PAGE = { '@type': 'WebPage', url: 'https://mirai-shigoto.com/', name: 'n', description: 'd' };

function run(root: string) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: root, encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
}

describe('verify-jsonld CLI', () => {
  test('accepts a valid @graph page', () => {
    const root = fixture();
    write(root, 'index.html', page({ '@context': 'https://schema.org', '@graph': [WEB_PAGE] }));
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /all 1\/1 pages structurally valid/);
  });

  test('fails when dist-astro exists but holds no HTML', () => {
    const root = fixture();
    write(root, 'sitemap.xml', '<urlset/>');
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no HTML files/);
  });

  test('accepts an @type array and applies each type\'s contract', () => {
    const root = fixture();
    write(root, 'index.html', page({
      '@context': 'https://schema.org',
      '@graph': [{ ...WEB_PAGE, '@type': ['WebPage', 'MedicalWebPage'] }],
    }));
    write(root, 'root.html', page({ ...WEB_PAGE, '@context': 'https://schema.org', '@type': ['CollectionPage', 'WebPage'] }));
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /WebPage\s+1/);
    assert.match(result.stdout, /MedicalWebPage\s+1/);
  });

  test('an @type array still enforces the contracts of its members', () => {
    const root = fixture();
    const { url: _url, ...withoutUrl } = WEB_PAGE;
    write(root, 'index.html', page({
      '@context': 'https://schema.org',
      '@graph': [{ ...withoutUrl, '@type': ['WebPage', 'Thing'] }],
    }));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /WebPage missing \.url/);
  });

  test('rejects an empty or non-string @type array', () => {
    const root = fixture();
    write(root, 'a.html', page({ '@context': 'https://schema.org', '@graph': [WEB_PAGE, { '@type': [] }] }));
    write(root, 'b.html', page({ '@context': 'https://schema.org', '@graph': [WEB_PAGE, { '@type': ['Thing', 3] }] }));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\/a\n\s+- node\[1\] missing string @type/);
    assert.match(result.stderr, /\/b\n\s+- node\[1\] missing string @type/);
  });

  test('validates JSON-LD blocks that carry id / nonce attributes', () => {
    const root = fixture();
    write(root, 'index.html', '<script type="application/ld+json" id="ld" nonce="n">{broken</script>');
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /JSON parse error/);
  });
});
