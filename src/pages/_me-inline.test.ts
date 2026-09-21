import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { bankerRound } from '../data/lib/banker-round.js';

test('/me renders global and eligible ranking universes with distinct wording', () => {
  const source = readFileSync(join(import.meta.dirname, '_me-inline.js'), 'utf8');

  assert.match(source, /universe_scope === 'all' \? '全 ' : '対象 '/);
  assert.match(source, /universeLabel \+ universe \+ ' 中 '/);
});

test('/me chips call rankMatches then selectJob, with input fallback', () => {
  const source = readFileSync(join(import.meta.dirname, '_me-inline.js'), 'utf8');
  assert.match(source, /function wireChips\(/);
  assert.match(source, /rankMatches\(label\)/);
  assert.match(source, /selectJob\(matches\[0\]\.id\)/);
  assert.match(source, /fillInputFallback\(label\)/);
  assert.match(source, /wireChips\(\);/);
});

test('/me prints every AI-impact score through fmtRisk (design-1.21)', () => {
  const source = readFileSync(join(import.meta.dirname, '_me-inline.js'), 'utf8');
  assert.equal((source.match(/fmtRisk\((d|r2)\.ai_risk\) \+ '\/10'/g) ?? []).length, 2);
  assert.doesNotMatch(source, /\+ r2\.ai_risk \+ '\/10'/);
  assert.doesNotMatch(source, /\(d\.ai_risk != null \? d\.ai_risk : '\?'\)/);
  const start = source.indexOf('function fmtRisk(v) {');
  const end = source.indexOf('\n    }\n', start) + '\n    }'.length;
  const fmtRisk = new Function(`${source.slice(start, end)}; return fmtRisk;`)() as (v: unknown) => string;
  for (const x of [4.266666666666667, 8.366666666666667, 52.25, 0.15, 10]) {
    assert.equal(fmtRisk(x), String(bankerRound(x, 1)), `fmtRisk(${x})`);
  }
  assert.equal(fmtRisk(null), '—');
});
