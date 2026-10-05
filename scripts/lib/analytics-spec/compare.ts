import { CUSTOM_DIMENSION_LIMITS } from '../../../analytics/ga4-spec-validation.mjs';
import type { Emission, ScanResult, EmissionOwners, AnalyticsSpec } from '../../check-analytics-spec';
import type { createScanner } from './scan';

export function createComparison(
  { serverParams, DYNAMIC_EMIT_SITES, SERVER_PARAM_SOURCE }: ReturnType<typeof createScanner>,
  fail: (message: string) => never,
) {
  /** Params GA4 defines itself; they are never custom dimensions. */
  const GA4_BUILTIN_PARAMS = new Set([
    'page_location',
    'page_path',
    'page_referrer',
    'page_title',
    'language',
    'send_to',
    'event_callback',
    'value',
    'currency',
    'session_id',
    'client_id',
    'engagement_time_msec',
  ]);

  function validateScan({ emissions, undeclaredDynamic }: ScanResult): void {
    if (undeclaredDynamic.length > 0) {
      fail(
        `these files call gtag('event', …) with a non-literal event name and are ` +
          `not in DYNAMIC_EMIT_SITES:\n` +
          undeclaredDynamic.map((f) => `    ${f}`).join('\n') +
          `\n  The gate cannot read the event name from such a call. Add an entry ` +
          `in scripts/check-analytics-spec.ts declaring either the wrapper ` +
          `function or the reachable event names.`,
      );
    }
    if (emissions.length === 0) fail('found zero gtag events in src/ — the scan is broken.');
  }

  function collectEventOwners(
    emissions: readonly Emission[],
    serverEvent: string,
  ): Map<string, Set<string>> {
    const firedBy = new Map<string, Set<string>>();
    for (const e of emissions) {
      if (!firedBy.has(e.event)) firedBy.set(e.event, new Set());
      firedBy.get(e.event)!.add(e.file);
    }
    // The middleware emit is real but invisible to a gtag() scan.
    if (!firedBy.has(serverEvent)) firedBy.set(serverEvent, new Set());
    firedBy.get(serverEvent)!.add(`${SERVER_PARAM_SOURCE} (Edge middleware)`);

    return firedBy;
  }

  function compareEvents(
    registeredEvents: ReadonlySet<string>,
    firedBy: EmissionOwners['firedBy'],
  ): string[] {
    const problems: string[] = [];

    const unregistered = [...firedBy.keys()].filter((e) => !registeredEvents.has(e)).sort();
    if (unregistered.length > 0) {
      problems.push(
        `${unregistered.length} event(s) are sent but not registered in ` +
          `analytics/spec.yaml \`events:\`:\n` +
          unregistered
            .map((e) => `    ${e.padEnd(24)} ${[...firedBy.get(e)!].join(', ')}`)
            .join('\n'),
      );
    }

    const unfired = [...registeredEvents].filter((e) => !firedBy.has(e)).sort();
    if (unfired.length > 0) {
      problems.push(
        `${unfired.length} event(s) are registered in spec.yaml but never sent:\n` +
          unfired.map((e) => `    ${e}`).join('\n') +
          `\n  Either the emit was deleted (remove the spec entry, keeping a ` +
          `comment about when and why) or a new call shape needs declaring.`,
      );
    }

    return problems;
  }

  function collectParamOwners(
    emissions: readonly Emission[],
    serverEvent: string,
  ): Map<string, Set<string>> {
    const paramOwners = new Map<string, Set<string>>();
    for (const e of emissions) {
      for (const p of e.params) {
        if (!paramOwners.has(p)) paramOwners.set(p, new Set());
        paramOwners.get(p)!.add(e.event);
      }
    }
    for (const p of serverParams()) {
      if (!paramOwners.has(p)) paramOwners.set(p, new Set());
      paramOwners.get(p)!.add(`${serverEvent} (middleware)`);
    }

    return paramOwners;
  }

  function compareParameters(
    declaredDims: ReadonlySet<string>,
    paramOwners: EmissionOwners['paramOwners'],
  ): string[] {
    const problems: string[] = [];
    const undeclared = [...paramOwners.keys()]
      .filter((p) => !declaredDims.has(p) && !GA4_BUILTIN_PARAMS.has(p))
      .sort();
    if (undeclared.length > 0) {
      problems.push(
        `${undeclared.length} parameter(s) are sent but have no ` +
          `\`event_scoped_dimensions\` entry, so GA4 cannot report on them:\n` +
          undeclared
            .map((p) => `    ${p.padEnd(22)} ← ${[...paramOwners.get(p)!].join(', ')}`)
            .join('\n'),
      );
    }

    const unusedDims = [...declaredDims].filter((d) => !paramOwners.has(d)).sort();
    if (unusedDims.length > 0) {
      problems.push(
        `${unusedDims.length} dimension(s) are declared in spec.yaml but no code ` +
          `sends them:\n` +
          unusedDims.map((d) => `    ${d}`).join('\n'),
      );
    }

    return problems;
  }

  function reportResult(
    { eventDims, eventHeadroom }: AnalyticsSpec,
    { firedBy, paramOwners }: EmissionOwners,
    problems: readonly string[],
  ): void {
    if (problems.length > 0) {
      fail(`analytics/spec.yaml has drifted from the code.\n\n  ${problems.join('\n\n  ')}`);
    }

    console.log(
      `[check-analytics-spec] OK — ${firedBy.size} events / ` +
        `${paramOwners.size} params match analytics/spec.yaml ` +
        `(${DYNAMIC_EMIT_SITES.length} dynamic emit sites declared).`,
    );
    // Printed every run so the approach to the cap is visible before it is hit,
    // rather than surfacing as a half-completed sync (#240).
    console.log(
      `[check-analytics-spec] GA4 event-dimension headroom: ${eventHeadroom} ` +
        `(${eventDims.length}/${CUSTOM_DIMENSION_LIMITS.perProperty.event} declared in spec).`,
    );
    // Stated rather than left to assumption: this gate compares code to spec.
    // Whether the GA4 property actually has these dimensions needs Admin API
    // credentials that CI does not hold, and that gap is real — five dimensions
    // sat in spec unsynced until #231 ran setup-ga4.mjs and created them.
    console.log(
      `[check-analytics-spec] Not checked here: whether the GA4 property matches ` +
        `this spec. Verify with \`node analytics/setup-ga4.mjs --check\` (read-only, ` +
        `needs credentials); apply with the same script without --check.`,
    );
  }

  return { validateScan, collectEventOwners, compareEvents, collectParamOwners, compareParameters, reportResult };
}
