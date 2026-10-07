import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseRegion, splitMarkup, walk } from './ast';
import { analyseSource, lineOf } from './emits';

describe('analytics-spec markup split', () => {
  test('frontmatter and script bodies are regions; comments, prose and set:html scripts are not', () => {
    const source = [
      '---', "const a = 'q';", '---',
      "<p>don't</p><script>gtag('event', 'y')</script>",
      "<!-- <script>gtag('event', 'x')</script> -->",
      '{/* gtag z */}',
      '<script is:inline set:html={JS} />',
      '<script type="application/ld+json">{"a": 1}</script>',
    ].join('\n');
    const split = splitMarkup(source, { frontmatter: true });
    assert.deepEqual(split.regions.map((r) => r.code), ["const a = 'q';\n", "gtag('event', 'y')"]);
    assert.equal(source.slice(split.regions[1]!.start, split.regions[1]!.start + 4), 'gtag');
    assert.deepEqual(split.dataBlocks.map((r) => r.code), ['{"a": 1}']);
    assert.equal(split.markup.length, source.length);
    assert.ok(!/gtag/.test(split.markup));
    assert.ok(split.markup.includes("<p>don't</p>"));
  });
});

describe('analytics-spec parser', () => {
  test('a parse error reports its offset in the region', () => {
    const outcome = parseRegion({ start: 0, code: 'const a = 1;\nif (' }, { jsx: false });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(lineOf('const a = 1;\nif (', outcome.offset), 2);
  });

  test('the walk skips type-only TypeScript nodes but enters `as` expressions', () => {
    const outcome = parseRegion({
      start: 0,
      code: 'interface W { gtag: () => void }\nconst f = (window as any).gtag;',
    }, { jsx: false });
    assert.ok(outcome.ok);
    const names: string[] = [];
    if (outcome.ok) {
      walk(outcome.program, ({ node }) => {
        if (node.type === 'Identifier') names.push(node.name);
      });
    }
    assert.deepEqual(names, ['f', 'window', 'gtag']);
  });

  test('regex literals, division and strings never hide or invent calls', () => {
    const text = [
      "if (true) {} /[//]/.test('/'); gtag('event', 'a_event', {k1: 1});",
      "if (true) /'/.test(s); gtag('event', 'b_event');",
      "const r = clicks++ / total; const s = \"gtag('event', 'not_sent')\";",
    ].join('\n');
    const result = analyseSource('src/x.ts', text, undefined);
    assert.deepEqual(result.unreadable, []);
    assert.deepEqual(result.emissions.map((e) => [e.event, e.params]), [['a_event', ['k1']], ['b_event', []]]);
  });
});
