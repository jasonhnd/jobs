import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

type HeaderRule = {
  source: string;
  headers?: Array<{ key: string; value: string }>;
};

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

function cacheControlFor(source: string): string | undefined {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers?: HeaderRule[] };
  const rule = cfg.headers?.find((entry) => entry.source === source);
  return rule?.headers?.find((header) => header.key.toLowerCase() === 'cache-control')?.value;
}

test('vercel.json gives hashed static asset paths immutable long-cache headers', () => {
  assert.equal(cacheControlFor('/_astro/(.*)'), IMMUTABLE_CACHE);
  assert.equal(cacheControlFor('/fonts/(.*)'), IMMUTABLE_CACHE);
});
