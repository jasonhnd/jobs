import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { bankerRound } from '../data/lib/banker-round.js';

const source = readFileSync('src/pages/_index-inline.js', 'utf8');

test('home screen-reader fallback list is capped and links to the full map list', () => {
  assert.match(source, /const SR_FALLBACK_LIMIT = 120;/);
  assert.match(source, /data\.slice\(0, SR_FALLBACK_LIMIT\)/);
  assert.match(source, /href="\/map\?view=list"/);
  assert.doesNotMatch(source, /data\.slice\(0, __OCCUPATION_COUNT_SCORED__\)/);
});

test('home autocomplete ignores selection keys during IME composition', () => {
  assert.match(source, /if \(e\.isComposing \|\| e\.keyCode === 229\) return;/);
  const guard = source.indexOf('if (e.isComposing || e.keyCode === 229) return;');
  const enter = source.indexOf('e.key === "Enter"', guard);
  assert.ok(guard >= 0 && enter > guard);
});

test('home reapplies only the latest queued query before the loaded treemap is rendered', () => {
  assert.match(source, /let pendingSearchQuery = "";/);
  assert.match(source, /pendingSearchQuery = v;/);
  const finish = source.indexOf('function finishDesktopTreemapLoad(rows)');
  const reapply = source.indexOf('applyFilter(pendingSearchQuery, true);', finish);
  const resize = source.indexOf('resize();', reapply);
  assert.ok(finish >= 0 && reapply > finish && resize > reapply);
});

