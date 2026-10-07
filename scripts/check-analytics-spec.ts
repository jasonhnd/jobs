#!/usr/bin/env bun
/**
 * check-analytics-spec.ts — keeps `analytics/spec.yaml` in step with the events
 * the code actually sends to GA4.
 *
 * `analytics/spec.yaml` is the source of truth for the GA4 property: which
 * events exist, and which event parameters are registered as custom
 * dimensions. A parameter that is sent but has no `event_scoped_dimensions`
 * entry still reaches GA4 — it just cannot be used as a dimension in any
 * report. That failure is invisible: nothing errors, the data simply is not
 * queryable.
 *
 * Nothing verified the two sides against each other until this gate. A comment
 * in spec.yaml referenced `check_spec_vs_code.mjs` as the guard, but that
 * script was deleted in PR 37 as legacy migration tooling and never replaced;
 * `check-analytics-config.cjs` (the only other analytics gate) validates CSP
 * origins and `.env.example` without ever reading spec.yaml. By the time issue
 * #231 was filed the two had drifted to 8 unregistered events and 6 undeclared
 * parameters — none of which had ever been reportable in GA4.
 *
 * ── Why this has to fail closed ──────────────────────────────────────────
 *
 * Event names reach `gtag` through four different shapes:
 *
 *   1. A string literal:  gtag('event', 'map_loaded', {...})
 *   2. A wrapper defined per-file, under two different names —
 *      `track(name, params)` in _shindan.js, `ga(name, params)` in
 *      _map-inline.js and _me-inline.js
 *   3. A value read from the DOM (Footer.astro reads `data-track-event`)
 *   4. A ternary picking between two literals (_index-inline.js)
 *
 * A scan that understands only shape 1 silently reports "no events" for the
 * rest. The first draft of this analysis missed `me_open` / `me_select_job`
 * for exactly that reason — it did not know about the `ga(` wrapper.
 *
 * So every call whose event name is NOT a literal must be declared in
 * DYNAMIC_EMIT_SITES below. An undeclared one is a hard failure, never a
 * silent skip. This mirrors the CSP_ANALYTICS_FALLBACK_HASHES convention: a
 * check that cannot see something must say so rather than pass.
 *
 * Exits 0 when spec and code agree, 1 otherwise.
 */
import { join } from 'node:path';
import { createScanner } from './lib/analytics-spec/scan';
import { createSpecReader } from './lib/analytics-spec/spec';
import { createComparison } from './lib/analytics-spec/compare';

export interface DynamicEmitSite {
  readonly file: string;
  readonly wrapper?: string;
  readonly emits?: readonly string[];
  /** The variable an `emits` site compares (`name === '…'`); every branch must be declared. */
  readonly branchVar?: string;
  readonly why: string;
}

export interface Emission {
  readonly event: string;
  readonly params: readonly string[];
  readonly file: string;
}

export interface SourceFile {
  readonly file: string;
  readonly text: string;
}

export interface ScanResult {
  emissions: Emission[];
  undeclaredDynamic: string[];
  /** `file:line: reason` for every gtag / dataLayer use the gate cannot read. */
  unreadable: string[];
}

export interface DimensionEntry {
  parameter_name?: string;
  display_name?: string;
  description?: string;
}

export interface AnalyticsSpec {
  readonly eventDims: readonly DimensionEntry[];
  readonly eventHeadroom: number;
  readonly registeredEvents: ReadonlySet<string>;
  readonly declaredDims: ReadonlySet<string>;
}

export interface EmissionOwners {
  readonly firedBy: ReadonlyMap<string, ReadonlySet<string>>;
  readonly paramOwners: ReadonlyMap<string, ReadonlySet<string>>;
}

function fail(message: string): never {
  console.error(`[check-analytics-spec] FAIL: ${message}`);
  process.exit(1);
}

function main(): void {
  const ROOT = join(import.meta.dir, '..');
  const scanner = createScanner(ROOT, fail);
  const { collectSources, scan, serverEventName } = scanner;
  const { readSpec } = createSpecReader(ROOT, fail);
  const {
    validateScan, collectEventOwners, compareEvents,
    collectParamOwners, compareParameters, reportResult,
  } = createComparison(scanner, fail);
  const spec = readSpec();
  const result = scan(collectSources());
  validateScan(result);
  const serverEvent = serverEventName();
  const firedBy = collectEventOwners(result.emissions, serverEvent);
  // Keep event comparison ahead of server-param validation, as in the original gate.
  const eventProblems = compareEvents(spec.registeredEvents, firedBy);
  const paramOwners = collectParamOwners(result.emissions, serverEvent);
  const problems = [...eventProblems, ...compareParameters(spec.declaredDims, paramOwners)];
  reportResult(spec, { firedBy, paramOwners }, problems);
}

main();
