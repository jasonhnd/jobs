import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { escapeJsonForScript, stringifyJsonLd } from './json-for-script.js';

test('stringifyJsonLd escapes every < so </script> cannot close the block (#884)', () => {
  const out = stringifyJsonLd({ name: 'a</script><script>alert(1)</script>', note: '<!--' });
  assert.doesNotMatch(out, /</);
  assert.deepEqual(JSON.parse(out), { name: 'a</script><script>alert(1)</script>', note: '<!--' });
});

test('stringifyJsonLd keeps the pretty-print spacing it is given', () => {
  assert.equal(stringifyJsonLd({ a: 1 }, 2), '{\n  "a": 1\n}');
  assert.equal(stringifyJsonLd({ a: 1 }), '{"a":1}');
});

test('escapeJsonForScript also escapes U+2028 / U+2029 and stays parseable', () => {
  const raw = JSON.stringify({ s: 'x\u2028y\u2029z<' });
  const out = escapeJsonForScript(raw);
  assert.doesNotMatch(out, /[\u2028\u2029<]/);
  assert.deepEqual(JSON.parse(out), { s: 'x\u2028y\u2029z<' });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|astro)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

test('no JSON-LD producer uses a bare JSON.stringify (#884)', () => {
  const offenders: string[] = [];
  for (const file of walk('src')) {
    const src = readFileSync(file, 'utf8');
    // A JSON-LD object literal passed straight to JSON.stringify.
    if (/JSON\.stringify\(\s*\{\s*['"]@context['"]/.test(src)) offenders.push(file);
    if (/JSON\.stringify\(\s*\n?\s*\{\s*\n\s*['"]@context['"]/.test(src)) offenders.push(file);
  }
  assert.deepEqual([...new Set(offenders)], []);
});

test('no local `</`-only script escaper remains; in-script JSON uses escapeJsonForScript (#884 review)', () => {
  const offenders: string[] = [];
  for (const file of walk('src')) {
    const src = readFileSync(file, 'utf8');
    // `</` → `<\/` leaves `<!--` and every other `<` raw.
    if (/\.replace\(\/<\\\//.test(src)) offenders.push(file);
    if (/function safeJsonForScript\(/.test(src)) offenders.push(file);
  }
  assert.deepEqual([...new Set(offenders)], []);
});
