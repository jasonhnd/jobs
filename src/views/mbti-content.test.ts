/**
 * Contract tests for the phase-1 MBTI content source.
 *
 * Scope matches docs/MBTI_CONTENT.md section 6.1: content/data only, no routes.
 */

import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { asOccupationId } from '@/graph/ids';
import { loadGraph } from '@/graph/loader';
import type { KnowledgeGraph } from '@/graph/types';
import {
  FAMILY_CODES,
  VARIANT_IDS_BY_FAMILY,
} from '@/site/worktype-copy';
import {
  MBTI_EDITORIAL_TAGS,
  PHASE1_MBTI_CONTENT,
  PHASE1_MBTI_SLUGS,
  getMbtiContentBySlug,
  isPhase1MbtiSlug,
  type MbtiContent,
} from './mbti-content.js';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

const EXPECTED_PHASE1 = [
  { label: 'ENFP', slug: 'enfp', commonNameJa: '運動家' },
  { label: 'INFP', slug: 'infp', commonNameJa: '仲介者' },
  { label: 'ISFP', slug: 'isfp', commonNameJa: '冒険家' },
  { label: 'INFJ', slug: 'infj', commonNameJa: '提唱者' },
  { label: 'ISTP', slug: 'istp', commonNameJa: '巨匠' },
] as const;

const UNSUPPORTED_PHASE1_SLUGS = [
  'istj',
  'isfj',
  'intj',
  'intp',
  'estp',
  'estj',
  'esfp',
  'esfj',
  'enfj',
  'entp',
  'entj',
] as const;

function publicStrings(entry: MbtiContent): string[] {
  return [
    entry.commonNameJa,
    entry.seo.titleJa,
    entry.seo.descriptionJa,
    entry.knownTypeFraming.h1Ja,
    entry.knownTypeFraming.introJa,
    entry.knownTypeFraming.guardrailJa,
    entry.editorial.headingJa,
    ...entry.editorial.paragraphsJa,
    ...entry.occupations.map((item) => item.reasonJa),
  ];
}

describe('PHASE1_MBTI_CONTENT — phase-1 type contract', () => {
  test('contains exactly the five merged phase-1 types', () => {
    assert.deepEqual(
      PHASE1_MBTI_CONTENT.map((entry) => ({
        label: entry.label,
        slug: entry.slug,
        commonNameJa: entry.commonNameJa,
      })),
      EXPECTED_PHASE1,
    );
    assert.deepEqual(PHASE1_MBTI_SLUGS, EXPECTED_PHASE1.map((entry) => entry.slug));
  });

  test('labels stay uppercase and slugs stay lowercase', () => {
    for (const entry of PHASE1_MBTI_CONTENT) {
      assert.equal(entry.label, entry.label.toUpperCase(), `${entry.slug}: label uppercase`);
      assert.equal(entry.slug, entry.label.toLowerCase(), `${entry.slug}: slug lowercase`);
    }
  });

  test('lookup only supports phase-1 lowercase slugs', () => {
    for (const entry of PHASE1_MBTI_CONTENT) {
      assert.equal(getMbtiContentBySlug(entry.slug), entry);
      assert.equal(isPhase1MbtiSlug(entry.slug), true);
      assert.equal(getMbtiContentBySlug(entry.label), null, `${entry.label}: uppercase is not the content slug`);
    }

    for (const slug of UNSUPPORTED_PHASE1_SLUGS) {
      assert.equal(getMbtiContentBySlug(slug), null, `${slug}: unsupported slug must not resolve`);
      assert.equal(isPhase1MbtiSlug(slug), false, `${slug}: unsupported slug must not be routable`);
    }
  });
});

