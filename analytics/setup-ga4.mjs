#!/usr/bin/env node
/**
 * GA4 setup — applies analytics/spec.yaml to the configured GA4 property
 * idempotently using the Google Analytics Admin API.
 *
 * Authentication (priority order):
 *   1. ~/.config/mirai-shigoto/oauth-token.json — preferred path. Acts as the
 *      logged-in user (full GA4 admin access). Created once by running
 *      `node analytics/oauth-init.mjs`. No GA4 dashboard configuration
 *      required since the user already has access.
 *   2. GOOGLE_APPLICATION_CREDENTIALS env var — service account JSON.
 *      Fallback path. Requires the service-account email be granted access
 *      on the GA4 account / property in Admin → Account/Property Access
 *      Management. NOTE: GA4 sometimes refuses service accounts cross-org
 *      (returns "this email address does not have a Google account" — Google
 *      Cloud localizes that error string per UI locale); if you hit that,
 *      switch to the OAuth user-credential path (#1).
 *
 * Usage:
 *   # From the repository root, once OAuth has been initialized:
 *   GA4_PROPERTY_ID=298707336 corepack pnpm@11.9.0 --dir analytics run setup
 *
 *   # Or just discover what properties you can access:
 *   corepack pnpm@11.9.0 --dir analytics run discover
 *
 * Modes:
 *   --check     Read-only. Authenticates, lists the property, and diffs it
 *               against the spec in both directions. Exits 1 if a spec item is
 *               missing from the property. Never writes.
 *   --dry-run   Validates the spec locally. Does NOT authenticate and does NOT
 *               read the property, so it cannot detect drift — every item
 *               prints as "would create" regardless of property state. Use
 *               --check for that.
 *   --discover  Lists accessible accounts and properties.
 *
 * What it does:
 *   1. Lists existing custom dimensions on the property
 *   2. For each dimension in spec.yaml, creates it if missing
 *      (existing dimensions are NEVER modified — GA4 doesn't allow renaming;
 *       to change a dimension you must archive the old one in dashboard first)
 *   3. Same idempotent flow for key events (conversion events)
 *
 * What it does NOT do:
 *   - Create/update audiences (filter JSON too complex; create via dashboard)
 *   - Configure data retention (manual: Admin → Data Settings → Data Retention)
 *   - Configure enhanced measurement (manual: Admin → Data Streams → Web → ⚙)
 *   - Demote previously-marked key events that are no longer in the spec —
 *     do that manually in Admin → Key events.
 *
 * Required OAuth scopes:
 *   - https://www.googleapis.com/auth/analytics.edit
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import { google } from "googleapis";
import { validateCustomDimensionSpec } from "./ga4-spec-validation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = path.join(__dirname, "spec.yaml");

const SCOPES = ["https://www.googleapis.com/auth/analytics.edit"];

const args = process.argv.slice(2);
const DISCOVER = args.includes("--discover");
const DRY_RUN = args.includes("--dry-run");
/**
 * `--check` — read-only reconciliation against the live property.
 *
 * Distinct from `--dry-run`, which never authenticates and therefore never
 * looks at the property: under `--dry-run` the existing-state lists are
 * substituted empty, so every item prints as "would create" whether the
 * property is bare or a perfect match. That output cannot tell those two
 * apart, which made it useless for the one question it looks like it answers
 * (#247).
 *
 * `--check` authenticates, lists, and diffs in both directions — including
 * property-side entries absent from the spec, which the sync path ignores by
 * design because it only ever creates. Exits non-zero on any drift. Never
 * writes.
 */
const CHECK = args.includes("--check");

function log(level, msg) {
  const stamp = new Date().toISOString().slice(11, 19);
  const prefix = { info: "  ", ok: "✓ ", add: "+ ", skip: "= ", err: "✗ " }[level] || "  ";
  console.log(`[${stamp}] ${prefix}${msg}`);
}

