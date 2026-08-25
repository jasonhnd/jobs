import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

type HeaderKV = { key: string; value: string };
type HeaderHas = { type: string; value: string };
type HeaderRule = {
  source: string;
  has?: HeaderHas[];
  headers?: HeaderKV[];
};

const PREVIEW_HOST = 'pre.mirai-shigoto.com';

function headerRules(): HeaderRule[] {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers?: HeaderRule[] };
  return cfg.headers ?? [];
}

function robotsTag(rule: HeaderRule): string | undefined {
  return rule.headers?.find((header) => header.key.toLowerCase() === 'x-robots-tag')?.value;
}

test('preview alias is host-gated noindex; production catch-all is not', () => {
  const rules = headerRules();

  const preview = rules.find(
    (rule) =>
      rule.source === '/(.*)' &&
      rule.has?.length === 1 &&
      rule.has[0]?.type === 'host' &&
      rule.has[0]?.value === PREVIEW_HOST,
  );
  assert.ok(preview, `missing host-gated header rule for ${PREVIEW_HOST}`);
  assert.equal(robotsTag(preview), 'noindex, nofollow');

  const production = rules.find((rule) => rule.source === '/(.*)' && !rule.has);
  assert.ok(production, 'missing unconditioned /(.*) security/CSP rule');
  assert.equal(robotsTag(production), undefined);

  const unconditionedNoindex = rules.filter(
    (rule) => !rule.has && robotsTag(rule)?.toLowerCase().includes('noindex'),
  );
  assert.deepEqual(unconditionedNoindex, []);
});
