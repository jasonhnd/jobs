import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const nav = readFileSync('src/components/MobileNav.astro', 'utf8');

test('mobile search retries loading on input after a failed load (#884)', () => {
  assert.doesNotMatch(nav, /input\.addEventListener\('input', function \(\) \{ if \(docs\) render\(\); \}\);/);
  const start = nav.indexOf("input.addEventListener('input', function () {");
  assert.ok(start > 0);
  const body = nav.slice(start, nav.indexOf('});', start));
  assert.match(body, /ensureData\(\)\.then\(render\)\.catch\(render\)/);
});

test('mobile search: a failed sectors file does not disable search (#884)', () => {
  assert.match(nav, /fetchJson\(SECTORS_URL\)\.catch\(function \(\) \{ return null; \}\)/);
});