function loadSpec() {
  if (!fs.existsSync(SPEC_PATH)) {
    throw new Error(`Spec not found: ${SPEC_PATH}`);
  }
  const raw = fs.readFileSync(SPEC_PATH, "utf8");
  const spec = yaml.load(raw);
  // Sanity checks
  if (!Array.isArray(spec.events)) throw new Error("spec.events must be an array");
  // Validate the local spec against the GA4 Admin API before property lookup,
  // authentication, API reads, or writes. Dry-run and real sync share this
  // exact fail-fast path.
  validateCustomDimensionSpec(spec);
  log(
    "ok",
    `Validated ${spec.event_scoped_dimensions.length + spec.user_scoped_dimensions.length} ` +
      "custom dimensions against GA4 Admin API limits",
  );
  // Cross-check: every dimension's parameter_name should appear in some event.
  //
  // `sent_by: server` dimensions are exempt. They ride the server-rendered
  // `page_view` from the Edge middleware, and `page_view` is a GA4 built-in
  // that is not declared under `events:` — so this check structurally cannot
  // see them. Before the exemption they produced six WARNs on every run
  // (#247), which is six chances to skip past a real one. The exemption is
  // narrow: it suppresses nothing else, and an unmarked orphan still warns.
  const eventParams = new Set();
  for (const ev of spec.events) {
    for (const p of ev.params || []) eventParams.add(p.name);
  }
  const serverSent = spec.event_scoped_dimensions.filter(d => d.sent_by === "server");
  for (const dim of spec.event_scoped_dimensions) {
    if (dim.sent_by === "server") continue;
    if (!eventParams.has(dim.parameter_name)) {
      log("err", `WARN: event_scoped dimension '${dim.parameter_name}' is not used by any event in spec`);
    }
  }
  if (serverSent.length > 0) {
    log(
      "info",
      `${serverSent.length} server-sent dimension(s) exempt from the orphan check ` +
        `(sent_by: server): ${serverSent.map(d => d.parameter_name).join(", ")}`,
    );
  }
  return spec;
}

function getAuthClient() {
  const oauthTokenPath = path.join(os.homedir(), ".config", "mirai-shigoto", "oauth-token.json");

  // Escape hatch for a stale OAuth token. The priority order below prefers the
  // token file whenever it exists, so a revoked or expired refresh_token makes
  // the whole script unusable — it fails with a bare `invalid_grant` before any
  // work, even when a perfectly good service-account key is configured. That
  // was the live state on 2026-07-30 (#247): the token had expired, and every
  // mode of this script was dead with a one-word error.
  //
  // `GA4_AUTH=service_account` skips the token file entirely.
  if (process.env.GA4_AUTH === "service_account") {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credPath || !fs.existsSync(credPath)) {
      throw new Error(
        "GA4_AUTH=service_account was set, but GOOGLE_APPLICATION_CREDENTIALS " +
          `is ${credPath ? `not a readable file: ${credPath}` : "unset"}.`,
      );
    }
    log("info", `Authenticating via service account (GA4_AUTH=service_account): ${credPath}`);
    return new google.auth.GoogleAuth({ keyFile: credPath, scopes: SCOPES });
  }

  // Priority 1: OAuth user-credential token (preferred — bypasses GA4
  //             service-account access restrictions).
  if (fs.existsSync(oauthTokenPath)) {
    log("info", `Authenticating via OAuth user credentials: ${oauthTokenPath}`);
    const stored = JSON.parse(fs.readFileSync(oauthTokenPath, "utf8"));
    if (!stored.refresh_token) {
      throw new Error(`OAuth token file is missing refresh_token. Re-run \`node analytics/oauth-init.mjs\` to regenerate.`);
    }
    const oauth2 = new google.auth.OAuth2(stored.client_id, stored.client_secret);
    oauth2.setCredentials({ refresh_token: stored.refresh_token });
    return oauth2;
  }

  // Priority 2: service account JSON via env var (fallback).
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) {
    throw new Error(
      "No authentication configured. Either:\n" +
      "  (a) Run `node analytics/oauth-init.mjs` to set up OAuth user credentials (recommended), or\n" +
      "  (b) Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json (requires GA4-side access grant).",
    );
  }
  if (!fs.existsSync(credPath)) {
    throw new Error(`Credential file not found: ${credPath}`);
  }
  log("info", `Authenticating via service account: ${credPath}`);
  return new google.auth.GoogleAuth({ keyFile: credPath, scopes: SCOPES });
}

