import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'verify-internal-links.cjs');
const fixtures: string[] = [];

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'jobs-internal-links-')));
  fixtures.push(root);
  mkdirSync(join(root, 'dist-astro'));
  return root;
}

function write(root: string, file: string, text: string): void {
  const full = join(root, 'dist-astro', file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

function run(root: string) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: root, encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
}

describe('verify-internal-links CLI regression contract', () => {
  test('accepts emitted routes, assets, prefixes and runtime fragments with exact counts', () => {
    const root = fixture();
    write(root, 'index.html', '<a href="/target#section">target</a><a href="/#runtime">runtime</a>');
    write(root, 'target.html', [
      '<main id="section"></main>', '<a href="#section">self</a>',
      '<a href="/target/?q=1">slash</a>', '<a href="/nested">nested</a>',
      '<a href="/asset.txt">asset</a>', '<a href="/api/og?job=1">api</a>',
      '<a href="/data.fixture.json">data</a>', '<a href="/map#runtime">map</a>',
      '<a href="https://example.test/missing">external</a>',
      '<a href="mailto:fixture@example.test">mail</a>', '<a href="tel:123">phone</a>',
      '<a href="./asset.txt">relative</a>', '<a href="#">empty</a>',
    ].join(''));
    write(root, 'nested/index.html', '<a href="https://mirai-shigoto.com/target#section">same origin</a>');
    write(root, 'map.html', 'fixture');
    write(root, 'asset.txt', 'fixture');
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, [
      '[verify-internal-links] scanned 4 HTML files',
      '[verify-internal-links] 11 internal hrefs (2 allowlisted, 5 with fragments)', '',
      '✅ Internal-link integrity passed — every NEW href resolves; 0 pre-known broken targets remain (TODO).', '',
    ].join('\n'));
  });

  test('rejects a missing build directory with the original exit status', () => {
    const root = fixture();
    rmSync(join(root, 'dist-astro'), { recursive: true });
    const result = run(root);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr,
      `[verify-internal-links] ${join(root, 'dist-astro')} does not exist. Run \`pnpm build\` first.\n`);
  });

  test('keeps broken route and fragment diagnostics, ordering and source truncation', () => {
    const root = fixture();
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      write(root, `${name}.html`, '<a href="/missing">missing</a><a href="/target#dead">dead</a>');
    }
    write(root, 'target.html', '<main id="existing"></main>');
    // The gate preserves filesystem traversal order for source attribution.
    const sources = readdirSync(join(root, 'dist-astro'), { withFileTypes: true })
      .filter((entry) => entry.name !== 'target.html')
      .map((entry) => '/' + entry.name.replace(/\.html$/, ''));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, [
      '[verify-internal-links] scanned 6 HTML files',
      '[verify-internal-links] 10 internal hrefs (0 allowlisted, 5 with fragments)', '',
    ].join('\n'));
    assert.equal(result.stderr, [
      '', '❌ 1 NEW broken internal href(s):', '',
      '  /missing', `    linked from: ${sources.slice(0, 3).join(', ')} (and 2 more)`, '',
      '❌ 1 broken anchor fragment(s) — target id does not exist:',
      '  /target#dead', `    linked from: ${sources.slice(0, 2).join(', ')} (and 3 more)`,
      '  Fix the link or the target id. If the id is created at runtime by inline JS,',
      '  add the page to RUNTIME_FRAGMENT_PAGES instead of adding it to the allowlist.', '',
    ].join('\n'));
  });

  test('rejects a broken intra-page fragment', () => {
    const root = fixture();
    write(root, 'target.html', '<a href="#dead">dead</a>');
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /broken anchor fragment\(s\)[\s\S]*\/target#dead/);
  });

  test('still validates the page path for runtime-fragment pages', () => {
    const root = fixture();
    write(root, 'target.html', '<a href="/map#runtime">missing map</a>');
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /NEW broken internal href\(s\)[\s\S]*\/map/);
    assert.ok(!result.stderr.includes('broken anchor fragment(s)'));
  });

  test('checks canonical, alternate and form targets as well as anchors', () => {
    const root = fixture();
    write(root, 'target.html', [
      '<link rel="canonical" href="/canonical-missing">',
      '<link href="/alternate-missing" rel="alternate">',
      '<form action="/form-missing"></form>',
    ].join(''));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /3 NEW broken internal href\(s\)/);
    for (const href of ['/alternate-missing', '/canonical-missing', '/form-missing']) {
      assert.ok(result.stderr.includes(href), result.stderr);
    }
  });

  test('preserves the limit of 30 fragment diagnostics', () => {
    const root = fixture();
    write(root, 'source.html', Array.from({ length: 31 }, (_, i) =>
      `<a href="/target#dead-${String(i).padStart(2, '0')}">dead</a>`).join(''));
    write(root, 'target.html', 'fixture');
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /31 broken anchor fragment\(s\)/);
    assert.ok(result.stderr.includes('/target#dead-29'));
    assert.ok(!result.stderr.includes('/target#dead-30'));
    assert.ok(result.stderr.includes('...and 1 more (truncated)'));
  });

  test('fails when dist-astro exists but holds no HTML', () => {
    const root = fixture();
    write(root, 'asset.txt', 'fixture');
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no HTML files/);
  });

  test('checks unquoted, data-href-shadowed, relative and same-site absolute links', () => {
    const root = fixture();
    write(root, 'ja/target.html', [
      '<a data-href="/ja/target" href="/missing-shadowed">a</a>',
      '<a href=/missing-unquoted>b</a>',
      '<a href="../missing-parent">c</a>',
      '<a href="missing-sibling">d</a>',
      '<a href="http://mirai-shigoto.com/missing-http">e</a>',
      '<a href="https://www.mirai-shigoto.com/missing-www">f</a>',
      '<a href="target">self</a>',
    ].join(''));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /6 NEW broken internal href\(s\)/);
    for (const href of ['/missing-shadowed', '/missing-unquoted', '/missing-parent', '/ja/missing-sibling', '/missing-http', '/missing-www']) {
      assert.ok(result.stderr.includes(`  ${href}\n`), `${href}\n${result.stderr}`);
    }
  });

  test('decodes percent-encoded paths and fragments before matching', () => {
    const root = fixture();
    write(root, 'ja/職業.html', '<h2 id="見出し">x</h2><h2 id="hist-title-opus-5@2026-07-26">y</h2>');
    write(root, 'index.html', [
      '<a href="/ja/%E8%81%B7%E6%A5%AD#%E8%A6%8B%E5%87%BA%E3%81%97">encoded</a>',
      '<a href="/ja/職業#hist-title-opus-5@2026-07-26">at-sign</a>',
    ].join(''));
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
  });

  test('ignores links inside comments and inline scripts', () => {
    const root = fixture();
    write(root, 'index.html', [
      '<!-- <a href="/in-comment">x</a> -->',
      '<script>const t = \'<a href="/in-script">\';</script>',
    ].join(''));
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
  });
});
