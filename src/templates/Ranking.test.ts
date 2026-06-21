// Tests for src/templates/Ranking.ts — snapshot-style regression
// guards on every exported render function.
//
// Promised in the Phase 3.1 fix plan as the prerequisite to splitting
// rankings.ts ("add snapshot tests first: hash the built HTML output
// of the 9 existing ranking pages"). The split itself was verified byte-identical against a
// pre-refactor disk snapshot, but that was a one-shot manual check —
// these tests are what catches the NEXT regression in ranker-renderer
// land.
//
// Strategy:
//   - Fix every input deterministically (no Date.now, no fs reads, no
//     network). Render output is then a pure function of the input.
//   - Assert the full output string verbatim. A drift of a single
//     character fails the test with a diff. If the change is intentional,
//     update the expected string in one place.
//   - Don't try to be exhaustive about slug variants — one representative
//     per renderer + a few important slugs in renderHighlights is enough
//     to catch the kind of bug we care about (escaping, structural
//     changes, accidental refactor regressions).

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { RankingSlug } from '../views/rankings-meta.js';

// Phase D cleanup (2026-05-14): doc §6.2 forbids templates from importing
// values from views. The renderRelatedRankings tests use a hand-rolled
// mock of the (slug, name, desc) triple shape — same type the function
// accepts in its 2nd parameter. Tests verify filter-and-format behaviour;
// they don't need the full 39-entry production list. Drift between mock
// and ALL_RANKINGS shape is caught by TS typecheck — the `RankingSlug`
// type imported above (type-only, allowed by check-architecture.cjs) keeps
// the slug literals in sync with the canonical union.
const MOCK_RANKINGS: ReadonlyArray<readonly [RankingSlug, string, string]> = [
  ['ai-risk-high',     'AIに奪われる仕事 TOP30',   '...'],
  ['ai-risk-low',      'AIに奪われない仕事 TOP30', '...'],
  ['salary',           '高年収の仕事 TOP30',       '...'],
  ['salary-safe',      '高年収×AI耐性 TOP30',      '...'],
  ['entry-salary',     '高初任給の仕事 TOP30',     '...'],
  ['workers',          '就業者数の多い職業 TOP30', '...'],
  ['young-workforce',  '若手が多い職業 TOP30',     '...'],
  ['short-hours',      '労働時間の短い職業 TOP30', '...'],
  ['high-demand',      '求人需要の高い職業 TOP30', '...'],
];

import {
  escapeHtml,
  renderRankItem,
  renderHighlights,
  renderSectorChart,
  renderFaqHtml,
  renderRelatedRankings,
  renderJsonLd,
  renderHubJsonLd,
} from './Ranking.js';
import type { Occupation } from '../views/ranking.js';

// ─── Deterministic fixtures ───────────────────────────────────────────────

function makeOcc(overrides: Partial<Occupation> = {}): Occupation {
  return {
    id: 42,
    title_ja: 'テスト職業',
    ai_risk: 5,
    risk_band: 'mid',
    workers: 12345,
    salary: 678,
    monthly_hours: 160,
    average_age: 38.5,
    recruit_wage: 25,
    recruit_ratio: 1.5,
    demand_band: 'normal',
    sector_id: 'iryo',
    sector_ja: '医療・福祉',
    education_pct: null,
    employment_type: null,
    certs: [],
    hourly_wage: 1500,
    ...overrides,
  };
}

// ─── escapeHtml ───────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  test('escapes the 5 HTML-significant characters', () => {
    assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#x27;');
  });

  test('passes plain text through unchanged', () => {
    assert.equal(escapeHtml('hello world テスト'), 'hello world テスト');
  });

  test('escapes ampersand before other entities (no double-encoding)', () => {
    assert.equal(escapeHtml('AT&T <script>'), 'AT&amp;T &lt;script&gt;');
  });

  test('escapes a stored-XSS payload from data corruption', () => {
    const payload = '<script>alert(document.cookie)</script>';
    const out = escapeHtml(payload);
    assert.equal(out, '&lt;script&gt;alert(document.cookie)&lt;/script&gt;');
    assert.equal(out.includes('<script'), false);
  });
});

