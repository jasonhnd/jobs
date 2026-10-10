import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { buildOccupationSummary, renderOccupationSummaryJsonLd, PRO_CHAPTER_LINKS } from './occupation-summary';

const input = { id: 404, name_ja: '内科医', ai_risk: 3.9, salary: 1234.5, hours: 167.5 };

test('uses displayed-value boundaries and the exact owner-signed three-band copy', () => {
  for (const [risk, band, word] of [[3.94, 'low', '変化 小さい'], [3.9666, 'mid', '変化 中くらい'], [6.9666, 'high', '変化 大きい']] as const) {
    const summary = buildOccupationSummary({ ...input, ai_risk: risk });
    expect(summary.band).toBe(band);
    expect(summary.bandWord).toBe(word);
    expect(summary.primaryHref).toBe('/pro/404#sec-aiois');
  }
  expect(buildOccupationSummary(input).advice).toBe('AIを道具として使える場面を、知っておきましょう。');
  expect(buildOccupationSummary({ ...input, ai_risk: 5 }).conclusion).toBe('内科医は、AIで変わる部分と、人が続ける部分が両方ある仕事です。');
});

test('missing salary, hours and scores remain missing, including zero/invalid stats', () => {
  for (const missing of [null, 0, NaN, Infinity]) {
    const summary = buildOccupationSummary({ ...input, salary: missing, hours: missing, ai_risk: null });
    expect(summary.salaryText).toBe('—');
    expect(summary.hoursText).toBe('—');
    expect(summary.scoreText).toBe('未評価');
    expect(summary.bandWord).toBe(null);
    expect(summary.conclusion).toBe(null);
    expect(summary.advice).toBe(null);
  }
});

test('ordinary structured data exposes only visible summary properties and stable identity', () => {
  const summary = buildOccupationSummary(input);
  const data = JSON.parse(renderOccupationSummaryJsonLd(summary, { datePublished: '2026-05-30', dateModified: '2026-10-01' }));
  const nodes = data['@graph'];
  assert.deepEqual(nodes.map((n: any) => n['@type']), ['WebPage', 'Occupation', 'BreadcrumbList']);
  expect(nodes[0].description).toBe(summary.conclusion);
  expect(nodes[0].mainEntity['@id']).toBe('https://mirai-shigoto.com/occupations/404#occupation');
  assert.deepEqual(nodes[0].speakable.cssSelector, ['.summary-conclusion', '.summary-advice']);
  expect(nodes[1].additionalProperty.length).toBe(2);
  assert.deepEqual(nodes[1].additionalProperty.map((p: any) => p.value), [3.9, 167]);
  expect(nodes[1].estimatedSalary.median).toBe(12340000);
  for (const key of ['skills', 'qualifications', 'responsibilities', 'educationRequirements', 'experienceRequirements']) expect(nodes[1][key]).toBe(undefined);
  const missing = JSON.parse(renderOccupationSummaryJsonLd(buildOccupationSummary({ ...input, salary: null, hours: null, ai_risk: null }), { datePublished: '2026-05-30', dateModified: '2026-10-01' }));
  assert.deepEqual(missing['@graph'][1].additionalProperty, []);
  expect(missing['@graph'][1].estimatedSalary).toBe(undefined);
  expect(missing['@graph'][0].speakable).toBe(undefined);
});

test('compatibility table covers all existing sec/chp anchors and model-history entry', () => {
  assert.deepEqual(PRO_CHAPTER_LINKS.flatMap(chapter => [chapter.id, ...chapter.anchors]), [
    'chp-score', 'sec-aiois', 'sec-ai-detail', 'score-history-details',
    'chp-about', 'chp-path', 'chp-work', 'chp-next', 'sec-transfer', 'sec-similar', 'chp-faq', 'chp-source',
  ]);
});
