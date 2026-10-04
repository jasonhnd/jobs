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
const indexJs = read('_index-inline.js');

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

  // Fixed full-source baseline: guard the conversion and fallback as well as rounding.
  const indexFmtRiskBaseline = `function fmtRisk(v) {
const n = Number(v);
if (!Number.isFinite(n)) return "0";
const sign = n < 0 ? "-" : "";
const wide = Math.abs(n).toFixed(18); // 1 + 17 digits disambiguates any double
const dot = wide.indexOf(".");
if (dot === -1) return String(n);
const intStr = wide.slice(0, dot);
const frac = wide.slice(dot + 1);
const keep = frac.charAt(0);
const decisive = frac.charAt(1);
const tail = frac.slice(2);
let roundUp;
if (decisive < "5") roundUp = false;
else if (decisive > "5") roundUp = true;
else if (/[1-9]/.test(tail)) roundUp = true;
else roundUp = Number(keep) % 2 !== 0; // genuine halfway → round to even
const truncated = Number(sign + intStr + "." + keep);
if (!roundUp) return String(truncated);
const inc = n >= 0 ? truncated + 0.1 : truncated - 0.1;
return String(Number(inc.toFixed(1)));
}`;

  test('/ (_index-inline.js) fmtRisk matches its complete source baseline', () => {
    assert.equal(dedent(fnSource(indexJs, 'fmtRisk')), indexFmtRiskBaseline);
  });

  /** Compare all lines, allowing only the existing syntax and fallback differences. */
  const normaliseFmtRisk = (source: string): string => dedent(fnSource(source, 'fmtRisk'))
    .replace(/\/\/[^\n]*/g, '')
    .split('\n').map((line) => line.trim()).filter(Boolean).join('\n')
    .replace(/"/g, "'").replace(/\b(const|let)\b/g, 'var');

  test('/ (_index-inline.js) fmtRisk keeps the /me algorithm with its existing fallbacks', () => {
    const expected = normaliseFmtRisk(meJs)
      .replace("if (v == null) return '—';\n", '')
      .replace("if (!Number.isFinite(n)) return '—';", "if (!Number.isFinite(n)) return '0';");
    assert.equal(normaliseFmtRisk(indexJs), expected);
  });

  test('fmtRisk copies preserve null and non-finite fallbacks', () => {
    for (const [name, source] of [['_me-inline.js', meJs], ['_map-inline.js', mapJs], ['_shindan.js', shindanJs], ['compare/index.astro', compareAstro], ['_index-inline.js', indexJs]] as const) {
      const fmtRisk = load<(v: unknown) => string>(source, ['fmtRisk'], 'fmtRisk');
      for (const value of [null, NaN, Infinity, -Infinity]) {
        assert.equal(fmtRisk(value), name === '_index-inline.js' ? '0' : '—', `${name} fmtRisk(${value})`);
      }
    }
  });

  test('every fmtRisk copy rounds finite values identically (banker, half to even)', () => {
    const fns = [['_me-inline.js', meJs], ['_map-inline.js', mapJs], ['_shindan.js', shindanJs], ['compare/index.astro', compareAstro], ['_index-inline.js', indexJs]] as const;
    const impls = fns.map(([name, src]) => [name, load<(v: unknown) => string>(src, ['fmtRisk'], 'fmtRisk')] as const);
    const samples = [0, 0.05, 0.15, 0.25, 0.35, 0.45, 1.25, 3.95, 3.9666666666666663, 4.266666666666667, 6.966666666666667, 8.366666666666667, 8.25, 8.35, 10, -0.25, -3.95];
    for (const v of samples) {
      const expected = impls[0][1](v);
      for (const [name, fn] of impls) assert.equal(fn(v), expected, `${name} fmtRisk(${v})`);
    }
    assert.equal(impls[0][1](0.25), '0.2');
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
