import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { adaptDetailFile, type Rec } from '@/views/occupation-detail';
import { loadGeoFacts } from '@/page-data/geo-facts-loader';
import { FAMILIES } from '@/site/worktype-copy';
import { WorktypesDataSchema } from '@/data/schema/worktypes';
import type { ScoreHistoryComparisonEntry } from '@/templates/ScoreHistoryComparison';
import {
  buildIdPageBindings,
  buildVerdictDoors,
  canonicalOccupationRank,
  derivePrevDelta,
  formatPrevDelta,
  formatScoredMonthJa,
  formatVerdictFacts,
  formatVerdictRankLine,
  verdictSentence,
} from './_id-bindings.ts';

describe('derivePrevDelta', () => {
  test('returns null when history has fewer than 2 entries', () => {
    assert.equal(derivePrevDelta([]), null);
    assert.equal(derivePrevDelta([{ date: '2026-07-26', transformation: 3.6 }]), null);
  });

  test('subtracts previous from latest after sorting by date', () => {
    assert.equal(
      derivePrevDelta([
        { date: '2026-05-30', transformation: 3.8 },
        { date: '2026-07-26', transformation: 3.6 },
      ]),
      3.6 - 3.8,
    );
  });
});

// Only the default GEO/worktype readers use generated build:data fixtures.
// All page props are synthetic, and no fixture is written to the repository.
function page(rec: Partial<Rec> = {}, options: {
  scoreHistory?: readonly ScoreHistoryComparisonEntry[];
  prevDelta?: number | null;
} = {}) {
  return buildIdPageBindings({
    rec: { ...adaptDetailFile({ id: 156, title: { ja: 'Fixture & <job>' } }), ...rec },
    related: [{ ...adaptDetailFile({ id: 404 }), name_ja: 'Related <job>', ai_risk: 2 }],
    nameLookup: { 133: 'Lookup & <job>' },
    datePublished: '2026-01-02',
    dateModified: '2026-09-03',
    ...options,
  });
}

