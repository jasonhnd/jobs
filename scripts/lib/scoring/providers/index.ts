/**
 * providers/index.ts — the provider registry.
 *
 * Whitelist vendors are OpenAI / Anthropic / xAI. A new providers/<name>.ts is only for a genuinely different transport — a locally logged-in subscription CLI, the class codex already occupies. grok-cli is that transport for the grok CLI. Do not add a bespoke xAI HTTP/API provider (providers/xai.ts) and do not add a Vercel AI Gateway provider. Grok 4.6 and the Grok 4.5 backfill stay --provider in-agent; those batches are history. From Grok 4.7 on, an xAI flagship run uses --provider grok-cli. Every call passes -m explicitly. The CLI's default model is not a scoring model.
 *
 * ## Adding a vendor
 *
 * 1. Prefer `in-agent` when the running session *is* the scoring model
 *    (Claude, and the historical Grok 4.6 and Grok 4.5 batches). Prefer
 *    `codex` for the local Codex CLI. From Grok 4.7 on, an xAI flagship
 *    run uses `grok-cli`. Do not add a Vercel AI Gateway provider or
 *    `providers/xai.ts`.
 * 2. If a new file is required, export a `ScoringProvider` (see
 *    ../provider.ts). Typically ~40-80 lines: reach the model, translate
 *    `SCORE_OUTPUT_JSON_SCHEMA` into that transport's native structured-output
 *    mechanism if it has one, and map error wording onto ../errors.ts.
 * 3. Register it below.
 * 4. Run `bun test scripts/lib/scoring` — `conformance.test.ts` picks the new
 *    provider up automatically and checks it cannot weaken the contract.
 *
 * Nothing in ../contract.ts, ../errors.ts, or ../core.ts should need to change.
 * If it does, the seam is in the wrong place — fix the seam rather than
 * special-casing the vendor.
 */
import type { ScoringProvider } from '../provider.js';
import { codexProvider } from './codex.js';
import { grokCliProvider } from './grok-cli.js';
import { inAgentProvider } from './in-agent.js';

export const PROVIDERS: Readonly<Record<string, ScoringProvider>> = Object.freeze({
  [codexProvider.name]: codexProvider,
  [grokCliProvider.name]: grokCliProvider,
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
export { grokCliProvider } from './grok-cli.js';
export { inAgentProvider } from './in-agent.js';
