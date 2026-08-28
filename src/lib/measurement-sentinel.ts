/**
 * measurement-sentinel.ts — pure decision helpers for the daily GA4
 * measurement-chain watchdog. api/cron/measurement-sentinel.ts is the
 * I/O wrapper (#333).
 *
 * Why this exists: the MP chain fails SILENTLY by design. middleware.ts
 * passes through without logging when the measurement env is missing,
 * and GA4 /mp/collect returns 204 even for rejected payloads. The
 * team's default alert rule only forwards error-level events, so a dead
 * chain produces no signal (#253 stayed invisible for 2+ weeks). The
 * sentinel turns "silently unhealthy" into a function error the
 * platform's default alerting can see.
 *
 * Redaction contract (EDGE_SECURITY H17): failure strings carry stable
 * reason codes only — never header values, secrets, or the debug URL
 * (its query string carries api_secret).
 */
import { buildMpPayload } from './middleware-helpers.js';

export interface SentinelEnv {
  readonly measurementId: string | undefined;
  readonly apiSecret: string | undefined;
}

/**
 * Reason codes for missing measurement env — the middleware's
 * silent-skip failure mode (its env guard passes through with no log).
 */
export function missingEnvFailures(env: SentinelEnv): string[] {
  const failures: string[] = [];
  if (!env.measurementId) failures.push('env:PUBLIC_GA4_MEASUREMENT_ID:missing');
  if (!env.apiSecret) failures.push('env:GA4_MP_API_SECRET:missing');
  return failures;
}

/**
 * Cron caller gate. Vercel invokes cron paths with
 * `Authorization: Bearer <CRON_SECRET>` when that env is configured.
 * An unset secret fails open so a fresh environment never silently
 * disables the watchdog; the endpoint is read-only either way.
 */
export function authorizeCronRequest(
  authorizationHeader: string | null,
  cronSecret: string | undefined,
): boolean {
  if (!cronSecret) return true;
  return authorizationHeader === `Bearer ${cronSecret}`;
}

/**
 * Canary payload for GA4's validation endpoint. Reuses the middleware's
 * buildMpPayload so the sentinel exercises the SAME payload contract
 * production hits use — schema drift fails the canary too. Marked
 * ai_agent/measurement-sentinel so it is unmistakably synthetic;
 * /debug/mp/collect validates without ingesting.
 */
export function buildCanaryPayload(origin: string): unknown {
  return buildMpPayload({
    clientId: 'sentinel.1',
    sessionId: 'sentinel-session',
    pageLocation: `${origin}/__measurement-sentinel`,
    pageReferrer: '',
    clientIp: '',
    userAgent: 'measurement-sentinel/1.0',
    clientKind: 'ai_agent',
    agentName: 'measurement-sentinel',
  });
}

interface DebugValidationMessage {
  readonly fieldPath?: string;
  readonly validationCode?: string;
}

/**
 * GA4 /debug/mp/collect verdict → redacted failure codes. Non-2xx is a
 * transport/config failure; any validationMessage means the payload
 * contract drifted. Free-text descriptions are dropped — codes only.
 */
export function evaluateDebugResponse(status: number, body: unknown): string[] {
  if (status < 200 || status >= 300) return [`debug-endpoint:http-${status}`];
  return extractValidationMessages(body).map(
    (m) => `debug-endpoint:${m.validationCode ?? 'UNKNOWN_CODE'}:${m.fieldPath ?? '(payload)'}`,
  );
}

function extractValidationMessages(body: unknown): DebugValidationMessage[] {
  if (typeof body !== 'object' || body === null) return [];
  const raw = (body as { validationMessages?: unknown }).validationMessages;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is DebugValidationMessage => typeof m === 'object' && m !== null,
  );
}
