import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

const ROOT = process.cwd();
const ENV_GUIDANCE = readFileSync(join(ROOT, '.env.example'), 'utf8');
const FEEDBACK_SOURCE = readFileSync(join(ROOT, 'api/feedback.js'), 'utf8');
const SECURITY_SOURCE = readFileSync(join(ROOT, 'src/lib/api-security.js'), 'utf8');

function compact(value: string): string {
  return value
    .replace(/^[ \t]*(?:#|\/\/)\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('feedback production configuration guidance', () => {
  test('lists every production release value and the optional sender override', () => {
    for (const name of [
      'PUBLIC_TURNSTILE_SITE_KEY',
      'TURNSTILE_SECRET_KEY',
      'RESEND_API_KEY',
      'FEEDBACK_TO_EMAIL',
      'FEEDBACK_FROM_EMAIL',
    ]) {
      assert.match(ENV_GUIDANCE, new RegExp(`^${name}=$`, 'm'), `${name} must stay in .env.example`);
      assert.match(FEEDBACK_SOURCE, new RegExp(`//\\s+${name}\\s+—`), `${name} must stay in the endpoint header`);
    }

    const checklistMatch = ENV_GUIDANCE.match(
      /# Production feedback release requirements[\s\S]*?# Missing required[\s\S]*?sections below\./,
    );
    assert.ok(checklistMatch, 'production release checklist must stay present');
    const checklist = compact(checklistMatch[0]);
    assert.match(checklist, /Production feedback release requirements \(all except FROM are required\)/);
    for (const name of [
      'PUBLIC_TURNSTILE_SITE_KEY',
      'TURNSTILE_SECRET_KEY',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'RESEND_API_KEY',
      'FEEDBACK_TO_EMAIL',
    ]) {
      assert.match(checklist, new RegExp(`${name} —`), `${name} must stay in the release checklist`);
    }
    assert.match(checklist, /FEEDBACK_FROM_EMAIL — optional sender override/);
  });

  test('pins production failures and preview or development non-delivery behavior', () => {
    const env = compact(ENV_GUIDANCE);
    const feedback = compact(FEEDBACK_SOURCE);

    assert.match(
      env,
      /Production requires both this and RESEND_API_KEY:.*returns HTTP 503.*feedback_delivery_failed.*config_missing.*Preview\/development.*HTTP 202.*delivered: false/,
    );
    assert.match(
      env,
      /In production, a missing TURNSTILE_SECRET_KEY fails closed:.*HTTP 403.*turnstile_failed.*production_misconfigured.*preview\/development, a missing secret skips verification/i,
    );
    assert.match(
      env,
      /Production requires a valid HTTPS URL plus TOKEN;.*fails closed.*HTTP 429.*Preview\/development skips the quota/,
    );
    assert.match(
      feedback,
      /Production .* fails closed: missing Turnstile secret returns HTTP 403, while missing RESEND_API_KEY \/ FEEDBACK_TO_EMAIL or a Resend delivery failure returns HTTP 503.*Preview\/development.*HTTP 202 non-delivery result/,
    );
    assert.match(
      feedback,
      /Structured fallback summaries contain only bounded metadata; Resend failures log only a stable endpoint, HTTP status .* and internal code/,
    );
    assert.match(feedback, /A 202 response is not a delivered success/);
  });

  test('stays aligned with the existing fail-closed runtime branches', () => {
    assert.match(
      SECURITY_SOURCE,
      /if \(!secret\) \{[\s\S]*?if \(isProduction\(env\)\) \{[\s\S]*?production_misconfigured[\s\S]*?ok: true, skipped: true/,
    );
    assert.match(
      FEEDBACK_SOURCE,
      /if \(!apiKey \|\| !toEmail\) \{[\s\S]*?if \(inProd\) \{[\s\S]*?status: 503[\s\S]*?delivered: false[\s\S]*?status: 202/,
    );
  });

  test('rejects the previous unqualified degrade-open wording', () => {
    const operatorGuidance = `${ENV_GUIDANCE}\n${FEEDBACK_SOURCE}`;
    for (const stale of [
      /When unset, feedback is logged\s+but not emailed/i,
      /When TURNSTILE_SECRET_KEY is unset, verification is skipped\s+entirely/i,
      /Degrades\s+gracefully when secret env is missing/i,
      /frontend stays unblocked/i,
      /show ["']submit accepted["']/i,
      /Default is fail-open — a vendor outage/i,
      /Every diagnostic is\s+PII-safe and redacted/i,
    ]) {
      assert.doesNotMatch(operatorGuidance, stale);
    }
  });
});
