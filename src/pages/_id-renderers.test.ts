import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { adaptDetailFile, type Rec } from '@/views/occupation-detail';
import type { Aiois10 } from '@/graph/types';
import {
  buildOccupationFaqTuples,
  makeOccupationDefinitionFromRec,
  renderOccupationMetaRow,
  renderOccupationProfileRadar,
  renderOccupationTopn,
  renderOccupationFaq,
  renderOccupationTransfer,
  renderOccupationOrgsCerts,
  renderOccupationAiRiskDetail,
  renderOccupationAiois10,
  renderOccupationJsonLdFromRec,
} from './_id-renderers';

const aiois: Aiois10 = {
  d1: 1, d2: 2, d3: 3, d4: 4, d5: 5, d6: 6, d7: 7, d8: 8, d9: 9, d10: 10,
  transformation: 1.5, displacement: 2.5,
};
const rec = (overrides: Partial<Rec> = {}): Rec => ({
  ...adaptDetailFile({ id: 404, title: { ja: 'Fixture & <job>' } }),
  ...overrides,
});
const dates = { datePublished: '2026-01-02', dateModified: '2026-09-03' };

describe('occupation section adapters', () => {
  test('sparse records omit optional sections', () => {
    const sparse = rec();
    for (const render of [renderOccupationMetaRow, renderOccupationProfileRadar,
      renderOccupationTopn, renderOccupationOrgsCerts, renderOccupationAiRiskDetail, renderOccupationAiois10]) {
      assert.equal(render(sparse), '', render.name);
    }
    assert.equal(renderOccupationTransfer(sparse, {}), '');
    assert.ok(makeOccupationDefinitionFromRec(sparse).includes(sparse.name_ja));
  });

  test('maps sector and band chips, and profile axes in order', () => {
    const record = rec({
      sector: { id: 'iryo', ja: 'Sector & <label>' },
      risk_band: 'high', workforce_band: 'mid', demand_band: 'cold',
      profile5: { creative: 11, social: 22, judgment: 33, physical: 44, routine: 55 },
    });
    const meta = renderOccupationMetaRow(record);
    assert.match(meta, /href="\/sectors\/iryo">Sector &amp; &lt;label&gt;/);
    assert.match(meta, /class="band band-high">AI 影響 高/);
    assert.match(meta, /class="band band-mid">規模 中/);
    assert.match(meta, /class="band band-low">需要 安定/);
    const radar = renderOccupationProfileRadar(record);
    assert.match(radar, /viewBox="0 0 340 340"/);
    assert.deepEqual([...radar.matchAll(/<dd>(\d+)<\/dd>/g)].map(match => Number(match[1])), [11, 22, 33, 44, 55]);
  });

  test('maps all three ranked lists with escaped labels and one-decimal scores', () => {
    const html = renderOccupationTopn(rec({
      skills_top10: [{ key: 's', label_ja: 'Skill <x>', score: 4.25 }],
      knowledge_top5: [{ key: 'k', label_ja: 'Knowledge & x', score: 3 }],
      abilities_top5: [{ key: 'a', label_ja: 'Ability "x"', score: 2.75 }],
    }));
    assert.deepEqual([...html.matchAll(/class="topn-name">([^<]*)<\/span>/g)].map(match => match[1]),
      ['Skill &lt;x&gt;', 'Knowledge &amp; x', 'Ability &quot;x&quot;']);
    assert.deepEqual([...html.matchAll(/class="topn-score">([^<]*)<\/span>/g)].map(match => match[1]), ['4.3', '3.0', '2.8']);
  });

  test('limits transfer cards to five, resolves lookup/title/unknown, and does not mutate candidates', () => {
    const candidates = Array.from({ length: 6 }, (_, i) => ({
      id: 404 + i, title_ja: i === 2 ? null : `Title <${i}>`, ai_risk: i === 1 ? null : i,
      similarity: 0.85, sector_id: 'iryo',
    }));
    const before = structuredClone(candidates);
    const html = renderOccupationTransfer(rec({
      transferCandidates: { source_id: 156, candidates, fallback: null },
    }), { 404: 'Lookup & <name>', 405: '' });
    assert.equal([...html.matchAll(/class="transfer-card"/g)].length, 5);
    assert.match(html, /href="\/occupations\/404"/);
    assert.match(html, /Lookup &amp; &lt;name&gt;/);
    assert.match(html, /Title &lt;1&gt;/);
    assert.match(html, /class="tc-name">\?<\/span>/);
    assert.match(html, /class="tc-risk">AI 影響 —/);
    assert.match(html, /85%/);
    assert.ok(!html.includes('href="/409"'));
    assert.deepEqual(candidates, before);
  });

  test('maps organisation URLs and certificates, omitting nameless organisations', () => {
    const html = renderOccupationOrgsCerts(rec({
      related_orgs: [{ name_ja: 'Org & <x>', url: 'https://example.test/?a=1&b=2' },
        { name_ja: 'No URL' }, {}],
      related_certs_ja: ['Cert <x>'],
    }));
    assert.match(html, /href="https:\/\/example\.test\/\?a=1&amp;b=2"/);
    assert.match(html, /Org &amp; &lt;x&gt;/);
    // #884: no URL → plain text, not a dead href="#" opening a new tab.
    assert.match(html, /<li>No URL<\/li>/);
    assert.ok(!html.includes('href="#"'));
    assert.equal([...html.matchAll(/target="_blank"/g)].length, 1);
    assert.match(html, /<li>Cert &lt;x&gt;<\/li>/);
  });

  test('forwards long rationale, task arrays, horizon and every AIOIS dimension', () => {
    const record = rec({ ai_risk: 1.5, aiois, ai_rationale_long_ja: 'Long & <text>',
      ai_displaceable_tasks_ja: ['Task <a>'], ai_resilient_tasks_ja: ['Task & b'],
      ai_horizon_5y_ja: 'Horizon <c>' });
    const detail = renderOccupationAiRiskDetail(record);
    for (const text of ['Long &amp; &lt;text&gt;', 'Task &lt;a&gt;', 'Task &amp; b', 'Horizon &lt;c&gt;']) {
      assert.ok(detail.includes(text), text);
    }
    assert.match(detail, /1\.5\/10/);
    const profile = renderOccupationAiois10(record);
    assert.deepEqual([...profile.matchAll(/class="aio-val">([^<]*)<\/span>/g)].map(match => match[1]),
      ['1.0', '2.0', '3.0', '4.0', '5.0', '6.0', '7.0', '8.0', '9.0', '10.0']);
    assert.match(profile, /1\.5<small>\/10<\/small>/);
    assert.match(profile, /2\.5<small>\/10<\/small>/);
  });
});

