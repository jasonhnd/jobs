/**
 * providers/ai-gateway.ts — any vendor's models through Vercel AI Gateway's
 * OpenAI-compatible API (#340).
 *
 * Transport only. The AIOIS-10 contract, retry policy, and audit trail live in
 * ../contract.ts, ../errors.ts, and ../core.ts.
 *
 * Why the gateway: one endpoint and one key for every vendor, per-model spend
 * on the Vercel dashboard, zero token markup. Adding the next batch's model is
 * a `--model` string change, not new provider glue (the #146 lesson).
 *
 * Model integrity (the no-silent-fallback rule, enforced harder here):
 *   • Gateway routing/fallback features are never enabled — this provider
 *     sends a plain chat.completions request with exactly one model.
 *   • Every response's reported `model` must match the request; a mismatch is
 *     a failed attempt (`model_mismatch` → model_unavailable), never accepted.
 *   • Each accepted response appends `{id, requested, executed}` to
 *     `<runDir>/executed-models.jsonl` so the batch carries its own
 *     attestation artifact. `check:score-batch` verifies that sidecar.
 *
 * Env: AI_GATEWAY_API_KEY (create with `vercel ai-gateway api-keys create`;
 * keep in .env.local — see .env.example). Optional AI_GATEWAY_BASE_URL
 * overrides the default endpoint.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { SCORE_OUTPUT_JSON_SCHEMA } from '../contract.js';
import type { ScoringErrorKind } from '../errors.js';
import type { AskOptions, PrepareRunContext, ProviderResponse, RunPreparation, ScoringProvider } from '../provider.js';

export const AI_GATEWAY_MAX_CONCURRENCY = 4;
export const AI_GATEWAY_DEFAULT_BASE_URL = 'https://ai-gateway.vercel.sh/v1';
const REQUEST_TIMEOUT_MS = 300_000;

export function gatewayBaseUrl(env: Readonly<Record<string, string | undefined>> = process.env): string {
  return (env.AI_GATEWAY_BASE_URL ?? AI_GATEWAY_DEFAULT_BASE_URL).replace(/\/$/, '');
}

/**
 * Gateway model ids are `creator/slug` (e.g. `openai/gpt-5.6-sol`,
 * `anthropic/claude-opus-5`). A bare slug would let the gateway guess the
 * vendor — guessing is adjacent to substituting, so it is rejected up front.
 */
export function isGatewayModelId(model: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(model);
}

/** Bare slug of a `creator/slug` id, or the string itself when it has no slash. */
export function modelSlug(model: string): string {
  const slash = model.lastIndexOf('/');
  return slash >= 0 ? model.slice(slash + 1) : model;
}

/**
 * The response's `model` may echo the id verbatim or expand it to a dated
 * variant (`anthropic/claude-opus-5-20260726`, `claude-opus-5-20260726`).
 * Anything else — and in particular a different family — is a mismatch.
 */
export function executedModelMatches(requested: string, executed: string): boolean {
  if (!executed) return false;
  if (executed === requested) return true;
  const slug = modelSlug(requested);
  return executed === slug || executed.startsWith(`${slug}-`) || executed.startsWith(`${requested}-`);
}

export interface ExecutedModelRow {
  readonly id: number;
  readonly requested: string;
  readonly executed: string;
}

/**
 * Parse `<runDir>/executed-models.jsonl`. Returns an error string on the first
 * unreadable line rather than skipping it — a silent skip would hide a
 * substitution.
 */
export function parseExecutedModelsJsonl(text: string): { rows: ExecutedModelRow[]; error: string | null } {
  const rows: ExecutedModelRow[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!.trim();
    if (!line) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return { rows, error: `line ${String(i + 1)} is not JSON` };
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return { rows, error: `line ${String(i + 1)} is not an object` };
    }
    const row = parsed as { id?: unknown; requested?: unknown; executed?: unknown };
    if (typeof row.id !== 'number' || !Number.isInteger(row.id) || typeof row.requested !== 'string' || typeof row.executed !== 'string') {
      return { rows, error: `line ${String(i + 1)} missing id/requested/executed` };
    }
    rows.push({ id: row.id, requested: row.requested, executed: row.executed });
  }
  return { rows, error: null };
}

/**
 * Every attested occupation must have executed the requested model, and that
 * requested model must be the batch's `scorer.model` (bare slug or
 * `creator/slug`). Returns null when the sidecar is consistent.
 */
export function attestationsMatchBatch(rows: readonly ExecutedModelRow[], batchModel: string): string | null {
  if (rows.length === 0) return 'executed-models.jsonl is empty';
  const batchSlug = modelSlug(batchModel);
  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.id)) return `duplicate occupation id ${String(row.id)}`;
    seen.add(row.id);
    if (!executedModelMatches(row.requested, row.executed)) {
      return `id ${String(row.id)}: requested "${row.requested}" but executed "${row.executed}"`;
    }
    if (modelSlug(row.requested) !== batchSlug) {
      return `id ${String(row.id)}: requested "${row.requested}" does not match batch scorer.model "${batchModel}"`;
    }
  }
  return null;
}

interface ChatCompletionShape {
  readonly model?: unknown;
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: unknown };
    readonly finish_reason?: unknown;
  }>;
}

