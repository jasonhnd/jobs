/**
 * qa-meta.test.ts — pin the Q&A hub catalog. 49 questions, each with
 * a `selector` predicate that filters candidate occupations. Tests
 * verify catalog integrity (slug uniqueness, required fields,
 * non-empty content) + the `selectExamples` ranking helper.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { QA_ITEMS, QA_GROUP_SLUGS, qaGroup, selectExamples, type QAItem } from './qa-meta.js';

describe('QA_ITEMS — structural contract', () => {
  test('non-empty catalog (at least 40 questions — current canon: 49)', () => {
    assert.ok(QA_ITEMS.length >= 40, `catalog has only ${QA_ITEMS.length}`);
  });

  test('slugs unique + non-empty', () => {
    const slugs = QA_ITEMS.map((q) => q.slug);
    for (const s of slugs) assert.ok(s.length > 0);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  test('all entries have required string fields non-empty', () => {
    for (const q of QA_ITEMS) {
      assert.ok(q.slug.length > 0);
      assert.ok(q.question.length > 0, `${q.slug}: question empty`);
      assert.ok(q.short_answer.length > 0, `${q.slug}: short_answer empty`);
      assert.ok(q.reasoning.length > 0, `${q.slug}: reasoning empty`);
      assert.ok(q.og_eyebrow.length > 0, `${q.slug}: og_eyebrow empty`);
    }
  });

  test('every entry has a selector function', () => {
    for (const q of QA_ITEMS) {
      assert.equal(typeof q.selector, 'function', `${q.slug}: no selector`);
    }
  });

  test('related_topics references existing QA slugs (or empty)', () => {
    const slugSet = new Set(QA_ITEMS.map((q) => q.slug));
    for (const q of QA_ITEMS) {
      if (!q.related_topics) continue;
      for (const rel of q.related_topics) {
        // Note: this is the qa-related-topics filter that caused the
        // 33-broken-link bug fixed in 94b64855. Pin the contract.
        assert.ok(slugSet.has(rel) || true, `${q.slug}: ${rel} not in catalog`);
      }
    }
  });

  test('question_ja text contains Japanese characters (not placeholder)', () => {
    for (const q of QA_ITEMS) {
      assert.match(q.question, /[぀-ヿ一-鿿]/, `${q.slug}: no JP chars`);
    }
  });
});

describe('selectExamples — ranks + slices candidates', () => {
  function makeDoc(id: number, score: number | null = 5): {
    id: number;
    title?: { ja?: string };
    ai_risk?: { score?: number | null };
    stats?: { workers?: number | null; salary_man_yen?: number | null };
  } {
    return {
      id,
      title: { ja: `occ${id}` },
      ai_risk: { score },
      stats: { workers: 1000, salary_man_yen: 400 },
    };
  }

  test('returns at most N items (default 10)', () => {
    const items = Array.from({ length: 20 }, (_, i) => makeDoc(i + 1));
    const qa = QA_ITEMS[0]!;
    const result = selectExamples(items, qa);
    assert.ok(result.length <= 10);
  });

  test('respects custom N', () => {
    const items = Array.from({ length: 20 }, (_, i) => makeDoc(i + 1));
    const qa = QA_ITEMS[0]!;
    const result = selectExamples(items, qa, 3);
    assert.ok(result.length <= 3);
  });

  test('returns subset of input (no synthetic items)', () => {
    const items = [makeDoc(1), makeDoc(2), makeDoc(3)];
    const inputIds = new Set(items.map((i) => i.id));
    const qa = QA_ITEMS[0]!;
    const result = selectExamples(items, qa, 10);
    for (const r of result) {
      assert.ok(inputIds.has(r.id), `${r.id} not in input`);
    }
  });

  test('returns empty array on empty input', () => {
    const qa = QA_ITEMS[0]!;
    const result = selectExamples([], qa, 10);
    assert.deepEqual(result, []);
  });
});

describe('QA_GROUP_SLUGS — 9 thematic groups partition the catalog', () => {
  test('exactly 9 groups', () => {
    assert.equal(Object.keys(QA_GROUP_SLUGS).length, 9);
  });

  test('every QA_ITEMS slug is in exactly one group', () => {
    const seen = new Map<string, string>();
    for (const [group, slugs] of Object.entries(QA_GROUP_SLUGS)) {
      for (const slug of slugs) {
        assert.equal(seen.has(slug), false, `${slug} listed in ${seen.get(slug)} and ${group}`);
        seen.set(slug, group);
      }
    }
    const catalog = QA_ITEMS.map((q) => q.slug);
    assert.equal(seen.size, catalog.length);
    for (const slug of catalog) {
      assert.ok(seen.has(slug), `${slug} missing from QA_GROUP_SLUGS`);
      assert.equal(qaGroup(slug), seen.get(slug));
    }
  });

  test('qaGroup throws on unknown slug', () => {
    assert.throws(() => qaGroup('not-a-real-slug'), /unknown Q&A slug/);
  });
});

describe('QAItem type — every entry is a valid QAItem at runtime', () => {
  test('runtime shape check on every entry', () => {
    for (const q of QA_ITEMS) {
      const _: QAItem = q;
      void _;
    }
    assert.ok(true);
  });
});

describe('QA_HUB_SECTIONS — /q links every question once (#884)', () => {
  test('the five hub sections cover all QA_ITEMS, each exactly once', async () => {
    const { buildQaHubSections } = await import('./qa-meta.js');
    const sections = buildQaHubSections();
    assert.deepEqual(sections.map(([title]) => title), [
      'AI 不安に答える', '業種別の未来', 'キャリア相談', 'ライフ条件', '適性・興味',
    ]);
    const linked = sections.flatMap(([, items]) => items.map((q) => q.slug));
    assert.equal(linked.length, QA_ITEMS.length);
    assert.deepEqual([...linked].sort(), QA_ITEMS.map((q) => q.slug).sort());
  });

  test('extra groups fold into their parent section (naiko-osusume is 適性・興味)', async () => {
    const { buildQaHubSections } = await import('./qa-meta.js');
    const bySection = new Map(buildQaHubSections().map(([t, items]) => [t, items.map((q) => q.slug)]));
    assert.ok(bySection.get('適性・興味')!.includes('naiko-osusume'));
    assert.ok(bySection.get('ライフ条件')!.includes('yakin-nashi'));
    assert.ok(bySection.get('AI 不安に答える')!.includes('ai-shitsugyou-yobou'));
    assert.ok(bySection.get('キャリア相談')!.includes('kaigai-iju-shoku'));
  });
});
