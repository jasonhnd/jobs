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
  assert.match(source, /return d\.ai_risk != null \? fmtRisk\(d\.ai_risk\) \+ "\/10" : "";/);
  assert.match(source, /const scoreLabel = \(rec\.ai_risk != null\) \? fmtRisk\(rec\.ai_risk\) : "—";/);
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

test('home treemap labels take the per-band foreground from :root (§2.3 タイル前景)', () => {
  assert.match(source, /const MAP_LABEL_FG = \[0, 1, 2, 3, 4\]\.map\(i => readRootToken\("--risk-fg-" \+ i, "#FFFFFF"\)\);/);
  assert.match(source, /ctx\.fillStyle = labelFg;/);
  assert.doesNotMatch(source, /rgba\(255,255,255,0\.92\)/);
  assert.doesNotMatch(source, /rgba\(255,255,255,0\.55\)/);
});
