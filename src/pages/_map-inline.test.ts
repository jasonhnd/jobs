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

function extractFunction(name: string): string {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start > 0, name);
  let depth = 0;
  let seen = false;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') {
      depth += 1;
      seen = true;
    } else if (source[i] === '}') {
      depth -= 1;
      if (seen && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

test('a legitimate AI impact of 0 stays in band 0; only null falls back to 5 (#886)', () => {
  const riskBand5 = new Function(`${extractFunction('fmtRisk')}\n${extractFunction('riskBand5')}\nreturn riskBand5;`)() as (v: unknown) => number;
  assert.equal(riskBand5(0), 0);
  assert.equal(riskBand5(5), 2);

  const expressions = ['cell.dataset.band', 'cell.style.background = colorForRisk', 'sw.style.background', 'mergedRiskSum +=']
    .map((needle) => {
      const line = source.split('\n').find((entry) => entry.includes(needle));
      assert.ok(line, needle);
      assert.match(line!, /ai_risk \?\? 5/);
      assert.doesNotMatch(line!, /ai_risk \|\| 5/);
      const arg = /ai_risk \?\? 5/.exec(line!)![0];
      return arg;
    });
  const paint = new Function('r', 'return r.ai_risk ?? 5;') as (r: { ai_risk: unknown }) => number;
  assert.equal(riskBand5(paint({ ai_risk: 0 })), 0);
  assert.equal(riskBand5(paint({ ai_risk: null })), 2);
  assert.equal(riskBand5(paint({ ai_risk: undefined })), 2);
  assert.equal(expressions.length, 4);
});

test('map search: clearing the box empties the list and late responses are dropped (#884)', () => {
  const start = source.indexOf("$searchInput.addEventListener('input', function () {");
  const end = source.indexOf("$searchInput.addEventListener('blur'", start);
  const body = source.slice(start, end);
  assert.match(body, /if \(!q\.trim\(\)\) \{[^}]*renderSuggest\(\[\]\);/);
  assert.match(body, /var seq = \+\+searchSeq;/);
  assert.match(body, /if \(seq !== searchSeq\) return;/);
  assert.match(body, /\.catch\(function \(err\) \{/);
});
