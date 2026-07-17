import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

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
