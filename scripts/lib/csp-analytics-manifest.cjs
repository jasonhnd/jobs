/**
 * csp-analytics-manifest.cjs — the env-gated analytics inline-script hashes
 * that must stay in `script-src` even when the `PUBLIC_*` analytics env is
 * absent at build time.
 *
 * Why a manifest at all: CI and local builds usually run without the analytics
 * env, so those inline scripts are not emitted and their hashes cannot be
 * computed from `dist-astro/`. Production HAS the env and does emit them, and
 * Vercel reads `vercel.json` BEFORE the build — so the committed CSP is what
 * governs production. Without this list, an env-less build would strip the
 * hashes that production needs and CSP would block the analytics bootstrap.
 *
 * Why its own module: `compute-csp-hashes.cjs` and its test both need the list,
 * and the test used to keep a hand-copied duplicate. That drifts silently the
 * moment an analytics inline script changes — the failure mode this repo keeps
 * hitting. One definition, two importers.
 *
 * A full-`PUBLIC_*`-env build verifies every entry is still emitted and fails
 * closed if an analytics inline script changed. When that fires, rebuild with
 * the full env, take the new hash from the failure output, and update here.
 */
module.exports = {
  CSP_ANALYTICS_FALLBACK_HASHES: [
    // gtag.js bootstrap. Changed 2026-08-14 (#253) when the client resumed
    // sending its own page_view: the middleware now sends `page_delivery`, a
    // different unit, so there is no duplicate to stand down from and the
    // `send_page_view: false` branch is gone.
    "'sha256-80on6q+4N8b4tdPifTn79iWlzXfYoRuhIjokIq9QGw4='",
    "'sha256-mEjXucpUExIz3nx3AizABlBEO3RXLDXVXIkrpe7XvPk='",
    "'sha256-rMk6BYbivudkhnerx/Rk2lI++sOY2uBxHPARDHh/Tpk='",
  ],
};
