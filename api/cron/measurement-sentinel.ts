// api/cron/measurement-sentinel.ts — Vercel Function (nodejs + bunVersion
// 1.4.x): daily GA4 measurement-chain watchdog (#333).
//
// Schedule: vercel.json `crons` → 22:17 UTC (07:17 JST) daily. Vercel
// runs crons against the production deployment only; preview deploys
// carry the route but nothing invokes it. The middleware matcher
// already excludes /api, so sentinel runs never emit page_delivery
// events themselves.
//
// Failure protocol: any unhealthy check returns an INTENTIONAL 500.
// Function errors are the signal the team's default alert rule
// (ar_default, error/critical) forwards to the owner — the platform's
// own alert chain is the notifier, no bespoke notification infra.
//
// Redaction (EDGE_SECURITY H17): the debug URL query carries
// api_secret — it is never logged. Failure output is reason codes only.
//
// Phase 2 (#334): GA4 Data API event-count reconciliation via Vercel
// OIDC federation, catching post-ingestion loss this phase cannot see.
import {
  authorizeCronRequest,
  buildCanaryPayload,
  evaluateDebugResponse,
  missingEnvFailures,
} from '../../src/lib/measurement-sentinel.js';
import { fetchWithTimeout } from '../../src/lib/http-client.js';

export const config = {
  // nodejs + vercel.json bunVersion 1.4.x → Bun 1.4 (TOOLCHAIN §9).
  runtime: 'nodejs',
  regions: ['hnd1'],
};

const DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';
const CANARY_ORIGIN = 'https://mirai-shigoto.com';
const CANARY_TIMEOUT_MS = 5000;

export async function GET(request: Request): Promise<Response> {
  if (!authorizeCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const measurementId = process.env.PUBLIC_GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_MP_API_SECRET;
  const failures = missingEnvFailures({ measurementId, apiSecret });

  if (failures.length === 0) {
    const debugUrl =
      `${DEBUG_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId as string)}` +
      `&api_secret=${encodeURIComponent(apiSecret as string)}`;
    try {
      const res = await fetchWithTimeout(
        debugUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildCanaryPayload(CANARY_ORIGIN)),
        },
        CANARY_TIMEOUT_MS,
      );
      const body: unknown = await res.json().catch(() => null);
      failures.push(...evaluateDebugResponse(res.status, body));
    } catch (err) {
      failures.push(`debug-endpoint:${err instanceof Error ? err.name : 'network-error'}`);
    }
  }

  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`[sentinel] measurement chain unhealthy: ${failures.join('; ')}`);
    return new Response(JSON.stringify({ ok: false, failures }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
