// Tests for scripts/lib/built-artifacts.ts — runs under `bun test`.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildArtifactsRequired, requireBuiltArtifact } from './built-artifacts.js';

function withFlag<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.REQUIRE_BUILT_ARTIFACTS;
  if (value === undefined) delete process.env.REQUIRE_BUILT_ARTIFACTS;
  else process.env.REQUIRE_BUILT_ARTIFACTS = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.REQUIRE_BUILT_ARTIFACTS;
    else process.env.REQUIRE_BUILT_ARTIFACTS = previous;
  }
}

describe('buildArtifactsRequired', () => {
  test('treats unset, empty, "0", and "false" as not required', () => {
    for (const value of [undefined, '', '0', 'false', 'FALSE']) {
      assert.equal(withFlag(value, buildArtifactsRequired), false, `unexpected for ${JSON.stringify(value)}`);
    }
  });

  test('treats any other value as required', () => {
    for (const value of ['1', 'true', 'yes']) {
      assert.equal(withFlag(value, buildArtifactsRequired), true, `unexpected for ${value}`);
    }
  });
});

describe('requireBuiltArtifact', () => {
  test('passes a present artifact through under either mode', () => {
    assert.equal(withFlag(undefined, () => requireBuiltArtifact('/dist/x.html', 'x')), '/dist/x.html');
    assert.equal(withFlag('1', () => requireBuiltArtifact('/dist/x.html', 'x')), '/dist/x.html');
  });

  test('returns null for a missing artifact when the build is optional', () => {
    assert.equal(withFlag(undefined, () => requireBuiltArtifact(null, 'x')), null);
    assert.equal(withFlag(undefined, () => requireBuiltArtifact(undefined, 'x')), null);
  });

  // The whole point of #213: a missing artifact must not quietly disarm the
  // assertions in a run that was supposed to have build output.
  test('throws for a missing artifact when the build is required', () => {
    assert.throws(
      () => withFlag('1', () => requireBuiltArtifact(null, 'dist-astro/models/index.html')),
      /dist-astro\/models\/index\.html.*REQUIRE_BUILT_ARTIFACTS is set/s,
    );
  });
});
