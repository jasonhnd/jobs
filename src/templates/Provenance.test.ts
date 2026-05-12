/**
 * Provenance.test.ts — pin the byte-for-byte output of the provenance
 * template extracted from [id].astro.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderProvenance } from './Provenance.js';

describe('renderProvenance', () => {
  test('all four fields null returns empty SafeHtml (no empty <p>)', () => {
    assert.equal(
      renderProvenance({
        aiModel: null,
        aiScoredAt: null,
        ipdNumeric: null,
        ipdDescription: null,
      }),
      '',
    );
  });

  test('AI fields present + IPD numeric present renders both bullets', () => {
    const out = renderProvenance({
      aiModel: 'claude-opus-4-7',
      aiScoredAt: '2026-04-25T00:00:00Z',
      ipdNumeric: 'v7.00',
      ipdDescription: null,
    });
    assert.equal(
      out,
      '<p class="provenance">' +
        'AI 影響度 — モデル <code>claude-opus-4-7</code> · ' +
        'スコア取得 <code>2026-04-25</code> · ' +
        'データ — 厚労省 / JILPT IPD <code>v7.00</code>' +
        '</p>',
    );
  });

  test('AI scored_at truncated to first 10 chars (YYYY-MM-DD)', () => {
    const out = renderProvenance({
      aiModel: 'm',
      aiScoredAt: '2026-04-25T13:45:00Z',
      ipdNumeric: null,
      ipdDescription: null,
    });
    assert.ok(out.includes('<code>2026-04-25</code>'));
    assert.ok(!out.includes('T13:45'));
  });

  test('AI bullet only (no IPD version)', () => {
    const out = renderProvenance({
      aiModel: 'm',
      aiScoredAt: '2026-04-25',
      ipdNumeric: null,
      ipdDescription: null,
    });
    assert.equal(
      out,
      '<p class="provenance">' +
        'AI 影響度 — モデル <code>m</code> · スコア取得 <code>2026-04-25</code>' +
        '</p>',
    );
  });

  test('IPD numeric fallback to ipdDescription when numeric missing', () => {
    const out = renderProvenance({
      aiModel: null,
      aiScoredAt: null,
      ipdNumeric: null,
      ipdDescription: 'v6.50',
    });
    assert.equal(
      out,
      '<p class="provenance">' +
        'データ — 厚労省 / JILPT IPD <code>v6.50</code>' +
        '</p>',
    );
  });

  test('escapes XSS in version + model strings', () => {
    const out = renderProvenance({
      aiModel: '<script>',
      aiScoredAt: '2026-04-25',
      ipdNumeric: 'v"7"',
      ipdDescription: null,
    });
    assert.ok(out.includes('&lt;script&gt;'));
    assert.ok(out.includes('v&quot;7&quot;'));
    assert.ok(!out.includes('<script>'));
  });
});
