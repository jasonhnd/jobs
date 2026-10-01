/**
 * inline-links.test.ts — security-adjacent contract. The function
 * builds <a> tags from occupation/hub names embedded in prose; the
 * escape-first-then-anchor-injection ordering is load-bearing
 * because the upstream prose can contain HTML metacharacters
 * (operator-injected commentary, future user-derived data, etc).
 *
 * Tests pin the XSS-defense properties + the editorial rules
 * (longest-match, once-per-text).
 *
 * Registry construction uses small graph fixtures without file I/O;
 * text-linking tests also use synthetic registries for focused cases.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildLinkRegistry,
  _clearRegistryCache,
  inlineLinkText,
  type LinkRegistry,
  type LinkTarget,
} from './inline-links.js';
import type { KnowledgeGraph, OccupationNode } from '@/graph';

function makeGraph(rows: Array<[string, string, string[]]>): KnowledgeGraph {
  const occupations = new Map(rows.map(([id, titleJa, aliasesJa]) => [
    id, { titleJa, aliasesJa } satisfies Pick<OccupationNode, 'titleJa' | 'aliasesJa'>,
  ]));
  // The registry only consumes titles and aliases, not graph edges or other node fields.
  return { occupations } as unknown as KnowledgeGraph;
}

describe('buildLinkRegistry', () => {
  test('enumerates names and valid aliases with stable longest-first ordering and canonical URLs', () => {
    const registry = buildLinkRegistry(makeGraph([
      ['404', 'Beta', ['', 'Beta', 'B']],
      ['156', 'Alpha', ['A']],
      ['2', '', ['ignored']],
    ]));
    assert.deepEqual(registry.patterns, [
      { pattern: 'Alpha', target: { href: '/156', name: 'Alpha', kind: 'occupation' } },
      { pattern: 'Beta', target: { href: '/occupations/404', name: 'Beta', kind: 'occupation' } },
      { pattern: 'A', target: { href: '/156', name: 'Alpha', kind: 'occupation', aliases: ['A'] } },
      { pattern: 'B', target: { href: '/occupations/404', name: 'Beta', kind: 'occupation', aliases: ['B'] } },
    ]);
    assert.equal(inlineLinkText('Alpha + B', registry),
      '<a class="inline-link" href="/156" data-link-kind="occupation">Alpha</a> + ' +
      '<a class="inline-link" href="/occupations/404" data-link-kind="occupation">B</a>');
  });

  test('caches by graph identity and invalidates only the specified graph', () => {
    const first = makeGraph([['1', 'First', []]]);
    const second = makeGraph([['2', 'Second', []]]);
    const firstRegistry = buildLinkRegistry(first);
    const secondRegistry = buildLinkRegistry(second);
    assert.strictEqual(buildLinkRegistry(first), firstRegistry);
    assert.notStrictEqual(firstRegistry, secondRegistry);
    _clearRegistryCache(first);
    const rebuilt = buildLinkRegistry(first);
    assert.notStrictEqual(rebuilt, firstRegistry);
    assert.deepEqual(rebuilt, firstRegistry);
    assert.strictEqual(buildLinkRegistry(second), secondRegistry);
    _clearRegistryCache();
    assert.strictEqual(buildLinkRegistry(first), rebuilt);
    assert.deepEqual(buildLinkRegistry(makeGraph([])), { patterns: [] });
  });
});

/** Build a synthetic registry from `[pattern, href]` pairs.
 *  Patterns are sorted by length DESC to match production ordering. */
function makeRegistry(entries: Array<{ pattern: string; href: string }>): LinkRegistry {
  const patterns = entries
    .slice()
    .sort((a, b) => b.pattern.length - a.pattern.length)
    .map(({ pattern, href }) => ({
      pattern,
      target: { href, name: pattern, kind: 'occupation' as const } satisfies LinkTarget,
    }));
  return { patterns };
}

describe('inlineLinkText — escape-first XSS defense', () => {
  test('plain text without matches still gets HTML-escaped', () => {
    const registry = makeRegistry([]);
    const html = inlineLinkText('<script>alert(1)</script>', registry);
    assert.ok(!html.includes('<script>'), 'raw <script> leaked through');
    assert.match(html, /&lt;script&gt;/);
  });

  test('text containing < > & gets escaped', () => {
    const registry = makeRegistry([]);
    const html = inlineLinkText('A & B < C > D', registry);
    assert.ok(!html.includes(' & '), 'unescaped &');
    assert.match(html, /&amp;/);
    assert.match(html, /&lt;/);
    assert.match(html, /&gt;/);
  });

  test('matched occupation gets wrapped in <a> with the target href', () => {
    const registry = makeRegistry([{ pattern: '看護師', href: '/156' }]);
    const html = inlineLinkText('看護師について', registry);
    assert.match(html, /<a [^>]*href="\/156"[^>]*>看護師<\/a>/);
  });
});