describe('buildIdPageBindings', () => {
  test('assembles scored identity, verdict, worktype, display and escaped sections', () => {
    const bindings = page({
      ai_risk: 8.25,
      ai_rationale_ja: '  Rationale & <text>  ',
      ai_scored_at: '2026-08-04',
      salary: 519.6, workers: 690_000, hours: 155.4,
      what_it_is_ja: 'Context & <text>',
      how_to_become_ja: 'Training & <text>',
      working_conditions_ja: 'Conditions & <text>',
      aiois: { d1: 8, d2: 8.5, d3: 3, d4: 4, d5: 5, d6: 6, d7: 7, d8: 8, d9: 9, d10: 10,
        transformation: 8.25, displacement: 1.75 },
      latest_transformation: 9.75, latest_delta: 1.5,
      transferCandidates: { source_id: 156, fallback: null, candidates: [
        { id: 133, title_ja: 'Fallback', ai_risk: 2, similarity: 0.85, sector_id: 'iryo' },
      ] },
    });
    assert.equal(bindings.id, 156);
    assert.equal(bindings.canonical, 'https://mirai-shigoto.com/156');
    assert.equal(bindings.nameJa, 'Fixture & <job>');
    assert.equal(bindings.riskTierJs, 'high');
    assert.equal(bindings.risk, 8.25);
    assert.equal(bindings.aioisTransformation, 8.25);
    assert.equal(bindings.aioisDisplacement, 1.75);
    assert.equal(bindings.verdict.scored, true);
    assert.equal(bindings.verdict.showShare, true);
    assert.equal(bindings.verdict.transformationDisp, '8.2');
    assert.equal(bindings.verdict.displacementDisp, '1.8');
    assert.equal(bindings.verdict.sentence, 'Rationale & <text>');
    assert.equal(bindings.verdict.facts, '年収 約519万円 · 就業者 約69万人 · 月155h');
    assert.equal(bindings.verdict.doors[1]?.href, '#sec-transfer');
    assert.match(bindings.verdict.rankLine, /2026年8月採点$/);
    assert.ok(bindings.verdict.latestObs?.includes('9.8'));
    assert.equal(bindings.verdict.latestObsHref, '#score-history-details');
    assert.equal(bindings.salaryInt, 519);
    assert.equal(bindings.salaryCell, '519 万円');
    assert.ok(bindings.title.includes('Fixture & <job>'));
    assert.ok(bindings.seoDesc.length > 0 && bindings.ogTitle.length > 0 && bindings.ogDesc.length > 0);
    assert.ok(bindings.keywords.includes('Fixture & <job>'));
    assert.match(bindings.ctxHtml, /Context &amp; &lt;text&gt;/);
    assert.match(bindings.howSection, /Training &amp; &lt;text&gt;/);
    assert.match(bindings.condSection, /Conditions &amp; &lt;text&gt;/);
    assert.match(bindings.transferHtml, /href="\/133"/);
    assert.match(bindings.transferHtml, /Lookup &amp; &lt;job&gt;/);
    assert.equal(bindings.legacyRelatedHtml, '');
    assert.match(bindings.aioisHtml, /class="aiois10"/);
    assert.match(bindings.aiFactHtml, /class="ai-fact"/);
    const worktypes = WorktypesDataSchema.parse(JSON.parse(readFileSync('public/data.worktypes.json', 'utf8')));
    const worktype = worktypes.occupations['156']!;
    const family = FAMILIES[worktype.code];
    assert.deepEqual(bindings.worktype, {
      worktypeFamilyCode: worktype.code, worktypeFamilyId: worktype.familyId,
      worktypeFamilyName: family.name, worktypeIdentity: family.identity,
      worktypeAiRelation: family.aiRelation, worktypeHumanValue: family.strengths,
      worktypeNextStep: family.empowerment, worktypeOneLine: family.share,
    });
    const nodes = JSON.parse(bindings.jsonLd)['@graph'];
    const web = nodes.find((node: { '@type': string }) => node['@type'] === 'WebPage');
    assert.equal(web.url, bindings.canonical);
    assert.equal(web.datePublished, '2026-01-02');
    assert.equal(web.dateModified, '2026-09-03');
  });

  test('unscored sparse props omit optional sections and use legacy related links', () => {
    const bindings = page();
    assert.equal(bindings.risk, null);
    assert.equal(bindings.aioisTransformation, null);
    assert.equal(bindings.aioisDisplacement, null);
    assert.equal(bindings.riskTierJs, 'low');
    assert.equal(bindings.verdict.scored, false);
    assert.equal(bindings.verdict.showShare, false);
    assert.equal(bindings.verdict.transformationDisp, '未採点');
    assert.equal(bindings.verdict.displacementDisp, null);
    assert.equal(bindings.verdict.latestObs, null);
    assert.equal(bindings.prevDelta, null);
    assert.equal(bindings.verdict.facts, '');
    assert.deepEqual(bindings.verdict.doors.map(door => door.href), ['#sec-similar']);
    for (const key of ['howSection', 'condSection', 'metaRowHtml', 'scoreHistoryHtml',
      'aiRiskDetailHtml', 'aioisHtml', 'profileHtml', 'topnHtml', 'transferHtml', 'orgsCertsHtml'] as const) {
      assert.equal(bindings[key], '', key);
    }
    assert.match(bindings.ctxHtml, /class="definition"/);
    assert.match(bindings.legacyRelatedHtml, /href="\/occupations\/404"/);
    assert.match(bindings.legacyRelatedHtml, /Related &lt;job&gt;/);
    assert.match(bindings.faqHtml, /class="faq"/);
  });

  test('sorts history without mutation, honors explicit delta, and falls back to latest date', () => {
    const history: ScoreHistoryComparisonEntry[] = [
      { model: 'grok-4.6', date: '2026-09-01', transformation: 6, displacement: 2, dims: { d1: 6 } },
      { model: 'grok-4.5', date: '2026-07-01', transformation: 4, displacement: null, dims: null },
      { model: 'grok-4.6', date: '2026-08-01', transformation: 5, displacement: 1, dims: { d1: 5 } },
    ];
    const before = structuredClone(history);
    const bindings = page({ ai_risk: 5.5, consensus_transformation: 5.4, stale_vote: true }, { scoreHistory: history });
    assert.equal(bindings.prevDelta, 1);
    assert.equal(bindings.aioisTransformation, 5.5);
    assert.equal(bindings.verdict.displacementDisp, '—');
    assert.equal(bindings.riskTierJs, 'mid');
    assert.match(bindings.verdict.rankLine, /2026年9月採点$/);
    assert.ok(!bindings.verdict.rankLine.includes('先月比'));
    assert.match(bindings.scoreHistoryHtml, /class="score-history-aging"/);
    assert.match(bindings.scoreHistoryHtml, /<strong>5\.4<span>\/10<\/span><\/strong>/);
    assert.equal(page({ ai_risk: 5.5 }, { scoreHistory: history, prevDelta: null }).prevDelta, null);
    assert.equal(page({ ai_risk: 5.5 }, { scoreHistory: history, prevDelta: -2 }).prevDelta, -2);
    assert.deepEqual(history, before);
  });

  test('uses description and rationale context fallbacks, and handles low/zero risk', () => {
    const description = 'x'.repeat(260) + '<tail>';
    const bindings = page({ ai_risk: 0, desc_ja: description });
    assert.equal(bindings.rationale, 'x'.repeat(240));
    assert.ok(bindings.ctxHtml.includes('x'.repeat(240)));
    // The definition uses the full description; only the body is truncated.
    const body = bindings.ctxHtml.slice(bindings.ctxHtml.indexOf('</p>') + 4);
    assert.ok(!body.includes('&lt;tail&gt;'));
    assert.ok(body.includes('x'.repeat(240)));
    assert.equal(bindings.verdict.transformationDisp, '0');
    assert.equal(bindings.verdict.scored, true);
    assert.equal(bindings.riskTierJs, 'low');
    assert.equal(bindings.verdict.doors[0]?.href, '#sec-aiois');
    assert.match(page({ ai_rationale_ja: 'Fallback & <text>' }).ctxHtml, /Fallback &amp; &lt;text&gt;/);
    assert.match(page({ name_ja: '' }).ctxHtml, /class="definition"/);
  });

  test('forwards canonical GEO rank and rejects occupations without a worktype', () => {
    const facts = loadGeoFacts();
    const expectedRank = facts.occupations.find(occupation => occupation.id === 156)!.aiImpactRank;
    assert.equal(canonicalOccupationRank(facts, 156), expectedRank);
    assert.equal(canonicalOccupationRank(facts, -1), null);
    assert.equal(page().rankInUniverse, expectedRank);
    assert.equal(page().rankUniverseTotal, facts.occupationCount);
    assert.throws(() => page({ id: -1 }), /occupation -1 missing from data\.worktypes\.json/);
  });
});