async function discoverProperties(admin) {
  log("info", "Listing accessible accounts and properties…");
  const accountsRes = await admin.accountSummaries.list({ pageSize: 200 });
  const summaries = accountsRes.data.accountSummaries || [];
  if (summaries.length === 0) {
    log("err", "No accessible accounts. Did you grant the service account access on the GA4 property?");
    return;
  }
  for (const acc of summaries) {
    console.log(`\n  Account: ${acc.displayName}  (name=${acc.name})`);
    for (const p of acc.propertySummaries || []) {
      console.log(`    └─ Property: ${p.displayName.padEnd(40)}  property_id=${p.property.replace("properties/", "")}`);
    }
  }
  console.log("\nUse the property_id with GA4_PROPERTY_ID env var when running setup.\n");
}

async function syncCustomDimensions(admin, propertyId, dimensions, scope) {
  const parent = `properties/${propertyId}`;
  log("info", `Syncing ${dimensions.length} ${scope} custom dimensions…`);
  const existingRes = DRY_RUN
    ? { data: { customDimensions: [] } }
    : await admin.properties.customDimensions.list({ parent, pageSize: 200 });
  const existing = existingRes.data.customDimensions || [];
  // Index existing by parameterName + scope
  const byKey = new Map(existing.map(d => [`${d.parameterName}|${d.scope}`, d]));
  const failures = [];
  for (const dim of dimensions) {
    const key = `${dim.parameter_name}|${scope.toUpperCase()}`;
    if (byKey.has(key)) {
      log("skip", `${scope} dimension exists: ${dim.parameter_name}`);
      continue;
    }
    if (DRY_RUN) {
      log("add", `[dry-run] would create ${scope} dimension: ${dim.parameter_name} (${dim.display_name})`);
      continue;
    }
    try {
      await admin.properties.customDimensions.create({
        parent,
        requestBody: {
          parameterName: dim.parameter_name,
          displayName: dim.display_name,
          description: dim.description,
          scope: scope.toUpperCase(), // EVENT or USER
        },
      });
      log("add", `created ${scope} dimension: ${dim.parameter_name}`);
    } catch (err) {
      log("err", `failed ${dim.parameter_name}: ${err.message}`);
      failures.push({ kind: `${scope}-dimension`, name: dim.parameter_name, message: err.message });
    }
  }
  return failures;
}

async function syncKeyEvents(admin, propertyId, keyEventNames) {
  const parent = `properties/${propertyId}`;
  log("info", `Syncing ${keyEventNames.length} key events…`);
  const existingRes = DRY_RUN
    ? { data: { keyEvents: [] } }
    : await admin.properties.keyEvents.list({ parent, pageSize: 200 }).catch(async () => {
        // Older API path (conversionEvents) — fallback
        return admin.properties.conversionEvents.list({ parent, pageSize: 200 });
      });
  const existing = existingRes.data.keyEvents || existingRes.data.conversionEvents || [];
  const byName = new Map(existing.map(e => [e.eventName, e]));

  const failures = [];
  for (const evName of keyEventNames) {
    if (byName.has(evName)) {
      log("skip", `key event exists: ${evName}`);
      continue;
    }
    if (DRY_RUN) {
      log("add", `[dry-run] would mark as key event: ${evName}`);
      continue;
    }
    try {
      // Try keyEvents API first (current as of 2024+); fall back to conversionEvents
      const body = { eventName: evName, countingMethod: "ONCE_PER_EVENT" };
      try {
        await admin.properties.keyEvents.create({ parent, requestBody: body });
      } catch (e) {
        if (e.code === 404 || /not found/i.test(e.message || "")) {
          await admin.properties.conversionEvents.create({ parent, requestBody: { eventName: evName } });
        } else {
          throw e;
        }
      }
      log("add", `marked as key event: ${evName}`);
    } catch (err) {
      log("err", `failed ${evName}: ${err.message}`);
      failures.push({ kind: "key-event", name: evName, message: err.message });
    }
  }
  return failures;
}

