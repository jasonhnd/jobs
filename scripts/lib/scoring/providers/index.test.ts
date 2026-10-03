// Provider registry lookup. Resolving a name does not call a model.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { PROVIDERS, getProvider } from './index.js';

describe('getProvider', () => {
  test('returns the registered provider object', () => {
    assert.equal(getProvider('codex'), PROVIDERS.codex);
    assert.equal(getProvider('grok-cli'), PROVIDERS['grok-cli']);
    assert.equal(getProvider('in-agent'), PROVIDERS['in-agent']);
  });

  test('rejects an unknown name and lists the registry', () => {
    assert.throws(
      () => getProvider('ai-gateway'),
      /unknown --provider "ai-gateway"; available: codex, grok-cli, in-agent/,
    );
    assert.throws(() => getProvider(''), /unknown --provider ""/);
  });
});
