import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  duelDisplayName,
  renderCompareDuelBar,
  renderCompareHero,
  renderCompareTable,
  renderCompactCompareCards,
  renderFeaturedCompareCards,
  renderHubJsonLd,
  renderJsonLd,
  renderRelatedCompares,
  renderTopSkillsCompare,
  type CompareHubCard,
} from './Compare.js';
import type { CompareSide } from '../views/compare-hub.js';
import type { CompareMeta, CompareSlug } from '../views/compare-meta.js';

const meta: CompareMeta = {
  slug: 'kango-vs-helper',
  occ_a_id: 1,
  occ_b_id: 2,
  title_ja: 'A vs B',
  description_ja: 'desc',
  comparison_points_ja: [],
  decision_hints_ja: [],
  og_eyebrow: 'COMPARE',
};

const side = (id: number, name: string): CompareSide => ({
  id,
  name_ja: name,
  ai_risk: 4,
  risk_band: 'mid',
  rationale_ja: null,
  summary_ja: null,
  salary: 500,
  workers: 1000,
  monthly_hours: 160,
  average_age: 40,
  recruit_ratio: 1,
  sector_id: 'iryo',
  sector_ja: '医療',
  related_certs_ja: [],
  top_skills: [],
});

describe('duelDisplayName', () => {
  test('uses the alias after a slash so the bar stays one line', () => {
    assert.equal(duelDisplayName('訪問介護員/ホームヘルパー'), 'ホームヘルパー');
    assert.equal(duelDisplayName('看護師'), '看護師');
  });
});

describe('renderCompareDuelBar', () => {
  test('puts the short alias in the label and the full name in title', () => {
    const html = renderCompareDuelBar(side(156, '看護師'), side(133, '訪問介護員/ホームヘルパー'));
    assert.match(html, />看護師</);
    assert.match(html, />ホームヘルパー</);
    assert.match(html, /title="訪問介護員\/ホームヘルパー"/);
    assert.equal(html.includes('訪問介護員/ホームヘルパー</span>'), false);
  });
});

describe('Compare JSON-LD speakable', () => {
  test('WebPage points to the citable fact block and compare body', () => {
    const got = JSON.parse(renderJsonLd(
      'https://mirai-shigoto.com/pro/compare/kango-vs-helper',
      meta,
      side(1, 'A'),
      side(2, 'B'),
      'desc',
      null,
    ));
    const webpage = (got['@graph'] as Array<{ '@type': string; speakable?: unknown }>)
      .find((node) => node['@type'] === 'WebPage');
    assert.deepEqual(webpage?.speakable, {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.ai-fact', '.intro', '.compare-table'],
    });
  });

  test('adds FAQPage when faq items are present and omits a missing sector', () => {
    const got = JSON.parse(renderJsonLd(
      'https://mirai-shigoto.com/pro/compare/kango-vs-helper',
      meta,
      side(1, 'A & B'),
      { ...side(2, 'B'), sector_ja: null, ai_risk: null },
      'desc',
      [['Q <1>', 'A & 1']],
    ));
    const types = (got['@graph'] as Array<{ '@type': string }>).map((node) => node['@type']);
    assert.equal(types.includes('FAQPage'), true);
    assert.equal(types.includes('Article'), true);
    assert.equal(types.includes('BreadcrumbList'), true);
    const faq = (got['@graph'] as Array<{ '@type': string; mainEntity?: Array<{ name: string }> }>)
      .find((node) => node['@type'] === 'FAQPage');
    assert.equal(faq?.mainEntity?.[0]?.name, 'Q <1>');
  });
});