export function extractCompletion(body: unknown): { model: string; content: string; finishReason: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const shaped = body as ChatCompletionShape;
  const choice = shaped.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== 'string') return null;
  return {
    model: typeof shaped.model === 'string' ? shaped.model : '',
    content,
    finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : '',
  };
}

/**
 * Only this provider's own markers are classified here; everything else
 * returns null so the shared vocabulary in ../errors.ts keeps authority
 * (conformance pins the shared wording).
 *
 * Network / timeout failures are tagged `transport` (retry with backoff).
 * Leaving them as `malformed` would retry immediately with no delay and
 * mislabel the audit trail during an outage.
 */
export function classifyGatewayError(text: string): ScoringErrorKind | null {
  if (/\bmodel_mismatch\b/.test(text)) return 'model_unavailable';
  if (/\bconnection failed\b/i.test(text)) return 'transport';
  return null;
}

export const askGateway = async (prompt: string, options: AskOptions): Promise<ProviderResponse> => {
  // Guard path first: a run prepareRun did not set up must fail without any
  // network contact (conformance exercises exactly this).
  if (!options.outputSchemaPath) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'ai-gateway provider requires outputSchemaPath (prepareRun did not run)',
      rawText: '',
    };
  }
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'AI_GATEWAY_API_KEY is not set; create one with `vercel ai-gateway api-keys create`',
      rawText: '',
    };
  }

  const url = `${gatewayBaseUrl()}/chat/completions`;
  let response: Response;
  let bodyText: string;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'aiois_score', strict: true, schema: SCORE_OUTPUT_JSON_SCHEMA },
        },
        stream: false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    bodyText = await response.text();
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return { exitCode: 1, stdout: '', stderr: `connection failed: ${message}`, rawText: '' };
  }

  if (response.status === 404 || response.status === 400) {
    // Reuse the shared wording so ../errors.ts classifies it without any
    // provider-specific pattern.
    return {
      exitCode: 1,
      stdout: '',
      stderr: `Requested model ${options.model} is unavailable (HTTP ${String(response.status)}): ${bodyText.slice(0, 300)}`,
      rawText: '',
    };
  }
  if (response.status === 429) {
    return { exitCode: 1, stdout: '', stderr: `HTTP 429 Too Many Requests: ${bodyText.slice(0, 300)}`, rawText: '' };
  }
  if (!response.ok) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `upstream provider error while routing (HTTP ${String(response.status)}): ${bodyText.slice(0, 300)}`,
      rawText: '',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { exitCode: 1, stdout: '', stderr: `non-JSON completion envelope: ${bodyText.slice(0, 300)}`, rawText: '' };
  }
  const completion = extractCompletion(parsed);
  if (!completion) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `completion envelope missing choices[0].message.content: ${bodyText.slice(0, 300)}`,
      rawText: '',
    };
  }

  if (completion.model && !executedModelMatches(options.model, completion.model)) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `model_mismatch: requested "${options.model}" but the gateway executed "${completion.model}"`,
      rawText: '',
    };
  }
  if (completion.finishReason === 'length') {
    return { exitCode: 1, stdout: '', stderr: 'response stopped at max_tokens', rawText: completion.content };
  }

  try {
    writeFileSync(options.outputLastMessagePath, completion.content);
  } catch {
    // The file channel is auxiliary; rawText below is authoritative.
  }
  if (options.runDir !== undefined && options.occId !== undefined) {
    appendFileSync(
      join(options.runDir, 'executed-models.jsonl'),
      `${JSON.stringify({ id: options.occId, requested: options.model, executed: completion.model || options.model })}\n`,
    );
  }

  return { exitCode: 0, stdout: '', stderr: '', rawText: completion.content };
};

export const aiGatewayProvider: ScoringProvider = {
  name: 'ai-gateway',
  description: 'Any vendor model via Vercel AI Gateway (AI_GATEWAY_API_KEY; model id is creator/slug).',
  supportsNativeSchema: true,
  maxConcurrency: AI_GATEWAY_MAX_CONCURRENCY,

  preflight(ctx: PrepareRunContext): void {
    if (!process.env.AI_GATEWAY_API_KEY) {
      throw new Error(
        'AI_GATEWAY_API_KEY is not set. Create one with `vercel ai-gateway api-keys create` and put it in .env.local (see .env.example).',
      );
    }
    if (!isGatewayModelId(ctx.model)) {
      throw new Error(
        `--model must be a gateway id in creator/slug form (e.g. anthropic/claude-opus-5, openai/gpt-5.6-sol); got "${ctx.model}"`,
      );
    }
  },

  prepareRun(ctx: PrepareRunContext): RunPreparation {
    const outputSchemaPath = join(ctx.runDir, 'ai-gateway-score.schema.json');
    writeFileSync(outputSchemaPath, `${JSON.stringify(SCORE_OUTPUT_JSON_SCHEMA, null, 2)}\n`);
    return {
      outputSchemaPath,
      audit: {
        endpoint: `${gatewayBaseUrl()}/chat/completions`,
        requestedModel: ctx.model,
        fallback: 'disabled (plain single-model request; mismatch is a failed attempt)',
      },
    };
  },

  ask: askGateway,
  classifyError: classifyGatewayError,
};
