/**
 * measurement-sentinel-reconcile.ts — pure helpers for sentinel phase 2
 * (#334): reconcile GA4's ingested `page_delivery` counts against recent
 * history via the Data API, reached with Vercel OIDC federation — no
 * long-lived Google credential exists anywhere in the chain.
 *
 * What this phase catches that phase 1 cannot: GA4 accepting hits (204)
 * and then dropping or mis-processing them after ingestion. Phase 1
 * proves "we can knock"; this proves "the letters actually arrived".
 *
 * Chain (all short-lived, all in api/cron/measurement-sentinel.ts):
 *   Vercel OIDC token (platform-issued, ~1h)
 *     → STS token exchange (workload identity federation)
 *     → impersonate ga4-sentinel@… (analytics.readonly, 300s)
 *     → Data API runReport, yesterday vs the day before, JST.
 *
 * Verdict is deliberately stateless: one runReport with two named date
 * ranges. A missing row means zero events for that range (GA4 omits
 * empty ranges), which is itself the loudest possible signal.
 *
 * Redaction (EDGE_SECURITY H17): builders never embed tokens in URLs;
 * tokens travel in POST bodies/headers assembled by the caller and are
 * never logged.
 */

export interface ReconcileEnv {
  /** //iam.googleapis.com/projects/<num>/locations/global/workloadIdentityPools/<pool>/providers/<provider> */
  readonly wifAudience: string | undefined;
  readonly saEmail: string | undefined;
  readonly propertyId: string | undefined;
}

export function missingReconcileEnvFailures(env: ReconcileEnv): string[] {
  const failures: string[] = [];
  if (!env.wifAudience) failures.push('phase2-env:GCP_WIF_AUDIENCE:missing');
  if (!env.saEmail) failures.push('phase2-env:GCP_SA_EMAIL:missing');
  if (!env.propertyId) failures.push('phase2-env:GA4_PROPERTY_ID:missing');
  return failures;
}

export const STS_URL = 'https://sts.googleapis.com/v1/token';

/** Token-exchange body per RFC 8693 as Google STS expects it. */
export function buildStsBody(audience: string, subjectToken: string): string {
  return new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    audience,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    subject_token: subjectToken,
  }).toString();
}

export function impersonationUrl(saEmail: string): string {
  return `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(saEmail)}:generateAccessToken`;
}

export const IMPERSONATION_BODY = JSON.stringify({
  scope: ['https://www.googleapis.com/auth/analytics.readonly'],
  lifetime: '300s',
});

export function runReportUrl(propertyId: string): string {
  return `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
}

/** YYYY-MM-DD in JST (the GA4 property timezone), offsetDays back from now. */
export function jstDate(offsetDays: number, now: Date): string {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + JST_OFFSET_MS - offsetDays * 24 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** One report, two named ranges; rows come back tagged with the range name. */
export function buildRunReportBody(now: Date): Record<string, unknown> {
  const yesterday = jstDate(1, now);
  const dayBefore = jstDate(2, now);
  return {
    dateRanges: [
      { startDate: yesterday, endDate: yesterday, name: 'yesterday' },
      { startDate: dayBefore, endDate: dayBefore, name: 'dayBefore' },
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: { fieldName: 'eventName', stringFilter: { value: 'page_delivery' } },
    },
  };
}

interface ReportRowShape {
  readonly dimensionValues?: ReadonlyArray<{ readonly value?: unknown }>;
  readonly metricValues?: ReadonlyArray<{ readonly value?: unknown }>;
}

export interface ReconcileCounts {
  readonly yesterday: number;
  readonly dayBefore: number;
}

/**
 * GA4 omits rows for ranges with zero events, so both counts default to 0
 * and only a structurally alien body returns null.
 */
export function parseReconcileCounts(body: unknown): ReconcileCounts | null {
  if (typeof body !== 'object' || body === null) return null;
  const rows = (body as { rows?: unknown }).rows;
  const counts = { yesterday: 0, dayBefore: 0 };
  if (rows === undefined) return counts;
  if (!Array.isArray(rows)) return null;
  for (const row of rows as ReportRowShape[]) {
    const range = row.dimensionValues?.[0]?.value;
    const value = Number(row.metricValues?.[0]?.value ?? 0);
    if (range === 'yesterday') counts.yesterday = value;
    else if (range === 'dayBefore') counts.dayBefore = value;
  }
  return counts;
}

/**
 * Below this baseline a big relative swing is normal noise; above it, a
 * >60% day-over-day collapse of ingested deliveries is an incident.
 */
export const RECONCILE_MIN_BASELINE = 50;

export function reconcileVerdict(counts: ReconcileCounts): string[] {
  if (counts.yesterday <= 0) {
    return [`reconcile:zero-deliveries(dayBefore=${String(counts.dayBefore)})`];
  }
  if (counts.dayBefore >= RECONCILE_MIN_BASELINE && counts.yesterday < counts.dayBefore * 0.4) {
    return [
      `reconcile:drop-gt-60pct(yesterday=${String(counts.yesterday)},dayBefore=${String(counts.dayBefore)})`,
    ];
  }
  return [];
}
