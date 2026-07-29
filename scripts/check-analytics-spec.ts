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
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
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
} from '../analytics/ga4-spec-validation.mjs';

const ROOT = join(import.meta.dir, '..');
const SPEC = join(ROOT, 'analytics', 'spec.yaml');

function fail(message: string): never {
  console.error(`[check-analytics-spec] FAIL: ${message}`);
  process.exit(1);
}

/**
 * Every source file that calls `gtag('event', X, …)` with a non-literal `X`.
 *
 * `wrapper` — the file defines a forwarding function; its literal call sites
 * carry the real event names, so they are read from there.
 * `emits` — the name cannot be recovered statically (read from the DOM, or
 * chosen by a ternary), so the reachable names are declared here.
 *
 * Adding a new dynamic call site without adding it here fails the gate.
 */
interface DynamicEmitSite {
  readonly file: string;
  readonly wrapper?: string;
  readonly emits?: readonly string[];
  readonly why: string;
}

const DYNAMIC_EMIT_SITES: readonly DynamicEmitSite[] = [
  {
    file: 'src/pages/_shindan.js',
    wrapper: 'track',
    why: 'track(name, params) forwards to gtag; names are literals at its call sites.',
  },
  {
    file: 'src/pages/_map-inline.js',
    wrapper: 'ga',
    why: 'ga(name, params) forwards to gtag; names are literals at its call sites.',
  },
  {
    file: 'src/pages/_me-inline.js',
    wrapper: 'ga',
    why: 'ga(name, params) forwards to gtag; names are literals at its call sites.',
  },
  {
    file: 'src/components/Footer.astro',
    emits: ['jobtag_outbound_click', 'me_entry_click'],
    why: 'Reads the name from <a data-track-event>, then builds params per known name.',
  },
  {
    file: 'src/pages/_index-inline.js',
    emits: ['popular_job_click', 'job_search_navigate'],
    why: 'Ternary on `source === "chip"` picks between these two literals.',
  },
];

/**
 * Parameters the Edge middleware sends server-side. They never appear in a
 * `gtag()` call, so they must be read from their own definitions or the gate
 * would report every one of them as an unused dimension.
 *
 * Both anchors are required to resolve; a rename that breaks either one fails
 * the gate rather than silently dropping the parameters it can no longer find.
 */
const SERVER_PARAM_SOURCE = 'src/lib/middleware-helpers.ts';
const SERVER_PARAM_ANCHORS: readonly { readonly anchor: string; readonly why: string }[] = [
  {
    anchor: 'export function buildMpPayload',
    why: 'the `params:` object of the server-side page_view',
  },
  {
    anchor: 'export interface GeoReferralParams',
    why: 'the geo attribution params merged in by attachPageViewParams',
  },
];

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

// ─────────────────────────────── source scanning ───────────────────────────

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|js|astro)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(join(ROOT, 'src'));
  return out.sort();
}

/**
 * Returns the body of the `{…}` that starts at `open`, excluding the braces.
 * Tracks nesting and skips string literals so a `}` inside a string or a nested
 * object does not end the scan early. Returns null if unbalanced.
 */
function balancedBraceBody(text: string, open: number): string | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null;
}

/** Top-level keys of an object-literal body; nested objects are not descended. */
function topLevelKeys(body: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let atKeyPosition = true;
  let token = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') depth--;
    else if (depth === 0) {
      if (ch === ',') {
        atKeyPosition = true;
        token = '';
        continue;
      }
      if (ch === ':') {
        if (atKeyPosition) {
          const name = token.trim().replace(/^readonly\s+/, '');
          if (/^[a-z_][a-z0-9_]*$/i.test(name)) keys.push(name);
        }
        atKeyPosition = false;
        token = '';
        continue;
      }
      if (ch === ';') {
        // interface field separator
        const name = token.trim().replace(/^readonly\s+/, '');
        if (/^[a-z_][a-z0-9_]*$/i.test(name)) keys.push(name);
        atKeyPosition = true;
        token = '';
        continue;
      }
      if (atKeyPosition) token += ch;
    }
  }
  const tail = token.trim().replace(/^readonly\s+/, '');
  if (atKeyPosition && /^[a-z_][a-z0-9_]*$/i.test(tail)) keys.push(tail);
  return keys;
}

interface Emission {
  readonly event: string;
  readonly params: readonly string[];
  readonly file: string;
}