/**
 * Read-only diff of spec against the live property. Returns true if anything
 * drifted.
 *
 * Reports both directions. Property-only entries are the half the sync path is
 * blind to by construction — it only ever creates, never demotes or archives —
 * so a dimension or key event that outlived the feature that needed it stays on
 * the property indefinitely and nothing says so. That is how #240's nine dead
 * dimensions accumulated, and how four dead key events are still counted as
 * conversions today.
 *
 * Property-only entries are partitioned against `property_residue:` in the
 * spec. Declared ones collapse to a single summary line — before that block
 * existed this function printed ten of them on every run of a fully-synced
 * property (#249), which is how an eleventh would go unread. Undeclared ones
 * fail, same as spec-only entries: the resolution is a one-line spec addition,
 * and the alternative is the state where nobody notices.
 */
function residueNames(spec, kind) {
  return new Set(((spec.property_residue || {})[kind] || []).map(e => e.name));
}

/**
 * Reports property-side extras, splitting declared residue from surprises.
 * Returns the number of undeclared ones.
 */
function reportPropertyOnly(propOnly, declared, label) {
  const known = propOnly.filter(n => declared.has(n));
  const unknown = propOnly.filter(n => !declared.has(n));
  if (known.length > 0) {
    log("info", `  ${known.length} declared property_residue ${label} present, as expected`);
  }
  for (const n of unknown) {
    log("err", `  UNDECLARED on property, not in spec: ${n}`);
  }
  return unknown.length;
}

async function checkDrift(admin, propertyId, spec, derivedKeyEvents) {
  const parent = `properties/${propertyId}`;
  log("info", "CHECK — read-only. Listing the live property; no writes will be made.");

  const dimRes = await admin.properties.customDimensions.list({ parent, pageSize: 200 });
  const liveDims = dimRes.data.customDimensions || [];

  const keyRes = await admin.properties.keyEvents
    .list({ parent, pageSize: 200 })
    .catch(async () => admin.properties.conversionEvents.list({ parent, pageSize: 200 }));
  const liveKeyEvents = (keyRes.data.keyEvents || keyRes.data.conversionEvents || []).map(e => e.eventName);

  let missing = 0;
  let undeclared = 0;

  for (const [scope, specDims, residueKind] of [
    ["EVENT", spec.event_scoped_dimensions, "event_scoped_dimensions"],
    ["USER", spec.user_scoped_dimensions, "user_scoped_dimensions"],
  ]) {
    const live = new Set(liveDims.filter(d => d.scope === scope).map(d => d.parameterName));
    const declared = new Set(specDims.map(d => d.parameter_name));
    const specOnly = [...declared].filter(n => !live.has(n));
    const propOnly = [...live].filter(n => !declared.has(n));

    log("info", `${scope} dimensions — spec ${declared.size}, property ${live.size}`);
    for (const n of specOnly) log("err", `  in spec, NOT on property: ${n} (run without --check to create)`);
    undeclared += reportPropertyOnly(propOnly, residueNames(spec, residueKind), `${scope} dimension(s)`);
    if (specOnly.length === 0 && propOnly.length === 0) log("ok", `  ${scope} dimensions match exactly`);
    missing += specOnly.length;
  }

  const liveKeySet = new Set(liveKeyEvents);
  const specKeySet = new Set(derivedKeyEvents);
  const keySpecOnly = derivedKeyEvents.filter(n => !liveKeySet.has(n));
  const keyPropOnly = liveKeyEvents.filter(n => !specKeySet.has(n));

  log("info", `Key events — spec ${specKeySet.size}, property ${liveKeySet.size}`);
  for (const n of keySpecOnly) log("err", `  in spec, NOT on property: ${n} (run without --check to create)`);
  undeclared += reportPropertyOnly(keyPropOnly, residueNames(spec, "key_events"), "key event(s)");
  if (keySpecOnly.length === 0 && keyPropOnly.length === 0) log("ok", "  key events match exactly");
  missing += keySpecOnly.length;

  if (missing > 0) {
    log("err", `DRIFT — ${missing} spec item(s) not applied to the property. Re-run without --check to apply.`);
  }
  if (undeclared > 0) {
    log(
      "err",
      `DRIFT — ${undeclared} property item(s) neither in the spec nor in ` +
        `property_residue:. Either clean them up on the property, or declare them ` +
        `under property_residue: with the evidence they are dead.`,
    );
  }
  if (missing > 0 || undeclared > 0) return true;
  log("ok", "No drift: spec and property agree, and every extra is declared residue.");
  return false;
}

