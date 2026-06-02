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

  test('single row: risk-pill + name + workers count', () => {
    const out = renderSectorOccupationTopList([
      { id: 1, titleJa: '看護師', aiRisk: 4, workers: 1_500_000 },
    ]);
    assert.equal(
      out,
      '<ul class="top-list">' +
        '<li><a href="/1">' +
        '<span class="risk-pill mid">4/10</span>' +
        '看護師' +
        '</a>' +
        '<span class="meta">1,500,000 就業者</span>' +
        '</li>' +
        '</ul>',
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
    assert.ok(out.includes('>#99</a>'));
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
  test('empty array still emits the <ul class="full-list"></ul> wrapper (legacy parity)', () => {
    assert.equal(renderSectorOccupationFullList([]), '<ul class="full-list"></ul>');
  });

  test('single row: risk-pill + name; NO workers chip', () => {
    const out = renderSectorOccupationFullList([
      { id: 1, titleJa: '看護師', aiRisk: 4 },
    ]);
    assert.ok(out.includes('<span class="risk-pill mid">4/10</span>看護師'));
    assert.ok(!out.includes('就業者'));
    assert.ok(!out.includes('meta'));
  });

  test('preserves order across many rows', () => {
    const out = renderSectorOccupationFullList(
      Array.from({ length: 10 }, (_, i) => ({
        id: i + 1, titleJa: `r${i + 1}`, aiRisk: 5,
      })),
    );
    const liCount = (out.match(/<li>/g) || []).length;
    assert.equal(liCount, 10);
    assert.ok(out.indexOf('r1<') < out.indexOf('r10<'));
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
