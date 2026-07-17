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
});
