import { strict as assert } from 'node:assert';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { buildArtifactsRequired } from './lib/built-artifacts.js';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist-astro');
const FONTS = join(DIST, 'fonts');

interface FontManifestAsset {
  readonly href: string;
  readonly preload: boolean;
  readonly family: string;
}

interface FontManifest {
  readonly generated_by: string;
  readonly stylesheet: {
    readonly delivery?: string;
    readonly bytes?: number;
    readonly href?: string;
  };
  readonly assets: readonly FontManifestAsset[];
}

function walkHtml(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(path));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out.sort();
}

function newestManifestPath(): string | null {
  if (!existsSync(FONTS)) return null;
  const manifests = readdirSync(FONTS)
    .filter((name) => /^manifest\.[0-9a-f]{12}\.json$/.test(name))
    .map((name) => join(FONTS, name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  return manifests[0] ?? null;
}

function inlineFontCss(html: string): string | null {
  const match = html.match(/<style>(@font-face\{font-family:"Noto Serif JP"[\s\S]*?)<\/style>/);
  return match?.[1] ?? null;
}

test('subset-fonts source inlines @font-face and records delivery inline', () => {
  const source = readFileSync(join(ROOT, 'scripts/subset-fonts.ts'), 'utf8');
  assert.match(source, /delivery: 'inline'/);
  assert.match(source, /<style>\$\{stylesheet\.css\}<\/style>/);
  assert.match(source, /css\.includes\('<'\)/);
  assert.doesNotMatch(source, /font-faces\.\$\{hash\}\.css/);
  assert.doesNotMatch(source, /rel="stylesheet" href="/);
});

test('docs/README.md describes inline @font-face delivery', () => {
  const doc = readFileSync(join(ROOT, 'docs/README.md'), 'utf8');
  assert.match(doc, /one inline `<style>`/);
  assert.match(doc, /"delivery": "inline"/);
  assert.match(doc, /does not write `font-faces\.<hash>\.css`/);
  assert.doesNotMatch(doc, /stylesheet links/);
});

test('built HTML inlines @font-face, keeps preload URLs, and matches the manifest', () => {
  const htmlFiles = walkHtml(DIST);
  const manifestPath = newestManifestPath();
  if (!buildArtifactsRequired()) return;
  if (htmlFiles.length === 0 || manifestPath === null) {
    throw new Error(
      'dist-astro HTML or fonts/manifest.*.json is missing, but REQUIRE_BUILT_ARTIFACTS is set. ' +
        'Run this test after `bun run build`.',
    );
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FontManifest;
  assert.equal(manifest.generated_by, 'scripts/subset-fonts.ts');
  assert.equal(manifest.stylesheet.delivery, 'inline');
  assert.equal(manifest.stylesheet.href, undefined);
  assert.equal(typeof manifest.stylesheet.bytes, 'number');
  assert.ok(manifest.assets.length > 0, 'manifest must list font assets');

  const fontFiles = readdirSync(FONTS);
  assert.equal(
    fontFiles.some((name) => name.startsWith('font-faces.')),
    false,
    'subset-fonts must not emit font-faces.*.css',
  );
  for (const asset of manifest.assets) {
    assert.match(asset.href, /^\/fonts\/.+\.woff2$/);
    assert.equal(existsSync(join(DIST, asset.href.slice(1))), true, `missing ${asset.href}`);
  }

  const expectedPreloads = manifest.assets.filter((asset) => asset.preload).map((asset) => asset.href);
  assert.ok(expectedPreloads.length > 0, 'at least the serif face stays preloaded');
  let sharedCss: string | null = null;

  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    assert.equal(html.includes('<!-- self-hosted-font-assets -->'), false, `marker left in ${file}`);
    assert.equal(/font-faces\.[0-9a-f]+\.css/.test(html), false, `blocking font CSS left in ${file}`);
    assert.equal(/<link\b[^>]*rel="stylesheet"[^>]*href="\/fonts\//.test(html), false, `font stylesheet link in ${file}`);

    const css = inlineFontCss(html);
    assert.ok(css, `missing inline @font-face block in ${file}`);
    assert.equal(css.includes('<'), false, `unescaped "<" in inline font CSS of ${file}`);
    assert.equal(Buffer.byteLength(css, 'utf8'), manifest.stylesheet.bytes, `manifest bytes differ in ${file}`);
    if (sharedCss === null) sharedCss = css;
    else assert.equal(css, sharedCss, `inline @font-face CSS differs in ${file}`);

    for (const asset of manifest.assets) {
      assert.ok(css.includes(`url("${asset.href}")`), `${file} missing ${asset.href}`);
      assert.ok(css.includes(`font-family:"${asset.family}"`), `${file} missing ${asset.family}`);
    }

    const preloads = [...html.matchAll(/<link rel="preload" href="(\/fonts\/[^"]+\.woff2)" as="font"/g)].map(
      (match) => match[1] ?? '',
    );
    assert.deepEqual(preloads, expectedPreloads, `preload set differs in ${file}`);
  }
});