describe('occupation FAQ and JSON-LD adapters', () => {
  test('on-page and structured FAQ answers agree for populated record fields', () => {
    const record = rec({ ai_risk: 1.5, ai_rationale_ja: 'Reason & <x>',
      salary: 519, workers: 1000, recruit_ratio: 2, how_to_become_ja: 'Training <x>',
      skills_top10: [{ key: 's', label_ja: 'Skill <x>', score: 4 }] });
    const tuples = buildOccupationFaqTuples(record);
    assert.ok(tuples.length > 0);
    const html = renderOccupationFaq(record);
    assert.match(html, /Fixture &amp; &lt;job&gt;/);
    assert.ok(!html.includes('<x>'));
    const nodes = JSON.parse(renderOccupationJsonLdFromRec(record, dates))['@graph'];
    const faq = nodes.find((node: { '@type': string }) => node['@type'] === 'FAQPage');
    assert.deepEqual(faq.mainEntity.map((question: { name: string; acceptedAnswer: { text: string } }) =>
      [question.name, question.acceptedAnswer.text]), tuples);
    for (const [question] of tuples) {
      assert.ok(html.includes(question.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')));
    }
  });

  test('maps classification priority, aliases, filtered skills, statistics and AIOIS to JSON-LD', () => {
    const record = rec({ ai_risk: 1.5, aiois,
      classifications: { mhlw_main: 'MHLW', jsoc_main: 'JSOC' },
      aliases_ja: ['Alias A', 'Alias B'], sector: { id: 'iryo', ja: 'Sector' },
      skills_top10: [{ key: 's', label_ja: 'Skill', score: 4 }, { key: 'empty', label_ja: '', score: 3 }],
      related_certs_ja: ['Certificate'], tasks_lead_ja: 'Tasks',
      salary: 519, workers: 1000, hours: 160, age: 40, recruit_ratio: 2, hourly_wage: 1500,
    });
    const nodes = JSON.parse(renderOccupationJsonLdFromRec(record, dates))['@graph'];
    const web = nodes.find((node: { '@type': string }) => node['@type'] === 'WebPage');
    const occupation = nodes.find((node: { '@type': string }) => node['@type'] === 'Occupation');
    assert.equal(web.url, 'https://mirai-shigoto.com/occupations/404');
    assert.equal(web.datePublished, dates.datePublished);
    assert.equal(web.dateModified, dates.dateModified);
    assert.ok(web.name.includes('1.5/10'));
    assert.equal(occupation.sameAs, record.url);
    assert.equal(occupation.occupationalCategory, 'MHLW');
    assert.deepEqual(occupation.alternateName, ['Alias A', 'Alias B']);
    assert.deepEqual(occupation.skills, ['Skill']);
    assert.deepEqual(occupation.qualifications, ['Certificate']);
    assert.equal(occupation.responsibilities, 'Tasks');
    assert.equal(occupation.estimatedSalary.median, 5_190_000);
    const props = occupation.additionalProperty;
    assert.equal(props.find((p: { name: string }) => p.name === 'Workforce size').value, 1000);
    assert.equal(props.find((p: { name: string }) => p.name === 'AIOIS-10 Transformation index').value, 1.5);
    assert.deepEqual(props.filter((p: { name: string }) => /^AIOIS-10 D\d/.test(p.name)).map((p: { value: number }) => p.value),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('unscored JSON-LD uses JSOC, sector, then numeric classification fallbacks', () => {
    for (const [overrides, category] of [
      [{ classifications: { jsoc_main: 'JSOC' } }, 'JSOC'],
      [{ sector: { ja: 'Sector' } }, 'Sector'],
      [{}, '404'],
    ] as const) {
      const nodes = JSON.parse(renderOccupationJsonLdFromRec(rec(overrides), dates))['@graph'];
      const web = nodes.find((node: { '@type': string }) => node['@type'] === 'WebPage');
      const occupation = nodes.find((node: { '@type': string }) => node['@type'] === 'Occupation');
      assert.equal(web.name, 'Fixture & <job> | 未来の仕事');
      assert.equal(occupation.occupationalCategory, category);
      assert.equal(occupation.skills, undefined);
      assert.equal(occupation.estimatedSalary, undefined);
      assert.deepEqual(occupation.additionalProperty, []);
    }
  });
});