describe('renderCompareHero', () => {
  test('emits versus structure, risk bands, and a sector only when present', () => {
    const html = renderCompareHero(
      { ...side(1, '<Nurse>'), ai_risk: 2, sector_ja: 'Care & Co' },
      { ...side(404, 'Other'), ai_risk: null, sector_ja: null },
    );
    assert.match(html, /class="versus-hero"/);
    assert.match(html, /class="vh-vs"/);
    assert.equal((html.match(/class="vh-side"/g) ?? []).length, 2);
    assert.match(html, /href="\/1" class="vh-name">/);
    assert.match(html, /href="\/occupations\/404" class="vh-name">/);
    assert.match(html, /&lt;Nurse&gt;/);
    assert.match(html, /class="risk-pill low"/);
    assert.match(html, /class="risk-pill mid"/);
    assert.match(html, /class="vh-sector">Care &amp; Co</);
    assert.equal((html.match(/class="vh-sector"/g) ?? []).length, 1);
    assert.match(html, /—/);
  });
});

describe('renderCompareDuelBar risk bands', () => {
  test('null score uses the mid pill', () => {
    const html = renderCompareDuelBar(
      { ...side(1, 'A'), ai_risk: null },
      { ...side(2, 'B/Alias'), ai_risk: 9 },
    );
    assert.match(html, /class="duel-bar"/);
    assert.match(html, /class="risk-pill mid"/);
    assert.match(html, /class="risk-pill high"/);
    assert.match(html, /class="duel-vs"/);
  });
});

describe('renderCompareTable', () => {
  test('renders a row per input and escapes names and cells', () => {
    const html = renderCompareTable(
      [{ label: 'A <B>', a_val: '1 & 2', b_val: '3', note: '"n"' }],
      'Left "L"',
      'Right',
    );
    assert.match(html, /<table class="compare-table">/);
    assert.match(html, /<th>Left &quot;L&quot;<\/th>/);
    assert.match(html, /<th scope="row">A &lt;B&gt;<\/th>/);
    assert.match(html, /<td>1 &amp; 2<\/td>/);
    assert.match(html, /<td class="ct-note">&quot;n&quot;<\/td>/);
    assert.match(html, /<tbody>/);
  });

  test('empty rows leave an empty tbody', () => {
    const html = renderCompareTable([], 'A', 'B');
    assert.match(html, /<tbody><\/tbody>/);
  });
});

describe('renderTopSkillsCompare', () => {
  test('lists scores to two decimals and an empty marker when a side has no skills', () => {
    const html = renderTopSkillsCompare(
      {
        ...side(1, 'A & B'),
        top_skills: [{ key: 'k', label_ja: '<skill>', score: 1.5 }],
      },
      { ...side(2, 'B'), top_skills: [] },
    );
    assert.match(html, /class="topskills-compare"/);
    assert.equal((html.match(/class="tsc-side"/g) ?? []).length, 2);
    assert.match(html, /<ol class="ts-list">/);
    assert.match(html, /class="ts-name">&lt;skill&gt;</);
    assert.match(html, /class="ts-score">1\.50</);
    assert.match(html, /<p class="ts-empty">—<\/p>/);
    assert.match(html, /A &amp; B/);
  });
});

describe('renderRelatedCompares', () => {
  test('drops the current slug and keeps the next six', () => {
    const slugs: CompareSlug[] = [
      'kango-vs-helper',
      'se-vs-programmer',
      'iryo-jimu-vs-ippan-jimu',
      'biyo-vs-riyo',
      'truck-vs-taxi',
      'denki-vs-haikan',
      'kango-vs-yakuzaishi',
      'shoubou-vs-keisatsu',
    ];
    const all = slugs.map((slug) => ({ ...meta, slug, title_ja: `t-${slug}` }));
    const html = renderRelatedCompares('kango-vs-helper', all);
    assert.match(html, /<ul class="related-compares">/);
    assert.equal((html.match(/<li>/g) ?? []).length, 6);
    assert.equal(html.includes('/pro/compare/kango-vs-helper"'), false);
    assert.equal(html.includes('/pro/compare/shoubou-vs-keisatsu'), false);
    assert.match(html, /href="\/pro\/compare\/se-vs-programmer"/);
    assert.match(html, /class="rc-title">t-se-vs-programmer</);
    assert.match(html, /href="\/pro\/compare\/kango-vs-yakuzaishi"/);
  });
});

