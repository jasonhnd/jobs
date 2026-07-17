import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

test('/me renders global and eligible ranking universes with distinct wording', () => {
  const source = readFileSync(join(import.meta.dirname, '_me-inline.js'), 'utf8');

  assert.match(source, /universe_scope === 'all' \? '全 ' : '対象 '/);
  assert.match(source, /universeLabel \+ universe \+ ' 中 '/);
});
