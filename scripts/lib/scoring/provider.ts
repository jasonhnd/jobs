/**
 * provider.ts — the seam between "how do I reach a model" and "what counts as
 * a valid score".
 *
 * Everything a provider owns is vendor-specific plumbing:
 *   • how to reach the model                       → ask()
 *   • how to make it emit the contract natively    → prepareRun()
 *   • what this vendor's errors mean               → classifyError()
 *   • how hard it may be hit                       → maxConcurrency
 *
 * Everything a provider does NOT own is in contract.ts / errors.ts / core.ts:
 * the AIOIS-10 field set, the formula checks, the retry policy, the audit
 * trail, resume, and the output format. A new vendor is therefore a small file
 * that cannot weaken any of those guarantees — see
 * `providers/conformance.test.ts` for the checks every provider must pass.
 */
import type { ScoringErrorKind } from './errors.js';

/** Raw result of one attempt, before any contract validation. */
export interface ProviderResponse {
  /** 0 on success. Non-zero is reported as a failed attempt. */
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  /** The model's answer text. Falls back to stdout when the provider has no separate channel. */
  readonly rawText: string;
}

/** Everything a provider may need to answer one prompt. */
export interface AskOptions {
  readonly cwd: string;
  readonly model: string;
  /** Where the provider should write the model's final message, if it uses a file channel. */
  readonly outputLastMessagePath: string;
  /** Set by providers that declare `supportsNativeSchema`. */
  readonly outputSchemaPath?: string;
  readonly runDir?: string;
  readonly tmpDir?: string;
  readonly rawDir?: string;
  readonly occId?: number;
  readonly attempt?: number;
}

export type ScoringExecutor = (prompt: string, options: AskOptions) => Promise<ProviderResponse>;

export interface PrepareRunContext {
  readonly cwd: string;
  readonly model: string;
  readonly runDir: string;
}

/** Per-run setup result. Anything returned here is also written to the run's audit directory. */
export interface RunPreparation {
  /** Path to the materialized native schema, when the provider has one. */
  readonly outputSchemaPath?: string;
  /** Free-form provenance recorded alongside the run (CLI version, probe output, …). */
  readonly audit?: Readonly<Record<string, unknown>>;
}

export interface ScoringProvider {
  /** Registry key. Must match the key it is registered under. */
  readonly name: string;
  /** One line shown in `--help` and in run logs. */
  readonly description: string;
  /**
   * True when the vendor can enforce the JSON shape itself (OpenAI
   * `--output-schema`, Anthropic forced tools, Gemini `responseSchema`, …).
   * False means the contract is requested in prose and enforced only by
   * validation — which is still safe, just noisier.
   */
  readonly supportsNativeSchema: boolean;
  /** Upper bound on parallel in-flight requests for this vendor. */
  readonly maxConcurrency: number;
  /**
   * True when re-asking with identical input yields an identical answer, so a
   * retry cannot change the outcome (e.g. answers read from a file). The runner
   * then spends a single attempt instead of burning the retry budget — and the
   * reported attempt count stays honest about how often the model was asked.
   */
  readonly deterministic?: boolean;

  /**
   * Fail fast before any occupation is scored or any output file is touched.
   * Must throw when the vendor cannot honour the requested model — never
   * downgrade to a different model.
   */
  preflight(ctx: PrepareRunContext): void;

  /** Materialize per-run assets (native schema file, auth probe, …). */
  prepareRun(ctx: PrepareRunContext): RunPreparation;

  /** Send one prompt, return the raw answer. No validation here. */
  ask: ScoringExecutor;

  /** Optional override when this vendor's error wording differs from the defaults. */
  classifyError?(text: string): ScoringErrorKind | null;
}
