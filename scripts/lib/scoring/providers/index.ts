/**
 * providers/index.ts — the provider registry.
 *
 * ## Adding a vendor
 *
 * 1. Create `providers/<name>.ts` exporting a `ScoringProvider` (see
 *    ../provider.ts). Typically ~40-80 lines: reach the model, translate
 *    `SCORE_OUTPUT_JSON_SCHEMA` into the vendor's native structured-output
 *    mechanism if it has one, and map the vendor's error wording onto the
 *    shared vocabulary in ../errors.ts.
 * 2. Register it below.
 * 3. Run `bun test scripts/lib/scoring` — `conformance.test.ts` picks the new
 *    provider up automatically and checks it cannot weaken the contract.
 *
 * Nothing in ../contract.ts, ../errors.ts, or ../core.ts should need to change.
 * If it does, the seam is in the wrong place — fix the seam rather than
 * special-casing the vendor.
 */
import type { ScoringProvider } from '../provider.js';
import { codexProvider } from './codex.js';
import { inAgentProvider } from './in-agent.js';

export const PROVIDERS: Readonly<Record<string, ScoringProvider>> = Object.freeze({
  [codexProvider.name]: codexProvider,
  [inAgentProvider.name]: inAgentProvider,
});

export const PROVIDER_NAMES: readonly string[] = Object.keys(PROVIDERS).sort();

/** Resolve a provider by name. Unknown names fail loudly with the valid set. */
export function getProvider(name: string): ScoringProvider {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`unknown --provider "${name}"; available: ${PROVIDER_NAMES.join(', ')}`);
  }
  return provider;
}

export { codexProvider } from './codex.js';
export { inAgentProvider } from './in-agent.js';