/** Params of a call whose name ends at `afterName`; empty when none are passed. */
function paramsAfter(text: string, afterName: number): string[] {
  const rest = text.slice(afterName, afterName + 4000);
  const comma = rest.match(/^\s*,\s*\{/);
  if (!comma) return [];
  const open = afterName + comma[0].length - 1;
  const body = balancedBraceBody(text, open);
  return body === null ? [] : topLevelKeys(body);
}

function scan(): { emissions: Emission[]; undeclaredDynamic: string[] } {
  const emissions: Emission[] = [];
  const undeclaredDynamic: string[] = [];
  const siteByFile = new Map(DYNAMIC_EMIT_SITES.map((s) => [s.file, s]));
  const seenSites = new Set<string>();

  for (const full of sourceFiles()) {
    const rel = relative(ROOT, full);
    const text = readFileSync(full, 'utf-8');

    // Shape 1 — literal name.
    const literal = /gtag\(\s*["']event["']\s*,\s*(["'])([a-z0-9_]+)\1/g;
    for (let m = literal.exec(text); m; m = literal.exec(text)) {
      emissions.push({
        event: m[2]!,
        params: paramsAfter(text, m.index + m[0].length),
        file: rel,
      });
    }

    // Shapes 2-4 — anything else must be declared.
    const dynamic = /gtag\(\s*["']event["']\s*,\s*/g;
    for (let m = dynamic.exec(text); m; m = dynamic.exec(text)) {
      const next = text[m.index + m[0].length];
      if (next === '"' || next === "'") continue; // already counted above
      const site = siteByFile.get(rel);
      if (!site) {
        undeclaredDynamic.push(rel);
        continue;
      }
      seenSites.add(rel);
      for (const event of site.emits ?? []) {
        emissions.push({ event, params: [], file: rel });
      }
    }

    // Wrapper call sites carry the real names and params.
    const site = siteByFile.get(rel);
    if (site?.wrapper) {
      const call = new RegExp(
        `(?<![\\w.])${site.wrapper}\\(\\s*(["'])([a-z0-9_]+)\\1`,
        'g',
      );
      for (let m = call.exec(text); m; m = call.exec(text)) {
        emissions.push({
          event: m[2]!,
          params: paramsAfter(text, m.index + m[0].length),
          file: rel,
        });
      }
    }
  }

  // A declared site that no longer has a dynamic call is stale — drop it from
  // the registry rather than leaving a rule nobody can trace to code.
  for (const site of DYNAMIC_EMIT_SITES) {
    if (!existsSync(join(ROOT, site.file))) {
      fail(
        `DYNAMIC_EMIT_SITES lists ${site.file}, which does not exist. ` +
          `Remove the entry.`,
      );
    }
    if (!seenSites.has(site.file)) {
      fail(
        `DYNAMIC_EMIT_SITES lists ${site.file}, but it has no dynamic ` +
          `gtag('event', …) call any more. Remove the entry so the registry ` +
          `keeps describing real code.`,
      );
    }
  }

  return { emissions, undeclaredDynamic: [...new Set(undeclaredDynamic)] };
}

function serverParams(): string[] {
  const full = join(ROOT, SERVER_PARAM_SOURCE);
  if (!existsSync(full)) {
    fail(`${SERVER_PARAM_SOURCE} is missing; server-side GA4 params cannot be read.`);
  }
  const text = readFileSync(full, 'utf-8');
  const params: string[] = [];
  for (const { anchor, why } of SERVER_PARAM_ANCHORS) {
    const at = text.indexOf(anchor);
    if (at < 0) {
      fail(
        `${SERVER_PARAM_SOURCE} no longer contains "${anchor}" — the anchor for ` +
          `${why}. It was renamed or removed; update SERVER_PARAM_ANCHORS in ` +
          `scripts/check-analytics-spec.ts so the params stay visible.`,
      );
    }
    const open = text.indexOf('{', at);
    if (open < 0) fail(`No object literal after "${anchor}" in ${SERVER_PARAM_SOURCE}.`);
    const body = balancedBraceBody(text, open);
    if (body === null) fail(`Unbalanced braces after "${anchor}" in ${SERVER_PARAM_SOURCE}.`);
    // buildMpPayload nests the params under events[0].params.
    const nested = body.indexOf('params:');
    if (anchor.includes('buildMpPayload')) {
      if (nested < 0) fail(`buildMpPayload no longer has a \`params:\` object.`);
      const nestedOpen = body.indexOf('{', nested);
      const nestedBody = balancedBraceBody(body, nestedOpen);
      if (nestedBody === null) fail(`Unbalanced \`params:\` object in buildMpPayload.`);
      params.push(...topLevelKeys(nestedBody));
    } else {
      params.push(...topLevelKeys(body));
    }
  }
  return params;
}

// ──────────────────────────────── spec parsing ─────────────────────────────

function specSection(lines: readonly string[], key: string): string[] {
  const start = lines.findIndex((l) => l === key);
  if (start < 0) fail(`analytics/spec.yaml has no top-level \`${key}\` section.`);
  const rest = lines.slice(start + 1);
  const endOffset = rest.findIndex((l) => /^[a-z_]+:$/.test(l));
  return endOffset < 0 ? rest : rest.slice(0, endOffset);
}

interface DimensionEntry {
  parameter_name?: string;
  display_name?: string;
  description?: string;
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

function main(): void {
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

  const { emissions, undeclaredDynamic } = scan();
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

  const problems: string[] = [];

  const firedBy = new Map<string, Set<string>>();
  for (const e of emissions) {
    if (!firedBy.has(e.event)) firedBy.set(e.event, new Set());
    firedBy.get(e.event)!.add(e.file);
  }

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

  const paramOwners = new Map<string, Set<string>>();
  for (const e of emissions) {
    for (const p of e.params) {
      if (!paramOwners.has(p)) paramOwners.set(p, new Set());
      paramOwners.get(p)!.add(e.event);
    }
  }
  for (const p of serverParams()) {
    if (!paramOwners.has(p)) paramOwners.set(p, new Set());
    paramOwners.get(p)!.add('page_view (middleware)');
  }

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
      `this spec. Run \`analytics/setup-ga4.mjs\` after changing dimensions.`,
  );
}

main();