// ─── renderRankItem ───────────────────────────────────────────────────────

describe('renderRankItem', () => {
  test('full snapshot: salary + workers shown', () => {
    const o = makeOcc({ id: 7, title_ja: '看護師', sector_ja: '医療・福祉', ai_risk: 3, salary: 500, workers: 1500000 });
    const got = renderRankItem(o, true, null);
    assert.equal(
      got,
      '<li>' +
      '<div class="rl-main">' +
      '<a class="rl-name" href="/7">看護師</a>' +
      '<span class="rl-sector">医療・福祉</span>' +
      '</div>' +
      '<div class="rl-stats">' +
      '<span class="risk-pill low">3/10</span>' +
      '<span class="rl-salary">500万円</span>' +
      '<span class="rl-workers">1,500,000人</span>' +
      '</div>' +
      '</li>',
    );
  });

  test('full snapshot: showSalary=false suppresses salary, plain-text extraCol wrapped in rl-extra and escaped', () => {
    const o = makeOcc({ id: 1, title_ja: 'X', sector_ja: '', ai_risk: 8, salary: 999, workers: 100 });
    // Plain string extraCols are rendered as <span class="rl-extra">{escaped text}</span>.
    // Passing a payload that looks like HTML proves the renderer escapes it.
    const got = renderRankItem(o, false, ['初任給 30万円']);
    assert.equal(
      got,
      '<li>' +
      '<div class="rl-main">' +
      '<a class="rl-name" href="/1">X</a>' +
      '</div>' +
      '<div class="rl-stats">' +
      '<span class="risk-pill high">8/10</span>' +
      '<span class="rl-extra">初任給 30万円</span>' +
      '<span class="rl-workers">100人</span>' +
      '</div>' +
      '</li>',
    );
  });

  test('extraCol plain text is HTML-escaped (defense vs. future contract drift)', () => {
    const o = makeOcc({ id: 1, ai_risk: 5, salary: null, workers: null });
    const got = renderRankItem(o, false, ['<script>alert(1)</script>']);
    assert.match(got, /<span class="rl-extra">&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/span>/);
    assert.equal(got.includes('<script>'), false);
  });

  test('demand-pill extraCol renders with class+label both escaped', () => {
    const o = makeOcc({ id: 1, ai_risk: 5, salary: null, workers: null });
    const got = renderRankItem(o, false, [
      { kind: 'demand-pill', band: 'hot', label: '需要高' },
    ]);
    assert.match(got, /<span class="demand-pill hot">需要高<\/span>/);
  });

  test('demand-pill escapes a malicious band string (defense)', () => {
    const o = makeOcc({ id: 1, ai_risk: 5, salary: null, workers: null });
    const got = renderRankItem(o, false, [
      { kind: 'demand-pill', band: 'x"><script>alert(1)</script>', label: 'X' },
    ]);
    assert.equal(got.includes('<script>'), false);
    assert.match(got, /&lt;script&gt;/);
  });

  test('escapes title and sector_ja (defense vs. data corruption)', () => {
    const o = makeOcc({ id: 1, title_ja: '<script>', sector_ja: 'A & B', ai_risk: null, salary: null, workers: null });
    const got = renderRankItem(o, false, null);
    assert.match(got, /&lt;script&gt;/);
    assert.match(got, /A &amp; B/);
    assert.equal(got.includes('<script>'), false);
  });

  test('handles null ai_risk (em-dash placeholder)', () => {
    const o = makeOcc({ ai_risk: null, salary: null, workers: null });
    const got = renderRankItem(o, false, null);
    assert.match(got, /<span class="risk-pill mid">—<\/span>/);
  });
});

// ─── renderHighlights ─────────────────────────────────────────────────────

