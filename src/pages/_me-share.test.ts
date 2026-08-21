import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

const meJs = readFileSync(join(import.meta.dirname, '_me-inline.js'), 'utf8');
const meAstro = readFileSync(join(import.meta.dirname, 'me.astro'), 'utf8');
const shindanJs = readFileSync(join(import.meta.dirname, '_shindan.js'), 'utf8');

describe('/me and /shindan measurement-led share (#237)', () => {
  test('/me shows a share control after the score, hidden until a job is selected', () => {
    const statsAt = meAstro.indexOf('id="meStatRisk"');
    const shareAt = meAstro.indexOf('id="meShare"');
    const quizAt = meAstro.indexOf('id="meQuizCta"');
    assert.ok(statsAt > 0 && shareAt > statsAt && quizAt > shareAt);
    assert.match(meAstro, /id="meShare" hidden/);
    assert.match(meAstro, /この数字をシェア/);
  });

  test('/me share text uses the job score, not the type name', () => {
    assert.match(meJs, /textTemplateWithJob/);
    assert.match(meJs, /function currentSharePayload/);
    assert.match(meJs, /pos\.summary\.aiRisk \+ '\/10'/);
    assert.match(meJs, /ga\('share_click'/);
    assert.doesNotMatch(meJs, /私は【/);
  });

  test('/shindan share switches to the job template when a score is known', () => {
    assert.match(shindanJs, /function fillShareTemplate/);
    assert.match(shindanJs, /textTemplateWithJob/);
    assert.match(shindanJs, /AI影響度は/);
  });
});
