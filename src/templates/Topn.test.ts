/**
 * Topn.test.ts — pin the byte-for-byte output of the
 * skills / knowledge / abilities top-N block extracted from [id].astro.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderTopn } from './Topn.js';

describe('renderTopn', () => {
  test('all three arrays empty returns empty SafeHtml (no <section>)', () => {
    assert.equal(renderTopn({ skills: [], knowledge: [], abilities: [] }), '');
  });

  test('skills only renders only the スキル block', () => {
    const out = renderTopn({
      skills: [
        { labelJa: '対人交渉', score: 4.8 },
        { labelJa: '判断', score: 4.5 },
      ],
      knowledge: [],
      abilities: [],
    });
    assert.ok(out.includes('<section class="topn"'));
    assert.ok(out.includes('<h3>スキル Top 10</h3>'));
    assert.ok(!out.includes('<h3>知識 Top 5</h3>'));
    assert.ok(!out.includes('<h3>能力 Top 5</h3>'));
    assert.ok(out.includes('<span class="topn-name">対人交渉</span>'));
    assert.ok(out.includes('<span class="topn-score">4.8</span>'));
  });

  test('all three categories render in fixed order: skills → knowledge → abilities', () => {
    const out = renderTopn({
      skills: [{ labelJa: 's1', score: 4.0 }],
      knowledge: [{ labelJa: 'k1', score: 3.5 }],
      abilities: [{ labelJa: 'a1', score: 3.0 }],
    });
    const sAt = out.indexOf('スキル Top 10');
    const kAt = out.indexOf('知識 Top 5');
    const aAt = out.indexOf('能力 Top 5');
    assert.ok(sAt < kAt && kAt < aAt);
    // Three block <div>s.
    const blockCount = (out.match(/<div class="topn-block">/g) || []).length;
    assert.equal(blockCount, 3);
  });

  test('score formatted with one decimal (toFixed(1)): integer → "N.0"', () => {
    const out = renderTopn({
      skills: [{ labelJa: 'x', score: 4 }],
      knowledge: [],
      abilities: [],
    });
    assert.ok(out.includes('<span class="topn-score">4.0</span>'));
  });

  test('null score coerces to 0.0', () => {
    const out = renderTopn({
      skills: [{ labelJa: 'x', score: null }],
      knowledge: [],
      abilities: [],
    });
    assert.ok(out.includes('<span class="topn-score">0.0</span>'));
  });

  test('null labelJa coerces to empty string', () => {
    const out = renderTopn({
      skills: [{ labelJa: null, score: 3.5 }],
      knowledge: [],
      abilities: [],
    });
    assert.ok(out.includes('<span class="topn-name"></span>'));
  });

  test('outer <section> still renders when only one of three is populated', () => {
    const knowledgeOnly = renderTopn({
      skills: [],
      knowledge: [{ labelJa: 'k', score: 4.2 }],
      abilities: [],
    });
    assert.ok(knowledgeOnly.includes('<section class="topn"'));
    assert.ok(knowledgeOnly.includes('<h3>知識 Top 5</h3>'));
    assert.ok(!knowledgeOnly.includes('<h3>スキル Top 10</h3>'));
  });

  test('XSS payload in label escaped', () => {
    const out = renderTopn({
      skills: [{ labelJa: '<script>x</script>', score: 1 }],
      knowledge: [],
      abilities: [],
    });
    assert.ok(!out.includes('<script>x</script>'));
    assert.ok(out.includes('&lt;script&gt;x&lt;/script&gt;'));
  });

  test('item count: list size preserved (e.g. 10 skills + 5 knowledge + 5 abilities)', () => {
    const tenSkills = Array.from({ length: 10 }, (_, i) => ({
      labelJa: `s${i + 1}`,
      score: 4.5 - i * 0.1,
    }));
    const fiveK = Array.from({ length: 5 }, (_, i) => ({
      labelJa: `k${i + 1}`,
      score: 4.0 - i * 0.1,
    }));
    const fiveA = Array.from({ length: 5 }, (_, i) => ({
      labelJa: `a${i + 1}`,
      score: 3.5 - i * 0.1,
    }));
    const out = renderTopn({ skills: tenSkills, knowledge: fiveK, abilities: fiveA });
    const liCount = (out.match(/<li>/g) || []).length;
    assert.equal(liCount, 20);
  });
});
