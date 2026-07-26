/**
 * built-artifacts.ts — guards for tests that assert against build output.
 *
 * Tests over `dist-astro/` have to tolerate the directory being absent: it is
 * gitignored, and running `bun test` on a fresh checkout before `bun run build`
 * is normal. The usual accommodation is an early return.
 *
 * That accommodation is only safe when something guarantees the build ran. In
 * CI nothing did: `bun run test` executes before `bun run build`, so
 * `src/site/models-built.test.ts` returned early on every assertion and
 * reported green — for its entire lifetime. The stale strings it existed to
 * catch were only found by running it by hand after a local build (#213).
 *
 * The fix is to make the precondition explicit rather than inferred. Runs that
 * are supposed to have build output set REQUIRE_BUILT_ARTIFACTS, and a missing
 * artifact is then fatal. Everything else keeps skipping.
 *
 * Note this is deliberately NOT keyed on `CI`: these files are also collected
 * by `bun run test`, which in CI legitimately runs before the build. Keying on
 * `CI` would fail that step for the wrong reason. The signal we need is "this
 * invocation expects a build", which only the caller knows.
 */

/** True when the caller has declared that build output must already exist. */
export function buildArtifactsRequired(): boolean {
  const flag = process.env.REQUIRE_BUILT_ARTIFACTS;
  return flag !== undefined && flag !== '' && flag !== '0' && flag.toLowerCase() !== 'false';
}

/**
 * Pass through a resolved build artifact, or decide how to handle its absence.
 *
 * Returns `null` when build output is optional, so the caller can skip. Throws
 * when REQUIRE_BUILT_ARTIFACTS is set, so a missing or mis-ordered build step
 * fails loudly instead of silently disarming the assertions.
 */
export function requireBuiltArtifact<T>(value: T | null | undefined, description: string): T | null {
  if (value != null) return value;
  if (buildArtifactsRequired()) {
    throw new Error(
      `${description} not found under dist-astro/, but REQUIRE_BUILT_ARTIFACTS is set. ` +
        'Built-HTML tests must run after `bun run build` (see issue #213).',
    );
  }
  return null;
}
