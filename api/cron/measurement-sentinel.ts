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
// api_secret — it is never logged. Failure output is reason codes only;
// no token in the chain below is ever logged either.
//
// Phase 2 (#334, runs only when phase 1 is healthy): verify GA4 actually
// INGESTED recent deliveries — the failure mode phase 1 cannot see (GA4
// 204s a hit, then drops it). Chain: Vercel OIDC token → STS federation
// → impersonate ga4-sentinel@… (analytics.readonly, 300s) → Data API
// runReport, yesterday vs the day before (JST). Every credential is
// short-lived; no Google key exists in any env. GCP-side state and
// replay commands live in docs/INCIDENT_RUNBOOK.md §6.7.
import {
  authorizeCronRequest,
  buildCanaryPayload,
  evaluateDebugResponse,
  missingEnvFailures,
} from '../../src/lib/measurement-sentinel.js';
import {
  buildRunReportBody,
  buildStsBody,
  IMPERSONATION_BODY,
  impersonationUrl,
  missingReconcileEnvFailures,
  parseReconcileCounts,
  reconcileVerdict,
  runReportUrl,
  STS_URL,
} from '../../src/lib/measurement-sentinel-reconcile.js';
import { fetchWithTimeout } from '../../src/lib/http-client.js';
import { getVercelOidcToken } from '@vercel/functions/oidc';

export const config = {
  // nodejs + vercel.json bunVersion 1.4.x → Bun 1.4 (TOOLCHAIN §9).
  runtime: 'nodejs',
  regions: ['hnd1'],
};

const DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';
const CANARY_ORIGIN = 'https://mirai-shigoto.com';
const CANARY_TIMEOUT_MS = 5000;
const RECONCILE_TIMEOUT_MS = 10_000;

function stringField(body: unknown, key: string): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

interface ReconcileConfig {
  readonly wifAudience: string;
  readonly saEmail: string;
  readonly propertyId: string;
}

/** Phase 2 as a flat early-return pipeline; returns redacted reason codes. */
async function runReconcilePhase(cfg: ReconcileConfig): Promise<string[]> {
  const oidcToken = await getVercelOidcToken();

  const stsRes = await fetchWithTimeout(
    STS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildStsBody(cfg.wifAudience, oidcToken),
    },
    RECONCILE_TIMEOUT_MS,
  );
  const federated = stringField(await stsRes.json().catch(() => null), 'access_token');
  if (!federated) return [`reconcile:sts-http-${String(stsRes.status)}`];

  const impRes = await fetchWithTimeout(
    impersonationUrl(cfg.saEmail),
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${federated}`, 'Content-Type': 'application/json' },
      body: IMPERSONATION_BODY,
    },
    RECONCILE_TIMEOUT_MS,
  );
  const saToken = stringField(await impRes.json().catch(() => null), 'accessToken');
  if (!saToken) return [`reconcile:impersonate-http-${String(impRes.status)}`];

  const reportRes = await fetchWithTimeout(
    runReportUrl(cfg.propertyId),
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRunReportBody(new Date())),
    },
    RECONCILE_TIMEOUT_MS,
  );
  const reportBody: unknown = await reportRes.json().catch(() => null);
  if (!reportRes.ok) return [`reconcile:report-http-${String(reportRes.status)}`];

  const counts = parseReconcileCounts(reportBody);
  if (!counts) return ['reconcile:report-shape'];
  return reconcileVerdict(counts);
}

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

  if (failures.length === 0) {
    const wifAudience = process.env.GCP_WIF_AUDIENCE;
    const saEmail = process.env.GCP_SA_EMAIL;
    const propertyId = process.env.GA4_PROPERTY_ID;
    failures.push(...missingReconcileEnvFailures({ wifAudience, saEmail, propertyId }));
    if (failures.length === 0) {
      try {
        failures.push(
          ...(await runReconcilePhase({
            wifAudience: wifAudience as string,
            saEmail: saEmail as string,
            propertyId: propertyId as string,
          })),
        );
      } catch (err) {
        failures.push(`reconcile:${err instanceof Error ? err.name : 'network-error'}`);
      }
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
