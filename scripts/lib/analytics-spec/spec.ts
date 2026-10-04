import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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

  function specSection(lines: readonly string[], key: string): string[] {
    const start = lines.findIndex((l) => l === key);
    if (start < 0) fail(`analytics/spec.yaml has no top-level \`${key}\` section.`);
    const rest = lines.slice(start + 1);
    const endOffset = rest.findIndex((l) => /^[a-z_]+:$/.test(l));
    return endOffset < 0 ? rest : rest.slice(0, endOffset);
  }

  /**
   * Reads dimension entries out of a spec section as objects, so the GA4 Admin
   * API validator can be applied to them directly instead of this file
   * re-implementing its length and pattern rules.
   *
   * Block scalars (`description: |`) would need real YAML semantics to read, so
   * they are rejected rather than silently mis-parsed into a short string that
   * passes the length check it should have failed.
   */
  function parseDimensions(section: readonly string[], key: string): DimensionEntry[] {
    const entries: DimensionEntry[] = [];
    let current: DimensionEntry | null = null;
    for (const line of section) {
      const head = line.match(/^\s{2}- parameter_name:\s*(.+)$/);
      if (head) {
        if (current) entries.push(current);
        current = { parameter_name: unquote(head[1]!) };
        continue;
      }
      if (!current) continue;
      const field = line.match(/^\s{4}(display_name|description):\s*(.*)$/);
      if (!field) continue;
      const raw = field[2]!.trim();
      if (raw === '|' || raw === '>' || raw === '|-' || raw === '>-') {
        fail(
          `${key} entry "${current.parameter_name}" uses a YAML block scalar for ` +
            `${field[1]}. This gate reads dimensions line-by-line and cannot ` +
            `measure a block scalar's true length, so it would pass a limit check ` +
            `it should fail. Put the value on one line.`,
        );
      }
      current[field[1] as 'display_name' | 'description'] = unquote(raw);
    }
    if (current) entries.push(current);
    return entries;
  }

  function unquote(value: string): string {
    const trimmed = value.trim();
    const quoted = trimmed.match(/^"(.*)"$/) ?? trimmed.match(/^'(.*)'$/);
    return quoted ? quoted[1]! : trimmed;
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
    if (!existsSync(SPEC)) fail('analytics/spec.yaml is missing.');
    const lines = readFileSync(SPEC, 'utf-8').split('\n');

    // GA4 Admin API contract — same rules setup-ga4.mjs enforces at sync time.
    const eventDims = parseDimensions(
      specSection(lines, 'event_scoped_dimensions:'),
      'event_scoped_dimensions',
    );
    const userDims = parseDimensions(
      specSection(lines, 'user_scoped_dimensions:'),
      'user_scoped_dimensions',
    );
    if (eventDims.length === 0) fail('parsed zero event-scoped dimensions — the parser is broken.');
    validateDimensionContract(eventDims, userDims);
    validateDimensionCaps(eventDims, userDims);
    const eventHeadroom = CUSTOM_DIMENSION_LIMITS.perProperty.event - eventDims.length;

    const registeredEvents = new Set(
      specSection(lines, 'events:')
        .filter((l) => /^\s{2}- name:/.test(l))
        .map((l) => l.replace(/^\s*- name:\s*/, '').trim()),
    );
    const declaredDims = new Set(
      specSection(lines, 'event_scoped_dimensions:')
        .filter((l) => /^\s{2}- parameter_name:/.test(l))
        .map((l) => l.replace(/^\s*- parameter_name:\s*/, '').trim()),
    );

    if (registeredEvents.size === 0) fail('spec.yaml registers zero events — the scan is broken.');
    if (declaredDims.size === 0) fail('spec.yaml declares zero dimensions — the scan is broken.');

    return { eventDims, eventHeadroom, registeredEvents, declaredDims };
  }

  return { readSpec };
}
