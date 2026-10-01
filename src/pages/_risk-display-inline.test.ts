/**
 * _risk-display-inline.test.ts — browser scripts and OG cards print the
 * one-decimal public value and band it on that same value (#631).
 *
 * The projections store raw three-vendor means (4.266666666666667); every
 * visible number goes through fmtRisk (a byte-for-byte port of
 * displayScore) and every band / label word is judged on Number(fmtRisk(x)).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

const read = (rel: string): string => readFileSync(join(import.meta.dirname, rel), 'utf8');

const meJs = read('_me-inline.js');
const mapJs = read('_map-inline.js');
const shindanJs = read('_shindan.js');
const compareAstro = read('compare/index.astro');

/** Source of `function <name>(` through the closing brace at the same indent. */
function fnSource(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} not found`);
  const lineStart = source.lastIndexOf('\n', start) + 1;
  const indent = source.slice(lineStart, start);
  const firstLineEnd = source.indexOf('\n', start);
  const firstLine = source.slice(start, firstLineEnd);
  if (firstLine.trimEnd().endsWith('}')) return firstLine; // one-liner
  const close = source.indexOf(`\n${indent}}`, start);
  assert.ok(close > start, `${name} end not found`);
  return source.slice(start, close + indent.length + 2);
}

function dedent(fn: string): string {
  return fn.split('\n').map((line) => line.trimStart()).join('\n');
}

function load<T>(source: string, names: readonly string[], ret: string): T {
  const body = names.map((name) => fnSource(source, name)).join('\n');
  return new Function(`${body}; return ${ret};`)() as T;
}

type Band = (v: unknown) => string | null;
type Label = (v: unknown) => string;

describe('browser scripts print and band the displayed value (#631)', () => {
  test('every fmtRisk copy is the /me original', () => {
    const original = dedent(fnSource(meJs, 'fmtRisk'));
    for (const [name, source] of [['_map-inline.js', mapJs], ['_shindan.js', shindanJs], ['compare/index.astro', compareAstro]] as const) {
      assert.equal(dedent(fnSource(source, 'fmtRisk')), original, name);
    }
  });

  test('/me: band and label follow the printed value', () => {
    const riskBand = load<Band>(meJs, ['fmtRisk', 'riskBand'], 'riskBand');
    const riskLabel = load<Label>(meJs, ['fmtRisk', 'riskBand', 'riskLabel'], 'riskLabel');
    assert.equal(riskBand(3.9666666666666663), 'mid');
    assert.equal(riskBand(6.966666666666667), 'high');
    assert.equal(riskBand(3.9333333333333336), 'low');
    assert.equal(riskBand(null), null);
    assert.equal(riskLabel(3.9666666666666663), '4/10 ▼ 中程度');
    assert.equal(riskLabel(4.266666666666667), '4.3/10 ▼ 中程度');
    assert.equal(riskLabel(null), '—');
  });

  test('/map: tooltip class and label follow the printed value', () => {
    const riskClass = load<Band>(mapJs, ['fmtRisk', 'riskClass'], 'riskClass');
    const riskLabel = load<Label>(mapJs, ['fmtRisk', 'riskLabel'], 'riskLabel');
    assert.equal(riskClass(3.9666666666666663), 'mid');
    assert.equal(riskClass(6.966666666666667), 'high');
    assert.equal(riskClass(3.9333333333333336), 'low');
    assert.equal(riskClass(null), 'low'); // unchanged from before #631
    assert.equal(riskLabel(3.9666666666666663), '4/10 ▼ 中程度');
    assert.equal(riskLabel(8.966666666666667), '9/10 ▲ 大きく変わる仕事');
    assert.equal(riskLabel(6.966666666666667), '7/10 ▲ 影響大');
  });

  test('/shindan and /compare: suggestion pills print one decimal and band it', () => {
    for (const [name, source] of [['_shindan.js', shindanJs], ['compare/index.astro', compareAstro]] as const) {
      const riskBand = load<Band>(source, ['fmtRisk', 'riskBand'], 'riskBand');
      assert.equal(riskBand(3.9666666666666663), 'mid', name);
      assert.equal(riskBand(6.966666666666667), 'high', name);
      assert.equal(riskBand(3.9333333333333336), 'low', name);
      assert.equal(riskBand(null), 'mid', name);
    }
    assert.match(shindanJs, /'AI ' \+ \(doc\.ai_risk != null \? fmtRisk\(doc\.ai_risk\) : '\?'\) \+ '\/10'/);
    assert.doesNotMatch(shindanJs, /\? doc\.ai_risk : '\?'/);
    assert.match(shindanJs, /return fmtRisk\(value\) \+ '\/10';/);
    assert.doesNotMatch(shindanJs, /return value \+ '\/10';/);
    assert.match(compareAstro, /'AI ' \+ fmtRisk\(o\.ai_risk\) \+ '\/10'/);
    assert.doesNotMatch(compareAstro, /'AI ' \+ o\.ai_risk \+ '\/10'/);
  });
});

describe('OG cards print the displayed value (#631)', () => {
  const ogOccupation = read('../lib/og-renderers/occupation.ts');
  const ogWorktype = read('../lib/og-renderers/worktype.ts');
  const ogSector = read('../lib/og-renderers/sector.ts');

  test('occupation card: one decimal, never the raw mean', () => {
    assert.match(ogOccupation, /String\(displayScore\(risk\)\)/);
    assert.doesNotMatch(ogOccupation, /String\(risk\)/);
  });

  test('shindan share card: one decimal, never the raw mean', () => {
    assert.match(ogWorktype, /String\(displayScore\(score\)\)/);
    assert.doesNotMatch(ogWorktype, /String\(score\)/);
  });

  test('sector card: the mean printed with the same rounding as /sectors', () => {
    assert.match(ogSector, /displayScore\(sector\.mean_ai_risk\)\.toFixed\(1\)/);
  });
});
