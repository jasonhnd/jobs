/**
 * ga4-admin-helpers.mjs — pieces of setup-ga4.mjs that do not need
 * googleapis, kept separate so they are tested by the root `bun run test`
 * (analytics/setup-ga4.test.mjs) without installing the analytics package.
 */

/** The mode flags setup-ga4.mjs accepts. */
export function parseModes(args) {
  return {
    discover: args.includes("--discover"),
    dryRun: args.includes("--dry-run"),
    check: args.includes("--check"),
  };
}

function isNotFound(error) {
  const status = error?.code ?? error?.status ?? error?.response?.status;
  return status === 404 || /not found/i.test(error?.message || "");
}

/**
 * Event names of the property's key events.
 *
 * Falls back to the legacy `conversionEvents` API only when `keyEvents` is not
 * found — the same rule the create path uses. It used to fall back on any
 * error, so an expired token or a missing permission on `keyEvents.list` was
 * swallowed and surfaced, if at all, as a confusing second failure from the
 * legacy API (#862).
 */
export async function listKeyEvents(admin, parent) {
  let res;
  try {
    res = await admin.properties.keyEvents.list({ parent, pageSize: 200 });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    res = await admin.properties.conversionEvents.list({ parent, pageSize: 200 });
  }
  return (res.data.keyEvents || res.data.conversionEvents || []).map((e) => e.eventName);
}