describe('formatPrevDelta', () => {
  test('zero renders ±0', () => {
    assert.equal(formatPrevDelta(0), '±0');
    assert.equal(formatPrevDelta(0.04), '±0');
  });
  test('signed one-decimal', () => {
    assert.equal(formatPrevDelta(-0.2), '-0.2');
    assert.equal(formatPrevDelta(1), '+1');
  });
});

describe('formatVerdictRankLine', () => {
  test('joins rank, delta, and scored month', () => {
    assert.equal(
      formatVerdictRankLine({
        rank: 483,
        total: 556,
        prevDelta: 0,
        scoredAtJa: '2026年7月採点',
      }),
      '556職中 第483位 · 先月比 ±0 · 2026年7月採点',
    );
  });
  test('omits 先月比 when prevDelta is null', () => {
    assert.equal(
      formatVerdictRankLine({
        rank: 6,
        total: 556,
        prevDelta: null,
        scoredAtJa: '2026年7月採点',
      }),
      '556職中 第6位 · 2026年7月採点',
    );
  });
});

describe('formatScoredMonthJa', () => {
  test('formats YYYY-MM-DD as 年月採点', () => {
    assert.equal(formatScoredMonthJa('2026-07-26'), '2026年7月採点');
  });
  test('falls back to CONTENT_DATE when missing', () => {
    assert.match(formatScoredMonthJa(undefined), /採点$/);
  });
});

describe('formatVerdictFacts', () => {
  test('skips null fields and uses 万人 rounding', () => {
    assert.equal(
      formatVerdictFacts({ salaryMan: 519.6, workers: 690000, hours: 155.4 }),
      '年収 約519万円 · 就業者 約69万人 · 月155h',
    );
    assert.equal(formatVerdictFacts({ salaryMan: null, workers: null, hours: 160 }), '月160h');
  });
});

describe('verdictSentence', () => {
  test('reuses rationale verbatim and falls back to the callout', () => {
    assert.equal(verdictSentence('現場の判断が残る。', 3.6), '現場の判断が残る。');
    assert.equal(verdictSentence('  ', 3.6), '低 AI 影響。専門性と判断が必要な業務が中心で、当面は安定。');
    assert.equal(verdictSentence('', null), 'AI 影響度未評価。');
  });
});

describe('buildVerdictDoors', () => {
  test('null risk is mid-variant minus the score anchor', () => {
    assert.deepEqual(buildVerdictDoors({ risk: null, hasTransfer: true }), [
      { href: '#sec-similar', label: '似た仕事', kind: 'ghost' },
    ]);
  });
  test('low <5 targets なぜ守られやすいか + 似た仕事', () => {
    const doors = buildVerdictDoors({ risk: 3.6, hasTransfer: true });
    assert.deepEqual(doors, [
      { href: '#sec-aiois', label: 'なぜ守られやすいか', kind: 'solid' },
      { href: '#sec-similar', label: '似た仕事', kind: 'ghost' },
    ]);
  });
  test('high ≥7 uses transfer door, falling back to 似た仕事', () => {
    assert.equal(buildVerdictDoors({ risk: 8.5, hasTransfer: true })[1]?.label, '移り先の候補');
    assert.equal(buildVerdictDoors({ risk: 8.5, hasTransfer: true })[1]?.href, '#sec-transfer');
    assert.equal(buildVerdictDoors({ risk: 8.5, hasTransfer: false })[1]?.href, '#sec-similar');
    assert.equal(buildVerdictDoors({ risk: 8.5, hasTransfer: true })[0]?.href, '#sec-aiois');
  });
  test('mid uses スコアの中身', () => {
    assert.equal(buildVerdictDoors({ risk: 5.5, hasTransfer: false })[0]?.label, 'スコアの中身');
  });
});