test('home shows one decimal everywhere a score is printed, via fmtRisk (design-1.21)', () => {
  // The treemap tile sub-info and the TOP10 pill both go through fmtRisk.
  assert.match(source, /const scoreLabel = \(rec\.ai_risk != null\) \? fmtRisk\(rec\.ai_risk\) : "—";/);
  // The hover tooltip's AI リスク row (was `d.ai_risk + "/10"` — 4.266666666666667/10 on screen).
  assert.match(source, /\? fmtRisk\(d\.ai_risk\) \+ "\/10" \+ \(riskPctTop/);
  assert.doesNotMatch(source, /[^t]\bd\.ai_risk \+ "\/10"/);
  assert.doesNotMatch(source, /score\.toFixed\(1\)/);
  // The dead raw-float spans are gone (they only ever hid behind :has()).
  assert.doesNotMatch(source, /class="num"/);
  assert.doesNotMatch(source, /class="denom"/);
});

test('home fmtRisk is banker\'s rounding over the exact double, like displayScore() (design-1.21)', () => {
  const start = source.indexOf('function fmtRisk(v) {');
  const end = source.indexOf('\n      }\n', start) + '\n      }'.length;
  assert.ok(start > 0 && end > start, 'fmtRisk source not found');
  const fmtRisk = new Function(`${source.slice(start, end)}; return fmtRisk;`)() as (v: unknown) => string;
  const cases = [4.6000000000000005, 8.366666666666667, 0.15, 0.05, 52.25, 52.35, 66.55, 61.85000000000001, 9.433333333333334, 7.8999999999999995, 10, 0, 3];
  for (const x of cases) {
    assert.equal(fmtRisk(x), String(bankerRound(x, 1)), `fmtRisk(${x})`);
  }
  assert.equal(fmtRisk('abc'), '0');
  assert.equal(fmtRisk(null), '0');
});

test('home treemap tiles are drawn like /map cells: 2px gap, 6px corners, 12px/600 label, whole name or nothing (§5.7)', () => {
  assert.match(source, /const MARGIN = 4, GAP = 2, TILE_RADIUS = 6, TILE_PAD_X = 8, TILE_PAD_Y = 6;/);
  assert.match(source, /const TILE_FONT = "600 12px " \+ \(readRootToken\("--font-sans"/);
  assert.match(source, /ctx\.measureText\(label\)\.width <= rw - TILE_PAD_X \* 2/);
  assert.doesNotMatch(source, /ctx\.clip\(\)/); // no clipped labels any more
  assert.doesNotMatch(source, /function tileSubInfo/); // the value lives in the tooltip
});

test('home chip buttons and client TOP 10 cards keep native roles', () => {
  const html = readFileSync('src/index-source.html', 'utf8');
  const chipGroups = [
    html.slice(html.indexOf('<div class="desktop-hero-chips">'), html.indexOf('</div>', html.indexOf('<div class="desktop-hero-chips">'))),
    html.slice(html.indexOf('<div class="mobile-hero-chips">'), html.indexOf('</div>', html.indexOf('<div class="mobile-hero-chips">'))),
  ];
  assert.equal(chipGroups.join('\n').match(/<button\b/g)?.length, 10);
  for (const group of chipGroups) {
    assert.doesNotMatch(group, /role=/);
    assert.match(group, /<button type="button"/);
  }
  const track = html.slice(html.indexOf('<div class="m-top10-track"'), html.indexOf('>', html.indexOf('<div class="m-top10-track"')));
  assert.equal(track, '<div class="m-top10-track" id="mTop10Track"');
  assert.match(html, /<ul class="risk-distribution" role="list">/);
  assert.match(html, /<ul class="search-suggest" id="searchSuggest" role="listbox"/);

  const card = source.indexOf("'<a class=\"m-top10-card\" href=\"' + href + '\">'");
  assert.ok(card > 0, 'TOP 10 card template missing');
  assert.doesNotMatch(source, /m-top10-card" role="listitem"/);
  assert.doesNotMatch(source, /role="listitem"/);
});

test('home treemap labels take the per-band foreground from :root (§2.3 タイル前景)', () => {
  assert.match(source, /const MAP_LABEL_FG = \[0, 1, 2, 3, 4\]\.map\(i => readRootToken\("--risk-fg-" \+ i, "#FFFFFF"\)\);/);
  assert.match(source, /ctx\.fillStyle = labelFg;/);
  assert.doesNotMatch(source, /rgba\(255,255,255,0\.92\)/);
  assert.doesNotMatch(source, /rgba\(255,255,255,0\.55\)/);
});

test('home search never falls back to treemap rows, so aliases keep matching (#884)', () => {
  const start = source.indexOf('function searchRows() {');
  const body = source.slice(start, source.indexOf('}', start));
  assert.doesNotMatch(body, /: data/);
  assert.match(source, /function ensureSearchData\(\) \{\n\s+if \(searchData\.length\) return Promise\.resolve\(searchData\);/);
});

test('home tooltip percentile: the top occupation is 上位 1%, never 上位 0% (#884)', () => {
  const start = source.indexOf('function pctTop(v, arr) {');
  assert.ok(start > 0, 'pctTop not found');
  const end = source.indexOf('\n      }\n', start) + '\n      }'.length;
  const pctTop = new Function(`${source.slice(start, end)}; return pctTop;`)() as (v: unknown, arr: number[]) => number | null;
  const arr = Array.from({ length: 556 }, (_, i) => i / 10);
  assert.equal(pctTop(arr[555], arr), 1);
  assert.equal(pctTop(arr[0], arr), 100);
  assert.equal(pctTop(2, [1, 2, 2, 3]), 75);
  assert.equal(pctTop(null, arr), null);
  assert.equal(pctTop(1, []), null);
  assert.doesNotMatch(source, /100 - pctRank\(/);
});

test('home ?q= reaches GA4 only through sanitizeSearchQuery (#884)', () => {
  const start = source.indexOf('function handleSearchActionQuery() {');
  const end = source.indexOf('// Chip click', start);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /query: query\.slice\(0, 100\)/);
  assert.equal(body.match(/query: sanitizeSearchQuery\(query\)/g)?.length, 2);
});

test('home ?q= is still copied into the search box when data.search.json fails (#884)', () => {
  const start = source.indexOf('function handleSearchActionQuery() {');
  const end = source.indexOf('// Chip click', start);
  const body = source.slice(start, end);
  const catchAt = body.indexOf('.catch(err => {');
  assert.ok(catchAt > 0);
  assert.match(body.slice(catchAt, catchAt + 300), /prefillSearchInputs\(query\)/);
});

test('home keeps #loadingState until the treemap has rendered, so showError can use it (#884)', () => {
  const start = source.indexOf('function finishDesktopTreemapLoad(rows) {');
  const end = source.indexOf('function loadDesktopTreemap()', start);
  const body = source.slice(start, end);
  const removeAt = body.indexOf('ls.remove()');
  const resizeAt = body.indexOf('resize();');
  assert.ok(removeAt > resizeAt && resizeAt > 0, 'loading state must be removed after resize()');
});
