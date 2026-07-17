import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

const diagnosticSource = readFileSync('src/pages/_shindan.js', 'utf8');
const mapSource = readFileSync('src/pages/_map-inline.js', 'utf8');

test('diagnostic occupation picker ignores selection keys during IME composition', () => {
  const keydown = diagnosticSource.indexOf("$jobInput.addEventListener('keydown'");
  const guard = diagnosticSource.indexOf('if (e.isComposing || e.keyCode === 229) return;', keydown);
  const enter = diagnosticSource.indexOf("e.key === 'Enter'", keydown);
  assert.ok(keydown >= 0 && guard > keydown && enter > guard);
});

test('map list view round-trips through URL state and synchronizes its toggle', () => {
  assert.match(mapSource, /view:\s+p\.get\('view'\) === 'list' \? 'list' : 'map'/);
  assert.match(mapSource, /if \(listMode\) p\.set\('view', 'list'\);/);
  assert.match(mapSource, /listMode = s\.view === 'list';\s+syncViewToggleState\(\);/);
  assert.match(mapSource, /aria-pressed', listMode \? 'true' : 'false'/);

  const toggle = mapSource.indexOf("$viewToggle.addEventListener('click'");
  const write = mapSource.indexOf('writeUrlState();', toggle);
  assert.ok(toggle >= 0 && write > toggle);
});

test('map autocomplete also preserves active IME composition', () => {
  const keydown = mapSource.indexOf("$searchInput.addEventListener('keydown'");
  const guard = mapSource.indexOf('if (e.isComposing || e.keyCode === 229) return;', keydown);
  const enter = mapSource.indexOf("e.key === 'Enter'", keydown);
  assert.ok(keydown >= 0 && guard > keydown && enter > guard);
});
