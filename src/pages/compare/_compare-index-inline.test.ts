import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/compare/index.astro', 'utf8');

function extractFn(name: string): string {
  const start = page.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} not found`);
  const end = page.indexOf('\n      }\n', start) + '\n      }'.length;
  return page.slice(start, end);
}

test('compare escapeHtml escapes quotes, so it is safe inside attributes (#884)', () => {
  const escapeHtml = new Function(`${extractFn('escapeHtml')}; return escapeHtml;`)() as (s: unknown) => string;
  assert.equal(escapeHtml('a"b\'c<d>&'), 'a&quot;b&#39;c&lt;d&gt;&amp;');
  assert.equal(escapeHtml(null), '');
});

test('compare occupationPath only builds same-origin paths from numeric ids (#884)', () => {
  const occupationPath = new Function(`${extractFn('occupationPath')}; return occupationPath;`)() as (id: unknown) => string | null;
  assert.equal(occupationPath('12'), '/12');
  assert.equal(occupationPath(404), '/occupations/404');
  assert.equal(occupationPath('/evil.com'), null);
  assert.equal(occupationPath('12abc'), null);
  assert.equal(occupationPath(''), null);
});

test('compare: a non-preset pair stays on the page with a notice, B is not dropped (#884)', () => {
  const submit = page.slice(page.indexOf("form.addEventListener('submit'"), page.indexOf("fetch('/data.sectors.json')"));
  assert.doesNotMatch(submit, /location\.href = occupationPath\(aId\)/);
  assert.match(submit, /showNoPairNotice\(/);
  assert.match(page, /この組み合わせの比較ページはまだありません。/);
  assert.match(page, /id="ccNotice"/);
});

test('compare pair map goes through the shared JSON-for-script escaper (#884)', () => {
  assert.match(page, /escapeJsonForScript\(JSON\.stringify\(Object\.fromEntries\(pairMapEntries\)\)\)/);
});

test('compare recent chips accept only numeric ids (#884)', () => {
  assert.match(page, /\/\^\\d\{1,4\}\$\/\.test/);
});
