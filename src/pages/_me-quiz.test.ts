import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

const meJs = readFileSync(join(import.meta.dirname, '_me-inline.js'), 'utf8');
const meAstro = readFileSync(join(import.meta.dirname, 'me.astro'), 'utf8');

describe('/me screen 2 quiz (#257)', () => {
  test('CTA sits after the ranking block and is hidden until a job is selected', () => {
    const ranksAt = meAstro.indexOf('id="meRanksHead"');
    const ctaAt = meAstro.indexOf('id="meQuizCta"');
    const similarAt = meAstro.indexOf('id="meSimilarHead"');
    assert.ok(ranksAt > 0 && ctaAt > ranksAt && similarAt > ctaAt);
    assert.match(meAstro, /id="meQuizCta" hidden/);
    assert.match(meAstro, /id="meQuiz" hidden/);
    assert.match(meAstro, /9問で確かめる/);
  });

  test('does not auto-open the quiz when a job is selected', () => {
    assert.match(meJs, /function resetQuizForJob/);
    assert.match(meJs, /\$quiz\.hidden = true/);
    assert.match(meJs, /\$quizCta\.hidden = false/);
    assert.match(meJs, /renderSimilar\(pos\);\s*resetQuizForJob\(\);/);
    assert.doesNotMatch(meJs, /renderResults\(pos\);[^\n]*openQuiz/);
  });

  test('shindan_start fires on the CTA, not on job select', () => {
    assert.match(meJs, /\$quizOpen\.addEventListener\('click', openQuiz\)/);
    assert.match(meJs, /function openQuiz[\s\S]*ga\('shindan_start'\)/);
    assert.doesNotMatch(meJs, /function selectJob[\s\S]{0,400}shindan_start/);
  });

  test('same majority scorer as /shindan: leftCount >= 2', () => {
    assert.match(meJs, /leftCount >= 2 \? cfg\.leftPole : cfg\.rightPole/);
    const shindan = readFileSync(join(import.meta.dirname, '_shindan.js'), 'utf8');
    assert.match(shindan, /leftCount >= 2 \? cfg\.leftPole : cfg\.rightPole/);
  });

  test('does not render the identity result card', () => {
    assert.doesNotMatch(meAstro, /shindanFamilyName|あなたのタイプ/);
    assert.doesNotMatch(meJs, /family\.identity|personalType/);
  });
});
