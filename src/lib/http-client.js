// src/lib/http-client.js — `fetch` wrapped in an AbortController-backed
// timeout. Exists because the platform `fetch` has no built-in timeout
// option, and a stalled upstream (Upstash, Cloudflare Turnstile, Resend,
// GA4 MP) would otherwise wedge the Edge function until Vercel's
// per-invocation cap (default 25s for Edge). That delay is paid by the
// user-visible form submit. (Audit CODE-007.)
//
// Lives under src/lib/ — not api/ — because Vercel auto-routes every
// file under api/ as an HTTP endpoint, and we do NOT want this to be
// reachable over HTTP. JS-only (not TS) so Edge runtime imports work
// without a build step, matching api-security.js / feedback-helpers.js.
//
// Pure I/O wrapper — no module-level state. AbortController is built
// into the Edge runtime and modern Node; zero new dependencies.

/**
 * `fetch` with a hard timeout. Aborts the underlying request via
 * AbortController after `timeoutMs`; the rejection surfaces as an
 * `AbortError` (DOMException name='AbortError'), which callers can
 * treat identically to a network error.
 *
 * If `init.signal` is already set, the existing signal is preserved
 * via `AbortSignal.any` (Edge runtime supports it) — both the caller-
 * supplied signal AND the timeout can abort the request.
 *
 * Timer is ALWAYS cleared in a `finally` so a slow-but-successful
 * request doesn't leave a dangling timer that fires uselessly later.
 *
 * @param {string | URL | Request} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs] hard timeout in milliseconds (default 5000)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, init = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Compose with a caller-supplied signal if present so either source
  // can abort. `AbortSignal.any` is the standard primitive; fall back
  // to just our timeout signal if it isn't available (older runtimes).
  let signal = controller.signal;
  if (init.signal) {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
      signal = AbortSignal.any([init.signal, controller.signal]);
    } else {
      // Best-effort: forward the caller's abort onto our controller.
      if (init.signal.aborted) controller.abort();
      else init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }
  try {
    return await fetch(url, { ...init, signal });
  } finally {
    clearTimeout(timer);
  }
}
