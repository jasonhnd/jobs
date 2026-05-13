/**
 * occupation-definition.test.ts — pin the Japanese definition
 * sentence builder used by the occupation detail page.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { makeOccupationDefinition } from './occupation-definition.js';

describe('makeOccupationDefinition', () => {
  test('no summary + no sector → generic fallback', () => {
    assert.equal(
      makeOccupationDefinition({ nameJa: '看護師', descJa: '', sectorJa: null }),
      '看護師とは、日本の職業の一つです。',
    );
  });

  test('no summary + sector present → sector-based fallback', () => {
    assert.equal(
      makeOccupationDefinition({ nameJa: '看護師', descJa: '', sectorJa: '医療' }),
      '看護師とは、医療業界に属する職業です。',
    );
  });

  test('summary starting with "{name}とは" preserved verbatim if ends in です', () => {
    const out = makeOccupationDefinition({
      nameJa: '看護師',
      descJa: '看護師とは、病院で患者を看護する専門職です。',
      sectorJa: null,
    });
    assert.equal(out, '看護師とは、病院で患者を看護する専門職です。');
  });

  test('summary starting with "{name}とは" appends です if ending in noun-final marker (e.g. 「士」)', () => {
    const out = makeOccupationDefinition({
      nameJa: '弁護士',
      descJa: '弁護士とは、法律に関する業務を行う士',
      sectorJa: null,
    });
    assert.equal(out, '弁護士とは、法律に関する業務を行う士です。');
  });

  test('summary starting with "{name}とは" appends 職業です if ending non-noun-final', () => {
    const out = makeOccupationDefinition({
      nameJa: '看護師',
      descJa: '看護師とは、病院で患者を看護する',
      sectorJa: null,
    });
    assert.equal(out, '看護師とは、病院で患者を看護する職業です。');
  });

  test('summary NOT starting with name → prefix with "{name}とは、"', () => {
    const out = makeOccupationDefinition({
      nameJa: 'プログラマー',
      descJa: 'ソフトウェアを開発する',
      sectorJa: null,
    });
    assert.equal(out, 'プログラマーとは、ソフトウェアを開発する職業です。');
  });

  test('summary ending in noun-final marker skips 職業 prefix', () => {
    const out = makeOccupationDefinition({
      nameJa: 'プログラマー',
      descJa: 'ソフトウェア技術者',
      sectorJa: null,
    });
    assert.equal(out, 'プログラマーとは、ソフトウェア技術者です。');
  });

  test('summary with multiple sentences uses only the first', () => {
    const out = makeOccupationDefinition({
      nameJa: '看護師',
      descJa: '看護師とは、病院で患者を看護する専門職です。日々の業務は多岐にわたります。',
      sectorJa: null,
    });
    assert.equal(out, '看護師とは、病院で患者を看護する専門職です。');
    assert.ok(!out.includes('日々の業務'));
  });

  test('summary with no 「。」 separator still treated as single sentence', () => {
    const out = makeOccupationDefinition({
      nameJa: '看護師',
      descJa: '看護師とは、医療従事者',
      sectorJa: null,
    });
    assert.equal(out, '看護師とは、医療従事者です。'); // 者 is noun-final
  });

  test('input trimmed (leading/trailing whitespace ignored)', () => {
    const out = makeOccupationDefinition({
      nameJa: '  看護師  ',
      descJa: '  医療従事者  ',
      sectorJa: null,
    });
    assert.equal(out, '看護師とは、医療従事者です。');
  });

  test('"{name}は" prefix also preserved verbatim (alt syntax to とは)', () => {
    const out = makeOccupationDefinition({
      nameJa: '看護師',
      descJa: '看護師は患者を看護する職業です。',
      sectorJa: null,
    });
    assert.equal(out, '看護師は患者を看護する職業です。');
  });

  test('ends-with-ます also preserves verbatim (polite verb form)', () => {
    const out = makeOccupationDefinition({
      nameJa: '看護師',
      descJa: '看護師とは患者を看護します',
      sectorJa: null,
    });
    assert.equal(out, '看護師とは患者を看護します。');
  });

  test('ends-with-である also preserves verbatim (formal copula)', () => {
    const out = makeOccupationDefinition({
      nameJa: '看護師',
      descJa: '看護師とは医療従事者である',
      sectorJa: null,
    });
    assert.equal(out, '看護師とは医療従事者である。');
  });
});