async function main() {
  const spec = loadSpec();

  if (DISCOVER) {
    const auth = getAuthClient();
    const admin = google.analyticsadmin({ version: "v1beta", auth });
    await discoverProperties(admin);
    return;
  }

  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId && !DRY_RUN) {
    throw new Error(
      "Missing env var GA4_PROPERTY_ID. Run with --discover to list available properties.",
    );
  }
  if (propertyId && !/^\d+$/.test(propertyId)) {
    throw new Error(`GA4_PROPERTY_ID must be numeric (e.g., 501234567); got: ${propertyId}`);
  }

  log("info", propertyId ? `Target property: properties/${propertyId}` : "Target property: dry-run only");
  if (DRY_RUN) {
    log("info", "DRY RUN — no authentication, API reads, or API writes will be made");
    log(
      "info",
      "This validates the spec only. It CANNOT see the property: existing-state " +
        "lists are substituted empty, so every item below prints as 'would create' " +
        "even when the property already matches exactly. Use --check for real drift.",
    );
  }

  const admin = DRY_RUN
    ? null
    : google.analyticsadmin({ version: "v1beta", auth: getAuthClient() });

  const derivedKeyEventsForCheck = spec.events.filter(e => e.conversion).map(e => e.name);
  if (CHECK) {
    const drifted = await checkDrift(admin, propertyId, spec, derivedKeyEventsForCheck);
    process.exit(drifted ? 1 : 0);
  }

  // Accumulate per-step failures so partial sync surfaces a non-zero exit
  // code at the end instead of being lost in the log scroll.
  const allFailures = [];
  allFailures.push(...await syncCustomDimensions(admin, propertyId, spec.event_scoped_dimensions, "event"));
  allFailures.push(...await syncCustomDimensions(admin, propertyId, spec.user_scoped_dimensions, "user"));

  // Derive key events from the spec (events with conversion: true)
  // Cross-check against the explicit key_events list as a sanity guard.
  const derivedKeyEvents = spec.events.filter(e => e.conversion).map(e => e.name);
  const explicitKeyEvents = spec.key_events || [];
  const setA = new Set(derivedKeyEvents);
  const setB = new Set(explicitKeyEvents);
  if (setA.size !== setB.size || [...setA].some(n => !setB.has(n))) {
    log("err", `WARN: derived key events ${JSON.stringify(derivedKeyEvents)} != explicit ${JSON.stringify(explicitKeyEvents)}`);
  }
  allFailures.push(...await syncKeyEvents(admin, propertyId, derivedKeyEvents));

  if (allFailures.length > 0) {
    console.error(`\n[setup-ga4] FAILED — ${allFailures.length} sync error(s):`);
    for (const f of allFailures) {
      console.error(`  [${f.kind}] ${f.name}: ${f.message}`);
    }
    console.error("\nFix the underlying API errors and re-run. Existing items are NOT modified;");
    console.error("the script is idempotent so re-runs only retry the failures.");
    process.exit(1);
  }

  log("info", "Done. Audiences and data retention must be set manually in dashboard (see analytics/README.md).");
}

main().catch(err => {
  console.error("\nFATAL:", err.message);
  if (err.errors) console.error(err.errors);
  // `invalid_grant` is what Google returns for a revoked or expired
  // refresh_token, and on its own it names neither the credential nor the way
  // out. Since the auth priority order prefers the token file whenever it
  // exists, this failure blocks every mode of the script (#247).
  if (/invalid_grant/i.test(err.message || "")) {
    console.error(
      "\nThis is an expired or revoked OAuth refresh_token in " +
        "~/.config/mirai-shigoto/oauth-token.json. Either:\n" +
        "  (a) re-run `node analytics/oauth-init.mjs` to mint a new one, or\n" +
        "  (b) bypass it with GA4_AUTH=service_account and " +
        "GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json",
    );
  }
  process.exit(1);
});
