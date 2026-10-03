import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildInterests, type HollandRow, type TreemapRecord } from './interests.js';
import { INTEREST_META } from './interests-meta.js';

function row(id: number, scores: Partial<Record<'R' | 'I' | 'A' | 'S' | 'E' | 'C', number | null>>): HollandRow {
  return { id, name_ja: `job-${id}`, R: 0, I: 0, A: 0, S: 0, E: 0, C: 0, ...scores };
}

function tm(id: number, over: Partial<TreemapRecord> = {}): TreemapRecord {
  return {
    id, ai_risk: 4, risk_band: 'mid', workers: 1000, salary: 500,
    sector_id: 'sec-a', sector_ja: 'セクターA', ...over,
  };
}

describe('buildInterests (injected loaders)', () => {
  const holland = [
    row(1, { R: 4, I: 1 }),
    row(2, { R: 4, I: 5 }),
    row(3, { R: 3, I: null }),
    row(4, { R: 5, I: 2 }),
  ];
  const treemap = new Map<number, TreemapRecord>([
    [1, tm(1)],
    [2, tm(2, { sector_id: 'sec-b', sector_ja: 'セクターB', ai_risk: 8 })],
    [4, tm(4)],
  ]);
  const bundle = buildInterests({ holland: () => holland, treemap: () => treemap });
  const first = INTEREST_META[0]!;
  const interestR = INTEREST_META.find((m) => m.letter === 'R')!;
  const interestI = INTEREST_META.find((m) => m.letter === 'I')!;

  test('returns a result and a card per interest type', () => {
    assert.equal(bundle.results.size, INTEREST_META.length);
    assert.equal(bundle.hub.cards.length, INTEREST_META.length);
    assert.ok(bundle.results.has(first.slug));
  });

  test('sorts by score descending with id ascending tie-break', () => {
    const ids = bundle.results.get(interestR.slug)!.items.map((o) => o.id);
    assert.deepEqual(ids, [4, 1, 2, 3]);
  });

  test('drops rows whose score for the dimension is null', () => {
    const ids = bundle.results.get(interestI.slug)!.items.map((o) => o.id);
    assert.ok(!ids.includes(3));
  });

  test('missing treemap record yields null stats and empty sector', () => {
    const o = bundle.results.get(interestR.slug)!.items.find((x) => x.id === 3)!;
    assert.equal(o.ai_risk, null);
    assert.equal(o.workers, null);
    assert.equal(o.sector_ja, '');
  });

  test('builds sector breakdown, stats, highlights and FAQs', () => {
    const r = bundle.results.get(interestR.slug)!;
    assert.deepEqual(r.sectorBreakdown[0], ['セクターA', 2]);
    assert.equal(r.stats.length, 4);
    assert.ok(r.stats[0]![0].includes('R'));
    assert.ok(r.highlights.length >= 3);
    assert.ok(r.highlights[0]!.includes('job-4'));
    assert.equal(r.faqItems.length, 4);
  });

  test('hub card preview points at the top item', () => {
    const card = bundle.hub.cards.find((c) => c.slug === interestR.slug)!;
    assert.equal(card.top_count, 4);
    assert.ok(card.top_preview.includes('job-4'));
  });

  test('empty input yields placeholder stats and no AI-risk FAQ', () => {
    const empty = buildInterests({ holland: () => [], treemap: () => new Map() });
    const r = empty.results.get(first.slug)!;
    assert.equal(r.items.length, 0);
    assert.equal(r.stats[1]![1], '—');
    assert.equal(r.faqItems.length, 2);
    assert.equal(empty.hub.cards[0]!.top_preview, '');
  });

  test('FAQ risk tier covers low / mid / high bands', () => {
    const tiers = [[2, '低め'], [5, '中程度'], [8, 'やや高め']] as const;
    for (const [risk, word] of tiers) {
      const b = buildInterests({
        holland: () => [row(1, { R: 5 })],
        treemap: () => new Map([[1, tm(1, { ai_risk: risk })]]),
      });
      const faq = b.results.get(interestR.slug)!.faqItems.find(([q]) => q.includes('AI'))!;
      assert.ok(faq[1].includes(word), `${risk} -> ${word}`);
    }
  });
});

describe('buildInterests (production data)', () => {
  test('caps each hub at 30 items', () => {
    const b = buildInterests();
    for (const r of b.results.values()) {
      assert.ok(r.items.length > 0 && r.items.length <= 30);
    }
  });
});
