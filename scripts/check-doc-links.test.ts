import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';

interface CheckResult {
  readonly problems: readonly string[];
  readonly localTargetCount: number;
}

interface DocLinkChecker {
  checkDocuments(documents: ReadonlyMap<string, string>, trackedPaths: readonly string[]): CheckResult;
  extractMarkdownTargets(markdown: string): ReadonlyArray<{ target: string; line: number; column: number }>;
}

const require = createRequire(import.meta.url);
const checker = require('./check-doc-links.cjs') as DocLinkChecker;

describe('Markdown local-link checker', () => {
  test('accepts tracked files, tracked directories, references, images, and HTML assets', () => {
    const documents = new Map([
      ['README.md', [
        '[Guide](docs/guide.md#usage)',
        '[Docs directory](docs/)',
        '![Card](assets/card.png)',
        '<img src="assets/card.png" alt="card">',
        '[License][license]',
        '[license]: LICENSE',
        '[External](https://example.com/missing.md)',
        '[Site route](/standard)',
        '[Anchor](#usage)',
        '`[Inline code](missing.md)`',
        '```md',
        '[Fenced code](also-missing.md)',
        '```',
      ].join('\n')],
    ]);
    const tracked = ['README.md', 'docs/guide.md', 'assets/card.png', 'LICENSE'];

    const result = checker.checkDocuments(documents, tracked);

    assert.deepEqual(result.problems, []);
    assert.equal(result.localTargetCount, 5);
  });

  test('resolves encoded paths and query strings against the source document', () => {
    const documents = new Map([
      ['docs/index.md', '[Guide](guides/My%20Guide.md?view=full#intro)'],
    ]);

    const result = checker.checkDocuments(documents, ['docs/index.md', 'docs/guides/My Guide.md']);

    assert.deepEqual(result.problems, []);
    assert.equal(result.localTargetCount, 1);
  });

  test('reports missing targets and repository traversal so the gate fails', () => {
    const documents = new Map([
      ['docs/index.md', [
        '[Missing](missing.md)',
        '![Missing image](../assets/missing.png)',
        '[Outside](../../private.md)',
      ].join('\n')],
    ]);

    const result = checker.checkDocuments(documents, ['docs/index.md']);

    assert.equal(result.problems.length, 3);
    assert.match(result.problems[0]!, /missing tracked local target.*docs\/missing\.md/);
    assert.match(result.problems[1]!, /missing tracked local target.*assets\/missing\.png/);
    assert.match(result.problems[2]!, /target escapes the repository/);
  });

  test('extracts reference definitions without treating code fences as links', () => {
    const targets = checker.extractMarkdownTargets([
      '[doc]: ./guide.md "Guide"',
      '~~~md',
      '[ignored]: ./missing.md',
      '~~~',
    ].join('\n'));

    assert.deepEqual(targets.map((target) => target.target), ['./guide.md']);
    assert.equal(targets[0]!.line, 1);
  });

  test('checks repository-root links (GitHub resolves /docs/x.md against the repo root)', () => {
    const documents = new Map([
      ['docs/index.md', [
        '[Root doc](/docs/guide.md)',
        '[Root file](/README.md#top)',
        '[Missing root doc](/docs/missing.md)',
        '<a href="/scripts/gone.cjs">gone</a>',
        '[Site route](/standard)',
        '[Site data](/data.treemap.json)',
      ].join('\n')],
    ]);

    const result = checker.checkDocuments(documents, ['README.md', 'docs/index.md', 'docs/guide.md', 'scripts/x.cjs']);

    assert.equal(result.localTargetCount, 4);
    assert.equal(result.problems.length, 2);
    assert.match(result.problems[0]!, /docs\/index\.md:3:.*missing tracked local target.*resolved to docs\/missing\.md/);
    assert.match(result.problems[1]!, /docs\/index\.md:4:.*resolved to scripts\/gone\.cjs/);
  });

  test('fails on an unclosed code fence instead of skipping the rest of the file', () => {
    const documents = new Map([
      ['README.md', ['# Title', '```sh', 'echo hi', '[Missing](missing.md)'].join('\n')],
    ]);

    const result = checker.checkDocuments(documents, ['README.md']);

    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0]!, /README\.md:2:.*unclosed code fence/);
  });

  test('a fence line with an info string does not close the open fence', () => {
    const targets = checker.extractMarkdownTargets([
      '````md',
      '```md',
      '[inside](inside.md)',
      '```',
      '````',
      '[after](after.md)',
    ].join('\n'));

    assert.deepEqual(targets.map((target) => target.target), ['after.md']);
  });

  test('a closing fence must not carry an info string', () => {
    const targets = checker.extractMarkdownTargets([
      '```',
      '```js',
      '[inside](inside.md)',
      '```',
      '[after](after.md)',
    ].join('\n'));

    assert.deepEqual(targets.map((target) => target.target), ['after.md']);
  });
});
