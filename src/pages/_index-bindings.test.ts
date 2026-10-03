import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadHomeBodyHtml, HOME_JSON_LD } from './_index-bindings.ts';

describe('_index-bindings', () => {
  test('home body has every placeholder substituted', async () => {
    const html = await loadHomeBodyHtml();
    assert.ok(html.length > 0);
    assert.ok(!html.includes('__HOME_MOVERS__'));
  });

  test('home JSON-LD resolves the occupation-count token and parses', () => {
    assert.ok(!HOME_JSON_LD.includes('__OCCUPATION_COUNT_SCORED__'));
    assert.doesNotThrow(() => JSON.parse(HOME_JSON_LD));
  });
});
