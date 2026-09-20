import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { bankerRound } from '../data/lib/banker-round.js';

const source = readFileSync('src/pages/_map-inline.js', 'utf8');

test('map prints every AI-impact score through fmtRisk — no raw ai_risk in text (design-1.21)', () => {
  // tooltip, bottom sheet label, list rows, sector mean, aria-labels
  assert.match(source, /\$ttRisk\.textContent = 'AI ' \+ fmtRisk\(r\.ai_risk\) \+ '\/10';/);
  assert.match(source, /var s = fmtRisk\(r\) \+ '\/10';/);
  assert.match(source, /meta\.textContent = recs\.length \+ ' 職業 ・ 平均 AI ' \+ fmtRisk\(sm\.mean_ai_risk\);/);
  assert.doesNotMatch(source, /\+ r\.ai_risk \+ '\/10'/);
  assert.doesNotMatch(source, /\(r\.ai_risk \|\| '\?'\) \+ '\/10/);
  assert.doesNotMatch(source, /\(d\.ai_risk != null \? d\.ai_risk : '\?'\)/);
  assert.doesNotMatch(source, /mean_ai_risk\.toFixed\(1\)/);
});

test("map fmtRisk is banker's rounding over the exact double, like displayScore() (design-1.21)", () => {
  const start = source.indexOf('function fmtRisk(v) {');
  const end = source.indexOf('\n    }\n', start) + '\n    }'.length;
  assert.ok(start > 0 && end > start, 'fmtRisk source not found');
  const fmtRisk = new Function(`${source.slice(start, end)}; return fmtRisk;`)() as (v: unknown) => string;
  for (const x of [4.266666666666667, 4.6000000000000005, 8.366666666666667, 0.15, 0.05, 52.25, 52.35, 9.433333333333334, 7.8999999999999995, 10, 0, 3]) {
    assert.equal(fmtRisk(x), String(bankerRound(x, 1)), `fmtRisk(${x})`);
  }
  assert.equal(fmtRisk(null), '—');
  assert.equal(fmtRisk(undefined), '—');
});