describe('compare hub cards', () => {
  const longDesc = `d`.repeat(90);
  const cards: CompareHubCard[] = [
    {
      slug: 'se-vs-programmer',
      title_ja: 'T <1>',
      a_name: 'A & A',
      a_risk: null,
      b_name: 'B',
      b_risk: 3,
      description_ja: longDesc,
    },
    {
      slug: 'biyo-vs-riyo',
      title_ja: 'Short',
      a_name: 'C',
      a_risk: 6,
      b_name: 'D',
      b_risk: 9,
      description_ja: 'ok',
    },
  ];

  test('featured cards stack both sides and truncate a long description', () => {
    const html = renderFeaturedCompareCards(cards);
    assert.equal((html.match(/<li><a href="\/pro\/compare\//g) ?? []).length, 2);
    assert.match(html, /class="cci-title">T &lt;1&gt;</);
    assert.match(html, /class="cci-pair"/);
    assert.match(html, /class="cci-vs-row"/);
    assert.match(html, /class="cci-name">A &amp; A</);
    assert.match(html, /class="risk-pill mid"/);
    assert.match(html, /class="risk-pill low"/);
    assert.match(html, /class="risk-pill high"/);
    assert.match(html, new RegExp(`class="cci-desc">${'d'.repeat(80)}…`));
    assert.match(html, /class="cci-desc">ok</);
    assert.equal(html.includes(`${'d'.repeat(81)}`), false);
  });

  test('hub pills band the displayed value like every other pill (#864)', () => {
    const pills = (a: number | null, b: number | null): string[] => {
      const html = renderFeaturedCompareCards([{ slug: 'x', title_ja: 'x', a_name: 'A', a_risk: a, b_name: 'B', b_risk: b, description_ja: '' }]);
      return [...html.matchAll(/class="risk-pill (\w+)"/g)].map((m) => m[1]!);
    };
    assert.deepEqual(pills(3.5, 6.8), ['low', 'mid']); // 看護師 3.5 / 税理士 6.8
    assert.deepEqual(pills(3.9666666666666663, 6.966666666666667), ['mid', 'high']); // print 4.0 / 7.0
    assert.deepEqual(pills(3.9333333333333336, 6.933333333333334), ['low', 'mid']); // print 3.9 / 6.9
    const compact = renderCompactCompareCards([{ slug: 'x', title_ja: 'x', a_name: 'A', a_risk: 3.5, b_name: 'B', b_risk: 6.8, description_ja: '' }]);
    assert.deepEqual([...compact.matchAll(/class="risk-pill (\w+)"/g)].map((m) => m[1]), ['low', 'mid']);
  });

  test('compact cards omit the description and still show both pills', () => {
    const html = renderCompactCompareCards(cards);
    assert.match(html, /class="ccq-title">Short</);
    assert.match(html, /class="ccq-pair"/);
    assert.match(html, /class="ccq-vs">vs</);
    assert.match(html, /class="ccq-name">D</);
    assert.equal(html.includes('cci-desc'), false);
    assert.equal(html.includes('ok'), false);
    assert.match(html, /class="risk-pill low"/);
    assert.match(html, /class="risk-pill high"/);
  });
});

describe('renderHubJsonLd compare index', () => {
  test('WebPage and BreadcrumbList point at /compare', () => {
    const got = JSON.parse(renderHubJsonLd());
    const types = (got['@graph'] as Array<{ '@type': string; url?: string }>).map((node) => node['@type']);
    assert.deepEqual(types, ['WebPage', 'BreadcrumbList']);
    const page = (got['@graph'] as Array<{ '@type': string; url?: string }>)
      .find((node) => node['@type'] === 'WebPage');
    assert.equal(page?.url, 'https://mirai-shigoto.com/pro/compare');
  });
});
