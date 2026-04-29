#!/usr/bin/env node
/**
 * GA4 setup — applies analytics/spec.yaml to the configured GA4 property
 * idempotently using the Google Analytics Admin API.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   GA4_PROPERTY_ID=123456789 \
 *     node analytics/setup-ga4.mjs
 *
 *   # Or just discover what properties your service account can access:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *     node analytics/setup-ga4.mjs --discover
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
 *
 * Required scopes on the service account JSON:
 *   - https://www.googleapis.com/auth/analytics.edit
 *
 * Required GA4 dashboard step (one-time):
 *   The service account email (from the JSON `client_email` field) must be
 *   added as an Editor on the GA4 property:
 *   GA4 Admin → Property Access Management → "+" → paste service account email
 *   → Role: Editor → Save.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = path.join(__dirname, "spec.yaml");

const SCOPES = ["https://www.googleapis.com/auth/analytics.edit"];

const args = process.argv.slice(2);
const DISCOVER = args.includes("--discover");
const DRY_RUN = args.includes("--dry-run");

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
  if (!Array.isArray(spec.event_scoped_dimensions)) throw new Error("spec.event_scoped_dimensions must be an array");
  if (!Array.isArray(spec.user_scoped_dimensions)) throw new Error("spec.user_scoped_dimensions must be an array");
  // Cross-check: every dimension's parameter_name should appear in some event
  const eventParams = new Set();
  for (const ev of spec.events) {
    for (const p of ev.params || []) eventParams.add(p.name);
  }
  for (const dim of spec.event_scoped_dimensions) {
    if (!eventParams.has(dim.parameter_name)) {
      log("err", `WARN: event_scoped dimension '${dim.parameter_name}' is not used by any event in spec`);
    }
  }
  return spec;
}

function getAuthClient() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) {
    throw new Error("Missing env var GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)");
  }
  if (!fs.existsSync(credPath)) {
    throw new Error(`Credential file not found: ${credPath}`);
  }
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
  const existingRes = await admin.properties.customDimensions.list({ parent, pageSize: 200 });
  const existing = existingRes.data.customDimensions || [];
  // Index existing by parameterName + scope
  const byKey = new Map(existing.map(d => [`${d.parameterName}|${d.scope}`, d]));
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
    }
  }
}

async function syncKeyEvents(admin, propertyId, keyEventNames) {
  const parent = `properties/${propertyId}`;
  log("info", `Syncing ${keyEventNames.length} key events…`);
  const existingRes = await admin.properties.keyEvents.list({ parent, pageSize: 200 }).catch(async () => {
    // Older API path (conversionEvents) — fallback
    return admin.properties.conversionEvents.list({ parent, pageSize: 200 });
  });
  const existing = existingRes.data.keyEvents || existingRes.data.conversionEvents || [];
  const byName = new Map(existing.map(e => [e.eventName, e]));

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
    }
  }
}

async function main() {
  const spec = loadSpec();
  const auth = getAuthClient();
  const admin = google.analyticsadmin({ version: "v1beta", auth });

  if (DISCOVER) {
    await discoverProperties(admin);
    return;
  }

  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    throw new Error(
      "Missing env var GA4_PROPERTY_ID. Run with --discover to list available properties.",
    );
  }
  if (!/^\d+$/.test(propertyId)) {
    throw new Error(`GA4_PROPERTY_ID must be numeric (e.g., 501234567); got: ${propertyId}`);
  }

  log("info", `Target property: properties/${propertyId}`);
  if (DRY_RUN) log("info", "DRY RUN — no API writes will be made");

  await syncCustomDimensions(admin, propertyId, spec.event_scoped_dimensions, "event");
  await syncCustomDimensions(admin, propertyId, spec.user_scoped_dimensions, "user");

  // Derive key events from the spec (events with conversion: true)
  // Cross-check against the explicit key_events list as a sanity guard.
  const derivedKeyEvents = spec.events.filter(e => e.conversion).map(e => e.name);
  const explicitKeyEvents = spec.key_events || [];
  const setA = new Set(derivedKeyEvents);
  const setB = new Set(explicitKeyEvents);
  if (setA.size !== setB.size || [...setA].some(n => !setB.has(n))) {
    log("err", `WARN: derived key events ${JSON.stringify(derivedKeyEvents)} != explicit ${JSON.stringify(explicitKeyEvents)}`);
  }
  await syncKeyEvents(admin, propertyId, derivedKeyEvents);

  log("info", "Done. Audiences and data retention must be set manually in dashboard (see analytics/README.md).");
}

main().catch(err => {
  console.error("\nFATAL:", err.message);
  if (err.errors) console.error(err.errors);
  process.exit(1);
});