describe('PHASE1_MBTI_CONTENT — copy contract', () => {
  test('SEO copy follows docs/MBTI_CONTENT.md section 5.1 patterns', () => {
    for (const entry of PHASE1_MBTI_CONTENT) {
      assert.equal(
        entry.seo.titleJa,
        `${entry.label}のAI時代の働き方｜職業データで見るAI影響度`,
      );
      assert.equal(
        entry.seo.descriptionJa,
        `${entry.label}タイプとして語られがちな働き方を、AI時代の職業データとAIOIS-10のAI影響度から読み解きます。適職判定ではなく、診断への入口です。`,
      );
    }
  });

  test('known-type framing follows section 3.1 patterns and guardrail', () => {
    for (const entry of PHASE1_MBTI_CONTENT) {
      assert.equal(entry.knownTypeFraming.h1Ja, `${entry.label}のAI時代の働き方`);
      assert.equal(
        entry.knownTypeFraming.introJa,
        `${entry.label}として検索してきた人へ。ここでは性格を決めつけず、AI時代に仕事で出やすい関心・動き方を、職業データと照らして見ていきます。`,
      );
      assert.equal(
        entry.knownTypeFraming.guardrailJa,
        'MBTIは性格の自己理解の入口です。このページは適職判定ではなく、職業データを見るための編集ガイドです。',
      );
    }
  });

  test('editorial copy is tentative and avoids section 4 non-goal claims', () => {
    const bannedPhrases = ['適職保証', '天職', '必ず向いている', '相性が悪い職業'];

    for (const entry of PHASE1_MBTI_CONTENT) {
      assert.equal(entry.editorial.headingJa, 'AI時代の、このタイプの働き方');
      assert.ok(entry.editorial.paragraphsJa.length >= 3, `${entry.slug}: editorial paragraphs`);
      assert.match(
        entry.editorial.paragraphsJa.join(''),
        /しやすいかもしれない/,
        `${entry.slug}: missing tentative voice`,
      );
      for (const text of publicStrings(entry)) {
        for (const phrase of bannedPhrases) {
          assert.ok(!text.includes(phrase), `${entry.slug}: banned phrase ${phrase}`);
        }
      }
    }
  });

  test('known-type framing does not expose diagnostic family codes', () => {
    for (const entry of PHASE1_MBTI_CONTENT) {
      const framing = [
        entry.knownTypeFraming.h1Ja,
        entry.knownTypeFraming.introJa,
        entry.knownTypeFraming.guardrailJa,
      ].join('');
      for (const code of FAMILY_CODES) {
        assert.ok(!framing.includes(code), `${entry.slug}: leaked diagnostic family code ${code}`);
      }
    }
  });
});

describe('PHASE1_MBTI_CONTENT — occupation curation contract', () => {
  test('active occupation graph has the expected 556 occupations', () => {
    assert.equal(graph.occupations.size, 556);
  });

  test('every type has 6-8 occupations, all present in active scored data', () => {
    for (const entry of PHASE1_MBTI_CONTENT) {
      assert.ok(entry.occupations.length >= 6, `${entry.slug}: fewer than 6 occupations`);
      assert.ok(entry.occupations.length <= 8, `${entry.slug}: more than 8 occupations`);

      for (const item of entry.occupations) {
        const id = asOccupationId(item.occupationId);
        const occupation = graph.occupations.get(id);
        assert.ok(occupation, `${entry.slug}: occupation ${item.occupationId} missing`);
        assert.ok(occupation.aiRisk?.aiois, `${entry.slug}: occupation ${item.occupationId} missing active AIOIS-10`);
      }
    }
  });

  test('each type spans at least two occupational domains', () => {
    for (const entry of PHASE1_MBTI_CONTENT) {
      const domains = new Set<string>();
      for (const item of entry.occupations) {
        const sector = graph.sectorOf(asOccupationId(item.occupationId));
        assert.ok(sector, `${entry.slug}: occupation ${item.occupationId} has no sector`);
        domains.add(String(sector));
      }
      assert.ok(domains.size >= 2, `${entry.slug}: expected >=2 domains, got ${[...domains].join(', ')}`);
    }
  });

  test('each type includes at least one surprising but plausible curation item', () => {
    for (const entry of PHASE1_MBTI_CONTENT) {
      assert.ok(
        entry.occupations.some((item) => item.surprising === true),
        `${entry.slug}: missing surprising curation item`,
      );
    }
  });

  test('editorial tags are allowed, reasons are short JA copy, and IDs are unique per type', () => {
    const allowedTags = new Set<string>(MBTI_EDITORIAL_TAGS);

    for (const entry of PHASE1_MBTI_CONTENT) {
      const ids = new Set<number>();
      for (const item of entry.occupations) {
        assert.ok(allowedTags.has(item.tag), `${entry.slug}: unsupported tag ${item.tag}`);
        assert.ok(item.reasonJa.length > 0, `${entry.slug}: empty reason for ${item.occupationId}`);
        assert.ok(item.reasonJa.length <= 70, `${entry.slug}: reason too long for ${item.occupationId}`);
        assert.ok(!ids.has(item.occupationId), `${entry.slug}: duplicate occupation ${item.occupationId}`);
        ids.add(item.occupationId);
      }
    }
  });

  test('editorial tags are curation-only and not diagnostic axes or variants', () => {
    const diagnosticTerms = new Set<string>([
      ...FAMILY_CODES,
      ...Object.values(VARIANT_IDS_BY_FAMILY).flat(),
      'A1',
      'A2',
      'A3',
      'a1',
      'a2',
      'a3',
      'C',
      'R',
      'P',
      'D',
      'B',
      'K',
      'balance',
      'mixed',
      'sweep',
    ]);

    for (const tag of MBTI_EDITORIAL_TAGS) {
      assert.ok(!diagnosticTerms.has(tag), `editorial tag reused as diagnostic term: ${tag}`);
    }
  });
});
