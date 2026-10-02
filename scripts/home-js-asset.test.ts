import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';
import { transform } from 'esbuild';
import { build } from 'vite';
import config from '../astro.config.mjs';
import { requireBuiltArtifact } from './lib/built-artifacts.js';

const homePath = join(process.cwd(), 'src/pages/_index-inline.js');
const source = readFileSync(homePath, 'utf8');
const sha = (bytes: string) => createHash('sha256').update(bytes).digest('hex');

async function loadAsset(id = homePath + '?url') {
  // Exercise the actual configured plugin without mutating a repository file.
  const plugin = config.vite!.plugins![0] as any;
  plugin.configResolved({ build: { assetsDir: '_astro' } });
  const assets: Array<{ type: string; fileName: string; source: string }> = [];
  const watched: string[] = [];
  const result = await plugin.load.call({
    addWatchFile: (file: string) => watched.push(file),
    emitFile: (asset: typeof assets[number]) => { assets.push(asset); return 'asset'; },
  }, id);
  return { assets, watched, result };
}

test('home URL names the final minified bytes and changes from the verbatim cache key', async () => {
  const { assets, watched, result } = await loadAsset();
  assert.equal(assets.length, 1);
  const asset = assets[0];
  const expected = (await transform(source, { minify: true, loader: 'js' })).code;
  assert.equal(asset.source, expected);
  assert.equal(asset.fileName, `_astro/_index-inline.${sha(expected)}.js`);
  assert.notEqual(sha(expected), sha(source));
  assert.ok(Buffer.byteLength(expected) < Buffer.byteLength(source) * 0.6);
  assert.equal(result.code, 'export default "__VITE_ASSET__asset__";');
  assert.deepEqual(watched, [homePath]);
});

test('only the exact home ?url import is transformed', async () => {
  for (const id of [
    homePath, homePath + '?raw', homePath + '?url&raw',
    join(process.cwd(), 'src/pages/_map-inline.js') + '?url',
    join(process.cwd(), 'src/pages/_me-inline.js') + '?url',
    join(process.cwd(), 'public/_index-inline.js') + '?url',
  ]) {
    const { assets, watched, result } = await loadAsset(id);
    assert.equal(result, undefined, id);
    assert.deepEqual(assets, [], id);
    assert.deepEqual(watched, [], id);
  }
});

test('repeat emission is stable', async () => {
  const first = await loadAsset();
  const second = await loadAsset();
  assert.deepEqual(second, first);
});

test('Vite resolves all URL references, records the SSR asset and preserves unrelated JS', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'home-js-asset-'));
  const entry = join(fixture, 'entry.js');
  const mapPath = join(process.cwd(), 'src/pages/_map-inline.js');
  writeFileSync(entry, `export { default as home } from ${JSON.stringify(homePath + '?url')};\nexport { default as map } from ${JSON.stringify(mapPath + '?url')};`);
  try {
    const result = await build({
      configFile: false, root: process.cwd(), base: '/nested/', logLevel: 'silent',
      plugins: config.vite!.plugins,
      build: { ssr: entry, ssrEmitAssets: true, write: false, assetsDir: '_astro', manifest: true },
    });
    assert.ok('output' in result);
    const asset = result.output.find(item => item.type === 'asset' && item.fileName.startsWith('_astro/_index-inline.'));
    assert.ok(asset && asset.type === 'asset');
    assert.equal(asset.source, (await transform(source, { minify: true, loader: 'js' })).code);
    const unrelated = result.output.find(item => item.type === 'asset' && item.fileName.startsWith('_astro/_map-inline'));
    assert.ok(unrelated && unrelated.type === 'asset');
    assert.equal(Buffer.from(unrelated.source).toString(), readFileSync(mapPath, 'utf8'));
    const chunk = result.output.find(item => item.type === 'chunk' && item.isEntry);
    assert.ok(chunk && chunk.type === 'chunk');
    assert.ok(chunk.code.includes('/nested/' + asset.fileName));
    assert.ok(chunk.code.includes('/nested/' + unrelated.fileName));
    assert.ok(!chunk.code.includes('__VITE_ASSET__'));
    const manifest = result.output.find(item => item.type === 'asset' && item.fileName === '.vite/manifest.json');
    assert.ok(manifest && manifest.type === 'asset');
    const records = Object.values(JSON.parse(String(manifest.source))) as Array<{ assets?: string[] }>;
    assert.ok(records.some(record => record.assets?.includes(asset.fileName)), 'Astro must see the home script in the SSR manifest');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('minified home bytes remain a classic script with accessible top-level declarations', async () => {
  const { assets } = await loadAsset();
  const context = createContext({
    document: { getElementById: () => null }, console: { error() {} },
  });
  // The deliberately absent canvas stops initialization after the declarations.
  assert.throws(() => runInContext(assets[0].source, context), /#treemap canvas missing/);
  assert.equal(runInContext('lang', context), 'ja');
  assert.equal(runInContext('fmtRisk(8.366666666666667)', context), '8.4');
});

test('built HTML references exactly one existing home script hashed from its final bytes', async () => {
  const dist = join(process.cwd(), 'dist-astro');
  const home = join(dist, 'index.html');
  const html = requireBuiltArtifact(existsSync(home) ? readFileSync(home, 'utf8') : null, 'dist-astro/index.html');
  if (html === null) return;
  const tags = (html.match(/<script\b[^>]*>/g) ?? []).filter(tag => tag.includes('/_astro/_index-inline.'));
  assert.equal(tags.length, 1);
  assert.match(tags[0], /\bdefer\b/);
  assert.doesNotMatch(tags[0], /type="module"/);
  const url = tags[0].match(/src="([^"]+)"/)?.[1];
  assert.ok(url);
  assert.match(url, /^\/_astro\/_index-inline\.[a-f0-9]{64}\.js$/);
  const bytes = readFileSync(join(dist, url), 'utf8');
  assert.equal(url, `/_astro/_index-inline.${sha(bytes)}.js`);
  assert.equal(bytes, (await transform(source, { minify: true, loader: 'js' })).code);
  assert.deepEqual(readdirSync(join(dist, '_astro')).filter(file => file.startsWith('_index-inline.')), [url.split('/').at(-1)!]);
});
