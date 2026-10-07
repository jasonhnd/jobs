import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import type { DimensionEntry, AnalyticsSpec } from '../../check-analytics-spec';
// The same validator analytics/setup-ga4.mjs runs before pushing dimensions to
// the GA4 Admin API. It only ever ran on a manual `setup-ga4.mjs` invocation,
// so an over-limit description could sit on `preview` indefinitely and only
// surface when someone tried to sync — which is how job_id's description
// reached 187 of an allowed 150 characters (added by #219, caught by #231).
// Running it here puts the same contract in CI. The module has no imports of
// its own, so pulling it in from scripts/ costs nothing.
import {
  validateCustomDimensionSpec,
  CUSTOM_DIMENSION_LIMITS,
} from '../../../analytics/ga4-spec-validation.mjs';

export function createSpecReader(ROOT: string, fail: (message: string) => never) {
  const SPEC = join(ROOT, 'analytics', 'spec.yaml');

  // ──────────────────────────────── spec parsing ─────────────────────────────

  /**
   * Parses spec.yaml with js-yaml — the parser analytics/setup-ga4.mjs uses.
   *
   * The gate used to read dimensions line by line. That missed multi-line
   * plain and double-quoted scalars and the `>+` / `|2` block indicators, so
   * it measured a truncated first line and passed 242–253-character
   * descriptions that setup then rejected at the 150 limit (audit 2026-10-07,
   * #862). Measuring the same parsed string setup measures closes that gap.
   */
  function parseSpec(): Record<string, unknown> {
    if (!existsSync(SPEC)) fail('analytics/spec.yaml is missing.');
    let doc: unknown;
    try {
      doc = load(readFileSync(SPEC, 'utf-8'));
    } catch (error) {
      fail(
        `analytics/spec.yaml is not valid YAML: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
      fail('analytics/spec.yaml is not a YAML mapping.');
    }
    return doc as Record<string, unknown>;
  }

  /** A top-level list; an empty section (`key:` with nothing under it) is []. */
  function specList(doc: Record<string, unknown>, key: string): Record<string, unknown>[] {
    if (!(key in doc)) fail(`analytics/spec.yaml has no top-level \`${key}:\` section.`);
    const value = doc[key] ?? [];
    if (!Array.isArray(value)) fail(`analytics/spec.yaml \`${key}:\` is not a list.`);
    return value.map((entry, index) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        fail(`analytics/spec.yaml \`${key}:\` entry #${index + 1} is not a mapping.`);
      }
      return entry as Record<string, unknown>;
    });
  }

  function validateDimensionContract(
    eventDims: DimensionEntry[],
    userDims: DimensionEntry[],
  ): void {
    try {
      validateCustomDimensionSpec({
        event_scoped_dimensions: eventDims,
        user_scoped_dimensions: userDims,
      });
    } catch (error) {
      fail(
        `analytics/spec.yaml violates the GA4 Admin API dimension contract, so ` +
          `analytics/setup-ga4.mjs would reject it:\n  ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  function validateDimensionCaps(
    eventDims: readonly DimensionEntry[],
    userDims: readonly DimensionEntry[],
  ): void {
    // Per-property caps. GA4 refuses creation at the cap and archiving is the only
    // way back, so a spec that outgrows it fails at sync time — halfway through,
    // having already created whatever came earlier in the list. Issue #240.
    const caps: ReadonlyArray<readonly [string, number, number]> = [
      ['event', eventDims.length, CUSTOM_DIMENSION_LIMITS.perProperty.event],
      ['user', userDims.length, CUSTOM_DIMENSION_LIMITS.perProperty.user],
    ];
    for (const [scope, count, cap] of caps) {
      if (count > cap) {
        fail(
          `analytics/spec.yaml declares ${count} ${scope}-scoped dimensions, over ` +
            `the GA4 property cap of ${cap}. setup-ga4.mjs would fail partway ` +
            `through. Archive dimensions belonging to retired features before ` +
            `adding more — see issue #240 for how the last nine were identified.`,
        );
      }
    }
  }

  function readSpec(): AnalyticsSpec {
    const doc = parseSpec();

    // GA4 Admin API contract — same rules setup-ga4.mjs enforces at sync time.
    const eventDims = specList(doc, 'event_scoped_dimensions') as DimensionEntry[];
    const userDims = specList(doc, 'user_scoped_dimensions') as DimensionEntry[];
    if (eventDims.length === 0) fail('parsed zero event-scoped dimensions — the parser is broken.');
    validateDimensionContract(eventDims, userDims);
    validateDimensionCaps(eventDims, userDims);
    const eventHeadroom = CUSTOM_DIMENSION_LIMITS.perProperty.event - eventDims.length;

    const registeredEvents = new Set(
      specList(doc, 'events').map((event, index) => {
        if (typeof event.name !== 'string' || event.name === '') {
          fail(`analytics/spec.yaml \`events:\` entry #${index + 1} has no name.`);
        }
        return event.name;
      }),
    );
    const declaredDims = new Set(eventDims.map((d) => String(d.parameter_name)));

    if (registeredEvents.size === 0) fail('spec.yaml registers zero events — the scan is broken.');
    if (declaredDims.size === 0) fail('spec.yaml declares zero dimensions — the scan is broken.');

    return { eventDims, eventHeadroom, registeredEvents, declaredDims };
  }

  return { readSpec };
}