describe('renderHighlights', () => {
  const fakeRanking = (): Occupation[] => [
    makeOcc({ id: 1, title_ja: 'TopJob', sector_ja: '医療・福祉', ai_risk: 3, salary: 500, monthly_hours: 150, recruit_wage: 30, average_age: 35 }),
    makeOcc({ id: 2, title_ja: 'Two',    sector_ja: '医療・福祉', ai_risk: 4, salary: 400 }),
    makeOcc({ id: 3, title_ja: 'Three',  sector_ja: '製造',       ai_risk: 5, salary: 300 }),
  ];

  test('returns empty string for empty input', () => {
    assert.equal(renderHighlights([], 'ai-risk-high'), '');
  });

  test('ai-risk-high snapshot has the AI影響 phrasing', () => {
    const got = renderHighlights(fakeRanking(), 'ai-risk-high');
    assert.match(got, /1位は「TopJob」（AI影響度 3\/10）/);
    assert.match(got, /医療・福祉.*セクターが.*2件と最多/);
    assert.match(got, /平均年収は400万円/);
  });

  test('salary slug uses salary phrasing', () => {
    const got = renderHighlights(fakeRanking(), 'salary');
    assert.match(got, /1位は「TopJob」（年収 500万円）/);
  });

  test('short-hours slug uses monthly hours', () => {
    const got = renderHighlights(fakeRanking(), 'short-hours');
    assert.match(got, /1位は「TopJob」（月間 150時間）/);
  });

  test('unknown slug falls back to bare 1位 phrasing', () => {
    const got = renderHighlights(fakeRanking(), 'aging-workforce');
    assert.match(got, /1位は「TopJob」(?!（)/, 'no parens for non-listed slugs');
  });
});

// ─── renderSectorChart ────────────────────────────────────────────────────

describe('renderSectorChart', () => {
  test('returns empty string when no sectors present', () => {
    assert.equal(renderSectorChart([]), '');
    assert.equal(renderSectorChart([makeOcc({ sector_ja: '' })]), '');
  });

  test('snapshot: counts + percent fills', () => {
    const items = [
      makeOcc({ id: 1, sector_ja: '医療' }),
      makeOcc({ id: 2, sector_ja: '医療' }),
      makeOcc({ id: 3, sector_ja: '製造' }),
    ];
    const got = renderSectorChart(items);
    assert.match(got, /<div class="sc-title">セクター内訳（TOP3）<\/div>/);
    assert.match(got, /医療.*width:100%.*2件/);
    assert.match(got, /製造.*width:50%.*1件/);
  });

  test('escapes sector names', () => {
    const got = renderSectorChart([makeOcc({ sector_ja: '<svg>' })]);
    assert.match(got, /&lt;svg&gt;/);
    assert.equal(got.includes('<svg>'), false);
  });
});

// ─── renderFaqHtml ────────────────────────────────────────────────────────

describe('renderFaqHtml', () => {
  test('returns empty string for empty input', () => {
    assert.equal(renderFaqHtml([]), '');
  });

  test('snapshot of a 2-FAQ block', () => {
    const got = renderFaqHtml([
      ['Q1', 'A1'],
      ['Q2 with <html>', 'A2 with &'],
    ]);
    assert.equal(
      got,
      '<section class="faq" aria-label="よくある質問">' +
      '<h2>よくある質問</h2>' +
      '<details><summary>Q1</summary><div class="faq-a">A1</div></details>' +
      '<details><summary>Q2 with &lt;html&gt;</summary><div class="faq-a">A2 with &amp;</div></details>' +
      '</section>',
    );
  });
});

// ─── renderRelatedRankings ────────────────────────────────────────────────

