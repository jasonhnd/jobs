/**
 * AiRiskDetail.test.ts — pin the byte-for-byte output of the
 * "Why AI risk N" block extracted from [id].astro.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderAiRiskDetail } from './AiRiskDetail.js';

describe('renderAiRiskDetail', () => {
  test('missing rationaleLongJa returns empty SafeHtml (no <section>)', () => {
    assert.equal(
      renderAiRiskDetail({
        aiRisk: 7,
        rationaleLongJa: null,
        displaceableTasksJa: ['x'],
        resilientTasksJa: ['y'],
        horizon5yJa: '展望',
      }),
      '',
    );
  });

  test('empty-string rationaleLongJa also gates the block', () => {
    assert.equal(
      renderAiRiskDetail({
        aiRisk: 7,
        rationaleLongJa: '',
        displaceableTasksJa: [],
        resilientTasksJa: [],
        horizon5yJa: null,
      }),
      '',
    );
  });

  test('full render — score, rationale, dual task grid, and horizon', () => {
    const out = renderAiRiskDetail({
      aiRisk: 7,
      rationaleLongJa: '長文の理由',
      displaceableTasksJa: ['書類処理', '定型応対'],
      resilientTasksJa: ['対面相談', '臨機応変'],
      horizon5yJa: '5-10 年で大きく変わる',
    });
    assert.ok(out.includes('<section class="ai-risk-detail" aria-labelledby="ai-risk-detail-h2">'));
    assert.ok(out.includes('<h2 id="ai-risk-detail-h2">なぜ AI 影響度 7/10 か</h2>'));
    assert.ok(out.includes('<p class="ai-rationale-long">長文の理由</p>'));
    assert.ok(out.includes('<h3>AI に置き換わりやすい業務</h3>'));
    assert.ok(out.includes('<li>書類処理</li><li>定型応対</li>'));
    assert.ok(out.includes('<h3>人が残る業務</h3>'));
    assert.ok(out.includes('<li>対面相談</li><li>臨機応変</li>'));
    assert.ok(
      out.includes('<p class="ai-horizon"><strong>5-10 年展望:</strong> 5-10 年で大きく変わる</p>'),
    );
  });

  test('aiRisk null renders em-dash in headline (no "/10" suffix)', () => {
    const out = renderAiRiskDetail({
      aiRisk: null,
      rationaleLongJa: 'r',
      displaceableTasksJa: [],
      resilientTasksJa: [],
      horizon5yJa: null,
    });
    assert.ok(out.includes('<h2 id="ai-risk-detail-h2">なぜ AI 影響度 — か</h2>'));
    assert.ok(!out.includes('/10'));
  });

  test('empty task arrays still emit task-grid with empty <ul>s', () => {
    const out = renderAiRiskDetail({
      aiRisk: 3,
      rationaleLongJa: 'r',
      displaceableTasksJa: [],
      resilientTasksJa: [],
      horizon5yJa: null,
    });
    // Section + headers ship; each <ul> is empty but present (legacy parity).
    assert.ok(out.includes('<h3>AI に置き換わりやすい業務</h3>'));
    assert.ok(out.includes('<h3>人が残る業務</h3>'));
    const emptyUlCount = (out.match(/<ul><\/ul>/g) || []).length;
    assert.equal(emptyUlCount, 2);
  });

  test('horizon null omits the trailing <p class="ai-horizon">', () => {
    const out = renderAiRiskDetail({
      aiRisk: 5,
      rationaleLongJa: 'r',
      displaceableTasksJa: [],
      resilientTasksJa: [],
      horizon5yJa: null,
    });
    assert.ok(!out.includes('ai-horizon'));
    assert.ok(!out.includes('5-10 年展望'));
  });

  test('XSS payloads in rationale, tasks, and horizon are escaped', () => {
    const out = renderAiRiskDetail({
      aiRisk: 9,
      rationaleLongJa: '<script>r</script>',
      displaceableTasksJa: ['<img src=x>'],
      resilientTasksJa: ['<svg/>'],
      horizon5yJa: '<a href="x">h</a>',
    });
    assert.ok(!out.includes('<script>r</script>'));
    assert.ok(!out.includes('<img src=x>'));
    assert.ok(!out.includes('<svg/>'));
    assert.ok(!out.includes('<a href="x">h</a>'));
    assert.ok(out.includes('&lt;script&gt;'));
    assert.ok(out.includes('&lt;img src=x&gt;'));
    assert.ok(out.includes('&lt;svg/&gt;'));
    assert.ok(out.includes('&lt;a href=&quot;x&quot;&gt;'));
  });
});
