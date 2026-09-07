/**
 * SectorListings.test.ts — pin the three sector hub list templates.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  renderSectorOccupationTopList,
  renderSectorOccupationFullList,
  renderRelatedSectorsList,
} from './SectorListings.js';

describe('renderSectorOccupationTopList', () => {
  test('empty array returns empty SafeHtml', () => {
    assert.equal(renderSectorOccupationTopList([]), '');
  });

  test('single row: §3.3 whole-row tap + workers in rl-meta', () => {
    const out = renderSectorOccupationTopList([
      { id: 1, titleJa: '看護師', aiRisk: 4, workers: 1_500_000 },
    ]);
    assert.equal(
      out,
      '<ol class="rank-list">' +
        '<li>' +
        '<a class="rl-row" href="/1" data-track-event="list_row_click">' +
        '<span class="rl-main">' +
        '<span class="rl-name">看護師</span>' +
        '<span class="rl-meta"><span class="rl-workers">1,500,000 就業者</span></span>' +
        '</span>' +
        '<span class="rl-end">' +
        '<span class="risk-pill mid">4/10</span>' +
        '<span class="rl-chevron" aria-hidden="true">›</span>' +
        '</span>' +
        '</a>' +
        '</li>' +
        '</ol>',
    );
  });

  test('null aiRisk → em-dash + band-mid (riskClass null default)', () => {
    const out = renderSectorOccupationTopList([
      { id: 1, titleJa: 'x', aiRisk: null, workers: 100 },
    ]);
    assert.ok(out.includes('risk-pill mid'));
    assert.ok(out.includes('—'));
  });

  test('risk-pill bands: 0-3 low / 4-6 mid / 7-10 high', () => {
    const items = [0, 3, 4, 6, 7, 10].map((r, i) => ({
      id: i + 1, titleJa: `r${r}`, aiRisk: r, workers: 0,
    }));
    const out = renderSectorOccupationTopList(items);
    assert.ok(out.match(/risk-pill low.>0\/10/));
    assert.ok(out.match(/risk-pill low.>3\/10/));
    assert.ok(out.match(/risk-pill mid.>4\/10/));
    assert.ok(out.match(/risk-pill mid.>6\/10/));
    assert.ok(out.match(/risk-pill high.>7\/10/));
    assert.ok(out.match(/risk-pill high.>10\/10/));
  });

  test('missing titleJa falls back to "#id"', () => {
    const out = renderSectorOccupationTopList([
      { id: 99, titleJa: '', aiRisk: 5, workers: 0 },
    ]);
    assert.ok(out.includes('<span class="rl-name">#99</span>'));
  });

  test('whole-row anchor is the only link and carries list_row_click', () => {
    const out = renderSectorOccupationTopList([
      { id: 7, titleJa: '看護師', aiRisk: 3, workers: 100 },
    ]);
    assert.equal([...out.matchAll(/<a /g)].length, 1);
    assert.match(out, /<a class="rl-row" href="\/7" data-track-event="list_row_click">/);
  });

  test('XSS in title escaped', () => {
    const out = renderSectorOccupationTopList([
      { id: 1, titleJa: '<script>', aiRisk: 5, workers: 100 },
    ]);
    assert.ok(out.includes('&lt;script&gt;'));
    assert.ok(!out.includes('<script>'));
  });
});

describe('renderSectorOccupationFullList', () => {
  test('empty array still emits the <ol class="rank-list"></ol> wrapper', () => {
    assert.equal(renderSectorOccupationFullList([]), '<ol class="rank-list"></ol>');
  });

  test('single row: §3.3 atom; NO workers chip', () => {
    const out = renderSectorOccupationFullList([
      { id: 1, titleJa: '看護師', aiRisk: 4 },
    ]);
    assert.match(out, /<a class="rl-row" href="\/1" data-track-event="list_row_click">/);
    assert.match(out, /<span class="rl-name">看護師<\/span>/);
    assert.match(out, /<span class="risk-pill mid">4\/10<\/span>/);
    assert.equal(out.includes('就業者'), false);
    assert.equal(out.includes('rl-meta'), false);
    assert.equal(out.includes('class="rl-name" href='), false);
  });

  test('preserves order across many rows', () => {
    const out = renderSectorOccupationFullList(
      Array.from({ length: 10 }, (_, i) => ({
        id: i + 1, titleJa: `r${i + 1}`, aiRisk: 5,
      })),
    );
    const liCount = (out.match(/<li>/g) || []).length;
    assert.equal(liCount, 10);
    assert.ok(out.indexOf('>r1<') < out.indexOf('>r10<'));
  });
});

describe('renderRelatedSectorsList', () => {
  test('empty array still emits the <ul class="related-sectors"></ul> wrapper', () => {
    assert.equal(renderRelatedSectorsList([]), '<ul class="related-sectors"></ul>');
  });

  test('single row: link + ja-name + occupation count', () => {
    const out = renderRelatedSectorsList([
      { id: 'healthcare', nameJa: '医療', occupationCount: 25 },
    ]);
    assert.equal(
      out,
      '<ul class="related-sectors">' +
        '<li>' +
        '<a href="/sectors/healthcare">' +
        '<span class="ja-name">医療</span>' +
        '<span class="count">25 職業</span>' +
        '</a>' +
        '</li>' +
        '</ul>',
    );
  });

  test('XSS in id + nameJa escaped', () => {
    const out = renderRelatedSectorsList([
      { id: 'x"><script>', nameJa: '<script>', occupationCount: 1 },
    ]);
    assert.ok(out.includes('&lt;script&gt;'));
    assert.ok(!out.includes('"><script>'));
  });
});
