import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';

interface PageClassChecker {
  findViolations(content: string): ReadonlyArray<{ rule: string }>;
}

const require = createRequire(import.meta.url);
const checker = require('./check-page-class.cjs') as PageClassChecker;

const ROOT_RULE = ':root{} token re-declaration';

function rules(content: string): string[] {
  return checker.findViolations(content).map((violation) => violation.rule);
}

describe('check-page-class :root re-declaration', () => {
  const offending: ReadonlyArray<readonly [string, string]> = [
    ['at the start of a line', ':root{--x:1}'],
    ['indented, with a space before the brace', '  :root {\n  --x: 1;\n}'],
    ['first in a selector list', ':root,html{--x:1}'],
    ['later in a selector list', 'html, :root { --x: 1 }'],
    ['after another rule on the same line (minified)', 'body{margin:0}:root{--x:1}'],
    ['inside a template literal', 'export const CSS = `:root{--x:1}`;'],
    ['inside a <style> block on one line', '<style>.a{} :root{--x:1}</style>'],
    ['after a url() on the same line', '.a{background:url(https://x.test/a.png)} :root{--x:1}'],
    ['after a protocol-relative url() on the same line', '.a{background:url(//cdn.example/x)}:root{--x:1}'],
    ['after a quoted protocol-relative url()', ".a{background:url('//cdn.example/x')} :root{--x:1}"],
    ['after a protocol-relative url() with a space before //', '.a{background:url( //cdn.example/x)}:root{--x:1}'],
    ['after a protocol-relative url() with a tab before //', '.a{background:url(\t//cdn.example/x)} :root{--x:1}'],
  ];

  for (const [name, content] of offending) {
    test(`detects :root ${name}`, () => {
      assert.ok(rules(content).includes(ROOT_RULE), content);
    });
  }

  const allowed: ReadonlyArray<readonly [string, string]> = [
    ['a descendant selector under :root', ':root .card{color:var(--ink)}'],
    ['a var() reference', '.a{color:var(--root-x)}'],
    ['the word root without a colon', 'const root = {};'],
    ['a block comment that mentions :root{}', '/**\n * Tokens (`:root{...}`) live in canonical-css.ts.\n */\n.a{}'],
    ['a block comment listing :root in prose', '/* no :root, no global element rules. */\n.page{color:var(--ink)}'],
    ['a line comment that mentions :root{}', '//   - `:root{}` token は canonical-css.ts 経由\n.a{}'],
  ];

  for (const [name, content] of allowed) {
    test(`does not flag ${name}`, () => {
      assert.deepEqual(rules(content), []);
    });
  }

  test('still detects the neutralised [data-theme] override', () => {
    assert.ok(rules(':root[data-theme="dark"]{--x:1}').includes(':root[data-theme] override block'));
  });
});

describe('shared Astro page-class membership', () => {
  test('Pro shells inherit real Detail/Hub class CSS from shared pages', () => {
    const membership = require('./check-page-class.cjs').checkClassMembership;
    assert.equal(typeof membership, 'function');
    assert.deepEqual(membership(['src/pages/pro/[id].astro', 'src/pages/pro/rankings/[slug].astro', 'src/pages/pro/rankings/index.astro', 'src/pages/pro/index.astro']), []);
  });
  test('a wrapper without class CSS cannot pass by hiding BaseLayout behind an import', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const root = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp/JOB_0225', 'page-class-'));
    try {
      fs.mkdirSync(path.join(root, 'src/pages/pro'), { recursive: true });
      fs.writeFileSync(path.join(root, 'src/pages/pro/index.astro'), "---\nimport Page from '../_Page.astro';\n---\n<Page />");
      fs.writeFileSync(path.join(root, 'src/pages/_Page.astro'), '<BaseLayout><p>Body</p></BaseLayout>');
      const membership = require('./check-page-class.cjs').checkClassMembership;
      assert.equal(typeof membership, 'function');
      assert.deepEqual(membership(['src/pages/pro/index.astro'], root), ['src/pages/pro/index.astro']);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