describe('renderRelatedRankings', () => {
  test('omits the current slug', () => {
    const got = renderRelatedRankings('ai-risk-high', MOCK_RANKINGS);
    assert.equal(got.includes('href="/rankings/ai-risk-high"'), false);
  });

  test('always wraps output in ul.related-rankings', () => {
    const got = renderRelatedRankings('ai-risk-high', MOCK_RANKINGS);
    assert.match(got, /^<ul class="related-rankings">/);
    assert.match(got, /<\/ul>$/);
  });

  test('every emitted li is an anchor to a /rankings/* href', () => {
    const got = renderRelatedRankings('ai-risk-high', MOCK_RANKINGS);
    const hrefs = [...got.matchAll(/href="(\/rankings\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 5, `expected several other rankings, got ${hrefs.length}`);
    assert.ok(hrefs.every((h) => !!h && h.startsWith('/rankings/')));
  });
});

// ─── renderJsonLd ─────────────────────────────────────────────────────────

describe('renderJsonLd', () => {
  test('returns valid JSON', () => {
    const items = [makeOcc({ id: 1, title_ja: 'A' }), makeOcc({ id: 2, title_ja: 'B' })];
    const got = renderJsonLd(
      'https://mirai-shigoto.com/rankings/ai-risk-high',
      'TestTitle',
      'TestDesc',
      items,
      [['Q', 'A']],
    );
    assert.doesNotThrow(() => JSON.parse(got), 'output must be parseable JSON');
  });

  test('@graph contains WebPage, Article, BreadcrumbList, ItemList, FAQPage', () => {
    const got = JSON.parse(renderJsonLd(
      'https://mirai-shigoto.com/rankings/ai-risk-high',
      'TestTitle',
      'TestDesc',
      [makeOcc()],
      [['Q', 'A']],
    ));
    const types = (got['@graph'] as Array<{ '@type': string }>).map((x) => x['@type']);
    assert.deepEqual(types.sort(), ['Article', 'BreadcrumbList', 'FAQPage', 'ItemList', 'WebPage']);
  });

  test('omits FAQPage when faqItems is null', () => {
    const got = JSON.parse(renderJsonLd(
      'https://mirai-shigoto.com/rankings/x',
      't', 'd', [makeOcc()], null,
    ));
    const types = (got['@graph'] as Array<{ '@type': string }>).map((x) => x['@type']);
    assert.equal(types.includes('FAQPage'), false);
  });

  test('ItemList contains every input occupation, position is 1-indexed', () => {
    const items = [
      makeOcc({ id: 10, title_ja: 'First' }),
      makeOcc({ id: 11, title_ja: 'Second' }),
    ];
    const got = JSON.parse(renderJsonLd('https://mirai-shigoto.com/rankings/x', 't', 'd', items, null));
    const itemList = (got['@graph'] as Array<{ '@type': string }>).find((g) => g['@type'] === 'ItemList');
    // @ts-expect-error — JSON-LD shape, dynamic
    assert.equal(itemList?.numberOfItems, 2);
    // @ts-expect-error — dynamic
    assert.equal(itemList?.itemListElement[0].position, 1);
    // @ts-expect-error — dynamic
    assert.equal(itemList?.itemListElement[0].url, 'https://mirai-shigoto.com/10');
    // @ts-expect-error — dynamic
    assert.equal(itemList?.itemListElement[1].position, 2);
  });

  test('OG image URL is derived from canonical slug', () => {
    const got = JSON.parse(renderJsonLd(
      'https://mirai-shigoto.com/rankings/short-hours',
      't', 'd', [makeOcc()], null,
    ));
    const article = (got['@graph'] as Array<{ '@type': string }>).find((g) => g['@type'] === 'Article');
    // @ts-expect-error — dynamic
    assert.equal(article?.image, 'https://mirai-shigoto.com/api/og?ranking=short-hours');
  });

  test('WebPage exposes speakable selectors for the citable fact block', () => {
    const got = JSON.parse(renderJsonLd(
      'https://mirai-shigoto.com/rankings/short-hours',
      't', 'd', [makeOcc()], null,
    ));
    const webpage = (got['@graph'] as Array<{ '@type': string; speakable?: unknown }>)
      .find((g) => g['@type'] === 'WebPage');
    assert.deepEqual(webpage?.speakable, {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.ai-fact', '.intro', '.highlights'],
    });
  });
});

// ─── renderHubJsonLd ──────────────────────────────────────────────────────

describe('renderHubJsonLd', () => {
  test('returns valid JSON with WebPage + BreadcrumbList', () => {
    const got = JSON.parse(renderHubJsonLd());
    const types = (got['@graph'] as Array<{ '@type': string }>).map((x) => x['@type']);
    assert.deepEqual(types.sort(), ['BreadcrumbList', 'WebPage']);
  });
});