describe('inlineLinkText — editorial rules', () => {
  test('once-per-block: second occurrence of same name stays plain text', () => {
    const registry = makeRegistry([{ pattern: '看護師', href: '/156' }]);
    const html = inlineLinkText('看護師は重要。もう一度看護師と書いた。', registry);
    const matches = html.match(/<a [^>]*>/g) ?? [];
    assert.equal(matches.length, 1, `expected 1 <a>, got ${matches.length}: ${html}`);
  });

  test('longest-match wins when patterns overlap', () => {
    const registry = makeRegistry([
      { pattern: '看護', href: '/short' },
      { pattern: '看護師', href: '/long' },
    ]);
    const html = inlineLinkText('看護師について', registry);
    assert.match(html, /href="\/long"/, 'longest match did not win');
    assert.ok(!html.includes('/short'), 'shorter match leaked');
  });

  test('empty registry leaves text unchanged (only escape applied)', () => {
    const registry = makeRegistry([]);
    const html = inlineLinkText('一般的なテキスト', registry);
    assert.equal(html, '一般的なテキスト');
  });

  test('empty input → empty output', () => {
    const registry = makeRegistry([{ pattern: '看護師', href: '/156' }]);
    const html = inlineLinkText('', registry);
    assert.equal(html, '');
  });
});

describe('inlineLinkText — defensive null / whitespace handling', () => {
  test('whitespace-only text → whitespace-only escaped output', () => {
    const registry = makeRegistry([]);
    const html = inlineLinkText('   ', registry);
    assert.equal(html.trim(), '');
  });
});

describe('inlineLinkText — options and match placement', () => {
  test('excludes occupation ids including 404 while leaving non-occupation targets eligible', () => {
    const registry: LinkRegistry = { patterns: [
      { pattern: 'Alpha', target: { href: '/156', name: 'Alpha', kind: 'occupation' } },
      { pattern: 'Beta', target: { href: '/occupations/404', name: 'Beta', kind: 'occupation' } },
      { pattern: 'Hub', target: { href: '/sectors/156', name: 'Hub', kind: 'sector' } },
    ] };
    assert.equal(inlineLinkText('Alpha Beta Hub', registry, { excludeIds: new Set([156, 404]) }),
      'Alpha Beta <a class="inline-link" href="/sectors/156" data-link-kind="sector">Hub</a>');
  });

  test('honors zero, custom, and default link caps', () => {
    const registry = makeRegistry(Array.from({ length: 8 }, (_, i) => ({ pattern: `Job${i}`, href: `/${i}` })));
    const text = registry.patterns.map((p) => p.pattern).join(' & ');
    assert.equal(inlineLinkText(text, registry, { maxLinks: 0 }), text.replaceAll('&', '&amp;'));
    const capped = inlineLinkText(text, registry, { maxLinks: 2 });
    assert.equal((capped.match(/<a /g) ?? []).length, 2);
    assert.ok(capped.endsWith('Job2 &amp; Job3 &amp; Job4 &amp; Job5 &amp; Job6 &amp; Job7'));
    assert.equal((inlineLinkText(text, registry).match(/<a /g) ?? []).length, 6);
  });

  test('deduplicates aliases by target href unless oncePerTarget is disabled', () => {
    const registry = buildLinkRegistry(makeGraph([['1', 'Alpha', ['Beta']]]));
    assert.equal(inlineLinkText('Alpha Beta', registry),
      '<a class="inline-link" href="/1" data-link-kind="occupation">Alpha</a> Beta');
    assert.equal(inlineLinkText('Alpha Beta', registry, { oncePerTarget: false }),
      '<a class="inline-link" href="/1" data-link-kind="occupation">Alpha</a> ' +
      '<a class="inline-link" href="/1" data-link-kind="occupation">Beta</a>');
  });

  test('skips claimed overlaps and links a later independent occurrence in text order', () => {
    const registry = makeRegistry([
      { pattern: 'LongName', href: '/1' },
      { pattern: 'Name', href: '/2' },
      { pattern: 'missing', href: '/3' },
    ]);
    assert.equal(inlineLinkText('Name & LongName Name', registry),
      '<a class="inline-link" href="/2" data-link-kind="occupation">Name</a> &amp; ' +
      '<a class="inline-link" href="/1" data-link-kind="occupation">LongName</a> Name');
    assert.equal(inlineLinkText('LongName + Name', registry),
      '<a class="inline-link" href="/1" data-link-kind="occupation">LongName</a> + ' +
      '<a class="inline-link" href="/2" data-link-kind="occupation">Name</a>');
  });

  test('escapes matched text, href, surrounding text, and supports a custom class', () => {
    const registry = makeRegistry([{ pattern: `<tag>&"'`, href: `/1?a="x"&b='<y>'` }]);
    assert.equal(inlineLinkText(`before < <tag>&"' > after`, registry, { linkClass: 'custom-link' }),
      'before &lt; <a class="custom-link" href="/1?a=&quot;x&quot;&amp;b=&#x27;&lt;y&gt;&#x27;" ' +
      'data-link-kind="occupation">&lt;tag&gt;&amp;&quot;&#x27;</a> &gt; after');
  });
});
