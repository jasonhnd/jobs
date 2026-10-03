import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSkillsBundle } from './skills-hub.js';
import { SKILL_META } from './skills-meta.js';
import type { SkillRankingFile } from '../page-data/projection-loaders.js';

type Tm = {
  id: number; ai_risk: number | null; risk_band: string | null; workers: number | null;
  salary: number | null; sector_id?: string; sector_ja?: string;
};

function tm(id: number, over: Partial<Tm> = {}): Tm {
  return { id, ai_risk: 4, risk_band: 'mid', workers: 1000, salary: 500, sector_id: 's1', sector_ja: 'セクター1', ...over };
}

function ranking(ids: number[]): SkillRankingFile {
  return {
    skill_key: 'k', label_ja: 'l',
    occupations: ids.map((id, i) => ({ id, name_ja: `job-${id}`, score: 5 - i * 0.1 })),
  };
}

describe('buildSkillsBundle (injected loaders)', () => {
  const treemap = new Map<number, Tm>([
    [1, tm(1)],
    [2, tm(2, { sector_id: 's2', sector_ja: 'セクター2', ai_risk: 8 })],
    [3, tm(3, { sector_ja: 'セクター1' })],
  ]);
  const requested: string[] = [];
  const bundle = buildSkillsBundle({
    skillRanking: (key) => { requested.push(key); return ranking([1, 2, 3, 99]); },
    treemap: () => treemap as never,
  });
  const meta = SKILL_META[0]!;

  test('requests every skill ipd_key and builds a result + card for each', () => {
    assert.deepEqual(requested, SKILL_META.map((m) => m.ipd_key));
    assert.equal(bundle.results.size, SKILL_META.length);
    assert.equal(bundle.hub.cards.length, SKILL_META.length);
  });

  test('joins treemap fields and leaves unknown ids null', () => {
    const items = bundle.results.get(meta.slug)!.items;
    assert.equal(items[0]!.skill_score, 5);
    assert.equal(items[1]!.ai_risk, 8);
    const missing = items.find((o) => o.id === 99)!;
    assert.equal(missing.ai_risk, null);
    assert.equal(missing.sector_ja, '');
  });

  test('computes sector breakdown, stats, highlights and FAQs', () => {
    const r = bundle.results.get(meta.slug)!;
    assert.deepEqual(r.sectorBreakdown[0], ['セクター1', 2]);
    assert.equal(r.stats.length, 4);
    assert.ok(r.highlights[0]!.includes('job-1'));
    assert.equal(r.faqItems.length, 4);
  });

  test('card preview names the top occupation', () => {
    assert.ok(bundle.hub.cards[0]!.top_preview.includes('job-1'));
    assert.equal(bundle.hub.cards[0]!.top_count, 4);
  });

  test('empty ranking yields placeholder stats and no AI-risk FAQ', () => {
    const b = buildSkillsBundle({ skillRanking: () => ranking([]), treemap: () => new Map() });
    const r = b.results.get(meta.slug)!;
    assert.equal(r.items.length, 0);
    assert.equal(r.stats[1]![1], '—');
    assert.equal(r.faqItems.length, 2);
    assert.equal(b.hub.cards[0]!.top_preview, '');
  });

  test('FAQ risk tier covers low / mid / high bands', () => {
    const tiers = [[2, '低め'], [5, '中程度'], [8, 'やや高め']] as const;
    for (const [risk, word] of tiers) {
      const b = buildSkillsBundle({
        skillRanking: () => ranking([1]),
        treemap: () => new Map([[1, tm(1, { ai_risk: risk })]]) as never,
      });
      const faq = b.results.get(meta.slug)!.faqItems.find(([q]) => q.includes('AI'))!;
      assert.ok(faq[1].includes(word), `${risk} -> ${word}`);
    }
  });
});

describe('buildSkillsBundle (production data)', () => {
  test('caps each hub at 30 items', () => {
    const b = buildSkillsBundle();
    for (const r of b.results.values()) {
      assert.ok(r.items.length > 0 && r.items.length <= 30);
    }
  });
});
